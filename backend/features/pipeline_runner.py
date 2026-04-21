from typing import Dict, Any, List, Optional
import json
import logging
import math
import os
import re
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime

import duckdb
import pandas as pd
import polars as pl

from models import ValidationRule
from features.cleaner import DataCleaner
from features.mapper import SchemaMapper
from features.matching import DataMatcher
from features.scraper import WebScraper
from features.transformer import DataTransformer
from features.validation import PolarsValidationEngine, UPLOAD_DIR

logger = logging.getLogger(__name__)
EDGE_KIND_DATA = "data"


class PipelineOrchestrator:
    def __init__(
        self,
        session_id: str,
        initial_df: Optional[pl.DataFrame] = None,
        session_store: Optional[Dict[str, Any]] = None,
        user_email: Optional[str] = None,
    ):
        self.session_id = session_id
        self.initial_df = initial_df.clone() if isinstance(initial_df, pl.DataFrame) else None
        self.session_store = session_store or {}
        self.user_email = user_email
        self._source_cache: Dict[str, pl.DataFrame] = {}

    def _node_type(self, node: Dict[str, Any]) -> str:
        # Saved pipelines store the React-Flow renderer type ("pipelineNode") in node["type"]
        # and the semantic kind in node["data"]["nodeType"].
        # Always prefer data.nodeType; fall back to node["type"] only when data.nodeType is absent.
        return (
            (node.get("data", {}).get("nodeType") or "").strip().lower()
            or (node.get("type") or "").strip().lower()
        )

    def _edge_kind(self, edge: Dict[str, Any]) -> str:
        if edge.get("data", {}).get("kind"):
            return edge["data"]["kind"]
        if str(edge.get("sourceHandle", "")).startswith("data") or str(edge.get("targetHandle", "")).startswith("data"):
            return EDGE_KIND_DATA
        return "sequence"

    def _topological_sort(self, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> List[str]:
        adj = {node["id"]: [] for node in nodes}
        in_degree = {node["id"]: 0 for node in nodes}
        seen = set()
        for edge in edges:
            source, target = edge.get("source"), edge.get("target")
            if source in adj and target in in_degree:
                key = (source, target)
                if key in seen:
                    continue
                seen.add(key)
                adj[source].append(target)
                in_degree[target] += 1
        queue = [node["id"] for node in nodes if in_degree[node["id"]] == 0]
        ordered: List[str] = []
        while queue:
            current = queue.pop(0)
            ordered.append(current)
            for nxt in adj[current]:
                in_degree[nxt] -= 1
                if in_degree[nxt] == 0:
                    queue.append(nxt)
        if len(ordered) != len(nodes):
            raise ValueError("The pipeline flow contains a loop. Remove the cycle and run the pipeline again.")
        return ordered

    def _incoming_data_map(self, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        incoming = {node["id"]: [] for node in nodes}
        for edge in edges:
            if self._edge_kind(edge) == EDGE_KIND_DATA and edge.get("target") in incoming:
                incoming[edge["target"]].append(edge)
        return incoming

    def _capture_scope_for_node(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        target_node_id: str,
    ) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        node_ids = {node["id"] for node in nodes}
        if target_node_id not in node_ids:
            raise ValueError(f"Script preview target node '{target_node_id}' was not found in the pipeline graph.")

        upstream_ids = {target_node_id}
        pending = [target_node_id]
        while pending:
            current_id = pending.pop(0)
            for edge in edges:
                if self._edge_kind(edge) != EDGE_KIND_DATA:
                    continue
                if edge.get("target") != current_id:
                    continue
                source_id = edge.get("source")
                if source_id in node_ids and source_id not in upstream_ids:
                    upstream_ids.add(source_id)
                    pending.append(source_id)

        scoped_nodes = [node for node in nodes if node["id"] in upstream_ids]
        scoped_edges = [
            edge
            for edge in edges
            if self._edge_kind(edge) == EDGE_KIND_DATA
            and edge.get("source") in upstream_ids
            and edge.get("target") in upstream_ids
        ]
        return scoped_nodes, scoped_edges

    def _resolve_session_dataframe(self, session_id: Optional[str]) -> Optional[pl.DataFrame]:
        session = self.session_store.get(session_id) if session_id else None
        dataframe = getattr(session, "df", None)
        return dataframe.clone() if isinstance(dataframe, pl.DataFrame) else None

    def _resolve_matching_session(self, matching_session_id: Optional[str]) -> Optional[Any]:
        session = self.session_store.get(matching_session_id) if matching_session_id else None
        return session if hasattr(session, "datasets") else None

    def _get_source_config(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        source_config = data.get("sourceConfig") or data.get("source_config") or data.get("source")
        return source_config if isinstance(source_config, dict) else None

    def _resolve_uploaded_file_path(self, stored_name: str) -> str:
        safe_name = os.path.basename(str(stored_name or "").strip())
        if not safe_name:
            raise ValueError("The saved dataset source is missing its stored file reference.")

        uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", UPLOAD_DIR))
        file_path = os.path.abspath(os.path.join(uploads_dir, safe_name))
        if os.path.commonpath([uploads_dir, file_path]) != uploads_dir:
            raise ValueError("The saved dataset source path is invalid.")
        if not os.path.exists(file_path):
            raise ValueError(f"The saved dataset source '{safe_name}' no longer exists on the server.")
        return file_path

    async def _load_dataframe_from_database_source(self, source_config: Dict[str, Any]) -> pl.DataFrame:
        if not self.user_email:
            raise ValueError("Database-backed pipeline sources require an authenticated pipeline owner.")

        connection_id = source_config.get("connection_id") or source_config.get("connectionId")
        query = str(source_config.get("query") or "").strip()
        if not connection_id or not query:
            raise ValueError("The saved database source is missing its connection or query details.")

        from database import db
        from history import _build_connection_string_from_dict
        from sqlalchemy import create_engine

        conn_data = await db.get_connection(connection_id, self.user_email)
        if not conn_data:
            raise ValueError("The saved database connection for this pipeline could not be found.")

        conn_str = _build_connection_string_from_dict(conn_data)
        try:
            return pl.read_database(query, conn_str)
        except Exception:
            engine_db = create_engine(conn_str)
            try:
                pdf = pd.read_sql(query, engine_db)
                return pl.from_pandas(pdf)
            finally:
                engine_db.dispose()

    async def _load_source_dataframe(self, source_config: Dict[str, Any]) -> pl.DataFrame:
        cache_key = json.dumps(source_config, sort_keys=True, default=str)
        cached = self._source_cache.get(cache_key)
        if isinstance(cached, pl.DataFrame):
            return cached.clone()

        source_type = str(source_config.get("type") or "").strip().lower()
        if source_type == "file":
            file_path = self._resolve_uploaded_file_path(
                source_config.get("stored_file_name") or source_config.get("storedFileName") or ""
            )
            delimiter = source_config.get("delimiter") or source_config.get("sep") or ","
            loader = PolarsValidationEngine(f"{self.session_id}_source")
            loader.load_data(file_path=file_path, sep=delimiter)
            if loader.df is None:
                raise ValueError("The saved file source could not be reloaded for this pipeline.")
            dataframe = loader.df.clone()
        elif source_type == "database":
            dataframe = await self._load_dataframe_from_database_source(source_config)
        else:
            raise ValueError(f"Unsupported pipeline source type '{source_type}'.")

        self._source_cache[cache_key] = dataframe.clone()
        return dataframe.clone()

    def _dataframe_from_records(self, records: Optional[List[Dict[str, Any]]], columns: Optional[List[str]] = None) -> pl.DataFrame:
        if records:
            return pl.from_dicts(records)
        if columns:
            return pl.DataFrame({column: [] for column in columns})
        return pl.DataFrame()

    def _collect_inputs(self, node_id: str, incoming_map: Dict[str, List[Dict[str, Any]]], node_outputs: Dict[str, pl.DataFrame]) -> List[pl.DataFrame]:
        datasets: List[pl.DataFrame] = []
        for edge in incoming_map.get(node_id, []):
            source_df = node_outputs.get(edge.get("source"))
            if isinstance(source_df, pl.DataFrame):
                datasets.append(source_df.clone())
        return datasets

    def _collect_input_bindings(
        self,
        node_id: str,
        incoming_map: Dict[str, List[Dict[str, Any]]],
        node_outputs: Dict[str, pl.DataFrame],
        node_map: Dict[str, Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        bindings: List[Dict[str, Any]] = []
        for edge in incoming_map.get(node_id, []):
            source_id = edge.get("source")
            source_df = node_outputs.get(source_id)
            if not isinstance(source_df, pl.DataFrame):
                continue
            source_node = node_map.get(source_id, {})
            source_data = source_node.get("data", {}) if isinstance(source_node, dict) else {}
            bindings.append({
                "source_node_id": source_id,
                "source_label": source_data.get("label") or source_id or "Connected Dataset",
                "dataframe": source_df.clone(),
            })
        return bindings

    async def _resolve_local_dataset(self, node_type: str, data: Dict[str, Any]) -> Optional[pl.DataFrame]:
        session_df = self._resolve_session_dataframe(data.get("sessionId"))
        if session_df is not None:
            return session_df
        source_config = self._get_source_config(data)
        if source_config:
            return await self._load_source_dataframe(source_config)
        if node_type == "dataset" and self.initial_df is not None:
            return self.initial_df.clone()
        return None

    def _require_dataframe(self, node_type: str, node_id: str, datasets: List[pl.DataFrame]) -> pl.DataFrame:
        if not datasets:
            raise ValueError(f"{node_type.title()} node '{node_id}' needs a connected Data Flow input.")
        return datasets[0].clone()

    def _coerce_value(self, value: Any) -> Any:
        if not isinstance(value, str):
            return value
        value = value.strip()
        if value == "":
            return ""
        if value.lower() == "true":
            return True
        if value.lower() == "false":
            return False
        if value.lower() == "null":
            return None
        if re.fullmatch(r"-?\d+", value):
            return int(value)
        if re.fullmatch(r"-?\d+\.\d+", value):
            return float(value)
        return value

    def _apply_filter_rules(self, dataframe: pl.DataFrame, rules: List[Dict[str, Any]]) -> pl.DataFrame:
        if not rules:
            return dataframe.clone()
        expressions = []
        for rule in rules:
            column, condition = rule.get("column"), rule.get("condition", "equals")
            value = self._coerce_value(rule.get("value"))
            if not column or column not in dataframe.columns:
                continue
            series = pl.col(column)
            if condition == "equals":
                expressions.append(series == value)
            elif condition == "not_equals":
                expressions.append(series != value)
            elif condition == "contains":
                expressions.append(series.cast(pl.Utf8).str.contains(re.escape(str(value)), literal=True))
            elif condition == "greater_than":
                expressions.append(series > value)
            elif condition == "less_than":
                expressions.append(series < value)
            elif condition == "is_null":
                expressions.append(series.is_null() | (series.cast(pl.Utf8) == ""))
        if not expressions:
            return dataframe.clone()
        combined = expressions[0]
        for expression in expressions[1:]:
            combined = combined & expression
        return dataframe.filter(combined)

    def _apply_aggregate(self, dataframe: pl.DataFrame, config: Dict[str, Any]) -> pl.DataFrame:
        group_by_column = config.get("groupByColumn")
        agg_function = str(config.get("aggFunction", "")).lower()
        target_column = config.get("targetColumn")
        if not group_by_column or group_by_column not in dataframe.columns:
            raise ValueError("Aggregate node needs a valid group-by column.")
        if agg_function == "count":
            expression = pl.len().alias("count")
        else:
            if not target_column or target_column not in dataframe.columns:
                raise ValueError("Aggregate node needs a valid target column.")
            alias = f"{agg_function}_{target_column}"
            if agg_function == "sum":
                expression = pl.col(target_column).sum().alias(alias)
            elif agg_function == "avg":
                expression = pl.col(target_column).mean().alias(alias)
            elif agg_function == "min":
                expression = pl.col(target_column).min().alias(alias)
            elif agg_function == "max":
                expression = pl.col(target_column).max().alias(alias)
            else:
                raise ValueError(f"Unsupported aggregation function: {agg_function}")
        return dataframe.group_by(group_by_column).agg(expression)

    def _apply_join(self, datasets: List[pl.DataFrame], config: Dict[str, Any]) -> pl.DataFrame:
        if len(datasets) < 2:
            raise ValueError("Dataset Join needs two connected Data Flow inputs.")
        left_key = config.get("leftKey")
        right_key = config.get("rightKey") or left_key
        join_type = {"inner": "inner", "left": "left", "right": "right", "outer": "full"}.get(str(config.get("joinType", "inner")).lower(), "inner")
        left_df, right_df = datasets[0], datasets[1]
        if left_key not in left_df.columns:
            raise ValueError(f"Join key '{left_key}' is missing from the left dataset.")
        if right_key not in right_df.columns:
            raise ValueError(f"Join key '{right_key}' is missing from the right dataset.")
        return left_df.join(right_df, left_on=left_key, right_on=right_key, how=join_type)

    def _apply_deduplicate(self, dataframe: pl.DataFrame, config: Dict[str, Any]) -> pl.DataFrame:
        subset = [column for column in config.get("subsetColumns", []) if column in dataframe.columns]
        return dataframe.unique(subset=subset or None, keep="first", maintain_order=True)

    def _apply_condition(self, dataframe: pl.DataFrame, expression: str) -> pl.DataFrame:
        expression = (expression or "").strip()
        if not expression:
            return dataframe.clone()
        pdf = dataframe.to_pandas()
        try:
            result = eval(expression, {"__builtins__": {}}, {"df": pdf})
        except Exception:
            try:
                return pl.from_pandas(pdf.query(expression, engine="python").reset_index(drop=True))
            except Exception as exc:
                raise ValueError(f"Conditional expression failed: {exc}") from exc
        if isinstance(result, pd.DataFrame):
            return pl.from_pandas(result.reset_index(drop=True))
        if isinstance(result, pd.Series):
            return pl.from_pandas(pdf[result].reset_index(drop=True))
        if isinstance(result, list) and len(result) == len(pdf):
            return pl.from_pandas(pdf[result].reset_index(drop=True))
        raise ValueError("Conditional expression must return a filtered dataframe or boolean mask.")

    def _resolve_script_language(self, node_type: str, data: Dict[str, Any]) -> str:
        explicit_language = str(data.get("scriptLanguage") or data.get("language") or "").strip().lower()
        if explicit_language in {"sql", "python"}:
            return explicit_language
        if node_type == "python":
            return "python"
        if node_type == "sql":
            return "sql"
        if str(data.get("pythonCode") or "").strip() and not str(data.get("sqlQuery") or "").strip():
            return "python"
        return "sql"

    def _resolve_script_code(self, node_type: str, data: Dict[str, Any]) -> str:
        script_code = str(data.get("scriptCode") or "").strip()
        if script_code:
            return script_code
        language = self._resolve_script_language(node_type, data)
        if language == "python":
            return str(data.get("pythonCode") or "").strip()
        return str(data.get("sqlQuery") or "").strip()

    def _prepare_sql_query(self, query: str) -> Dict[str, Any]:
        normalized_query = (query or "").strip()
        if not normalized_query:
            raise ValueError("SQL task is empty.")

        notes: List[str] = []
        top_match = re.match(r"(?is)^\s*select\s+(distinct\s+)?top\s*\(?\s*(\d+)\s*\)?\s+", normalized_query)
        if top_match:
            distinct_prefix = top_match.group(1) or ""
            limit_value = top_match.group(2)
            remainder = normalized_query[top_match.end():].lstrip()
            had_trailing_semicolon = normalized_query.rstrip().endswith(";")
            normalized_query = f"SELECT {distinct_prefix}{remainder}".rstrip().rstrip(";")
            if not re.search(r"(?is)\blimit\s+\d+\s*$", normalized_query):
                normalized_query = f"{normalized_query}\nLIMIT {limit_value}"
            if had_trailing_semicolon:
                normalized_query = f"{normalized_query};"
            notes.append(
                f"Rewrote SQL Server TOP syntax to LIMIT {limit_value} so the script runs in DuckDB."
            )

        return {
            "query": normalized_query,
            "notes": notes,
        }

    def _register_script_dataframe(self, connection: duckdb.DuckDBPyConnection, dataframe: pl.DataFrame) -> None:
        pandas_frame = dataframe.to_pandas()
        for alias in ("input_df", "df", "incoming_data", "incoming_dataset"):
            connection.register(alias, pandas_frame)

    def _validate_sql(self, dataframe: pl.DataFrame, query: str) -> Dict[str, Any]:
        prepared = self._prepare_sql_query(query)
        normalized_query = prepared["query"]
        connection = duckdb.connect(database=":memory:")
        try:
            self._register_script_dataframe(connection, dataframe)
            connection.execute(f"EXPLAIN {normalized_query.rstrip().rstrip(';')}")
        except Exception as exc:
            raise ValueError(f"SQL syntax check failed: {exc}") from exc
        finally:
            connection.close()

        return {
            "language": "sql",
            "normalized_script": normalized_query,
            "notes": prepared["notes"],
            "message": "SQL syntax is valid.",
        }

    def _execute_sql(self, dataframe: pl.DataFrame, query: str) -> pl.DataFrame:
        prepared = self._prepare_sql_query(query)
        normalized_query = prepared["query"]
        connection = duckdb.connect(database=":memory:")
        try:
            self._register_script_dataframe(connection, dataframe)
            cursor = connection.execute(normalized_query)
            if cursor.description is None:
                raise ValueError("SQL task must end with a SELECT statement that returns rows.")
            return pl.from_pandas(cursor.fetchdf().reset_index(drop=True))
        finally:
            connection.close()

    def _validate_python(self, python_code: str) -> Dict[str, Any]:
        python_code = (python_code or "").strip()
        if not python_code:
            raise ValueError("Python task is empty.")
        try:
            compile(python_code, "<pipeline-script>", "exec")
        except SyntaxError as exc:
            line_details = f"line {exc.lineno}" if exc.lineno else "unknown line"
            column_details = f", column {exc.offset}" if exc.offset else ""
            raise ValueError(f"Python syntax check failed at {line_details}{column_details}: {exc.msg}") from exc

        return {
            "language": "python",
            "normalized_script": python_code,
            "notes": [],
            "message": "Python syntax is valid.",
        }

    def _execute_python(self, dataframe: pl.DataFrame, python_code: str) -> pl.DataFrame:
        validation = self._validate_python(python_code)
        safe_builtins = {
            "abs": abs,
            "all": all,
            "any": any,
            "bool": bool,
            "dict": dict,
            "enumerate": enumerate,
            "Exception": Exception,
            "filter": filter,
            "float": float,
            "int": int,
            "isinstance": isinstance,
            "len": len,
            "list": list,
            "map": map,
            "max": max,
            "min": min,
            "next": next,
            "print": print,
            "range": range,
            "round": round,
            "set": set,
            "sorted": sorted,
            "str": str,
            "sum": sum,
            "TypeError": TypeError,
            "tuple": tuple,
            "ValueError": ValueError,
            "zip": zip,
        }
        local_scope = {
            "df": dataframe.clone(),
            "input_df": dataframe.clone(),
            "pl": pl,
            "pd": pd,
            "math": math,
            "json": json,
            "result": dataframe.clone(),
        }
        exec(validation["normalized_script"], {"__builtins__": safe_builtins}, local_scope)
        result = local_scope.get("result", local_scope.get("df"))
        if isinstance(result, pl.DataFrame):
            return result.clone()
        if isinstance(result, pd.DataFrame):
            return pl.from_pandas(result.reset_index(drop=True))
        if isinstance(result, dict):
            return self._dataframe_from_records([result])
        if isinstance(result, list):
            return self._dataframe_from_records(result)
        raise ValueError("Python task must leave a dataframe or list of records in 'result'.")

    def preview_script(
        self,
        dataframe: pl.DataFrame,
        *,
        node_type: str = "script",
        data: Optional[Dict[str, Any]] = None,
        validate_only: bool = False,
    ) -> Dict[str, Any]:
        data = data or {}
        language = self._resolve_script_language(node_type, data)
        script_code = self._resolve_script_code(node_type, data)

        if language == "python":
            validation = self._validate_python(script_code)
            if validate_only:
                return validation
            output_df = self._execute_python(dataframe, validation["normalized_script"])
        else:
            validation = self._validate_sql(dataframe, script_code)
            if validate_only:
                return validation
            output_df = self._execute_sql(dataframe, validation["normalized_script"])

        return {
            **validation,
            "output_df": output_df,
            "output_columns": output_df.columns,
            "output_row_count": len(output_df),
        }

    def _sanitize_filename(self, value: str, fallback: str) -> str:
        cleaned = re.sub(r"[^A-Za-z0-9_-]+", "_", (value or "").strip()).strip("_")
        return cleaned or fallback

    def _export_dataframe(self, dataframe: pl.DataFrame, config: Dict[str, Any], pipeline_name: str) -> str:
        export_format = str(config.get("outputFormat") or "xlsx").lower()
        if export_format not in {"xlsx", "csv", "json"}:
            export_format = "xlsx"
        os.makedirs("results", exist_ok=True)
        base_name = self._sanitize_filename(config.get("outputName") or pipeline_name or f"pipeline_out_{uuid.uuid4().hex[:8]}", "pipeline_output")
        out_path = os.path.join("results", f"{base_name}.{export_format}")
        if export_format == "csv":
            dataframe.write_csv(out_path)
        elif export_format == "json":
            with open(out_path, "w", encoding="utf-8") as handle:
                json.dump(dataframe.to_dicts(), handle, ensure_ascii=False, indent=2)
        else:
            dataframe.write_excel(out_path)
        return out_path

    def _send_webhook(self, node_id: str, data: Dict[str, Any], payload: Dict[str, Any]) -> Dict[str, str]:
        webhook_url = str(data.get("webhookUrl", "")).strip()
        method = str(data.get("httpMethod", "POST")).upper()
        if not webhook_url:
            return {"status": "skipped", "message": "Webhook skipped: Target URL is not configured."}
        try:
            request_url, body = webhook_url, None
            if method == "GET":
                query = urllib.parse.urlencode({"pipeline_name": payload.get("pipeline_name", ""), "node_id": node_id, "status": payload.get("status", ""), "row_count": payload.get("row_count", 0)})
                request_url = f"{webhook_url}{'&' if '?' in webhook_url else '?'}{query}" if query else webhook_url
            else:
                body = json.dumps(payload).encode("utf-8")
            request = urllib.request.Request(request_url, data=body, headers={"Content-Type": "application/json"}, method=method)
            with urllib.request.urlopen(request, timeout=20) as response:
                return {"status": "success", "message": f"Webhook returned HTTP {response.status}"}
        except urllib.error.HTTPError as exc:
            return {"status": "error", "message": f"Webhook failed with HTTP {exc.code}"}
        except Exception as exc:
            return {"status": "error", "message": f"Webhook failed: {exc}"}

    def _pick_context_dataframe(self, *candidates: Optional[pl.DataFrame]) -> Optional[pl.DataFrame]:
        for candidate in candidates:
            if isinstance(candidate, pl.DataFrame):
                return candidate
        return None

    async def execute_graph(
        self,
        config: Dict[str, Any],
        *,
        capture_inputs_for_node_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        nodes = config.get("nodes", [])
        edges = config.get("edges", [])
        pipeline_name = config.get("pipelineName", "Untitled Pipeline")
        if not nodes:
            return {"success": False, "error": "Pipeline graph is empty."}

        scoped_nodes = nodes
        scoped_edges = edges
        if capture_inputs_for_node_id:
            try:
                scoped_nodes, scoped_edges = self._capture_scope_for_node(
                    nodes,
                    edges,
                    capture_inputs_for_node_id,
                )
            except Exception as exc:
                return {"success": False, "error": str(exc)}

        try:
            ordered_ids = self._topological_sort(scoped_nodes, scoped_edges)
        except Exception as exc:
            return {"success": False, "error": str(exc)}

        node_map = {node["id"]: node for node in scoped_nodes}
        incoming_map = self._incoming_data_map(scoped_nodes, scoped_edges)
        node_outputs: Dict[str, pl.DataFrame] = {}
        run_logs: List[Dict[str, Any]] = []
        output_file_path: Optional[str] = None
        final_df: Optional[pl.DataFrame] = None

        def append_log(node_id: str, node_type: str, status: str, message: str):
            run_logs.append({"node": node_id, "type": node_type, "status": status, "message": message})

        async def local_first(node_type: str, data: Dict[str, Any], inputs: List[pl.DataFrame]) -> List[pl.DataFrame]:
            local_df = await self._resolve_local_dataset(node_type, data)
            return inputs or ([local_df] if local_df is not None else [])

        try:
            for node_id in ordered_ids:
                node = node_map[node_id]
                node_type = self._node_type(node)
                data = node.get("data", {})
                input_bindings = self._collect_input_bindings(node_id, incoming_map, node_outputs, node_map)
                input_datasets = [binding["dataframe"].clone() for binding in input_bindings]
                primary_df = input_datasets[0].clone() if input_datasets else None

                if capture_inputs_for_node_id and node_id == capture_inputs_for_node_id:
                    resolved_inputs = await local_first(node_type, data, input_datasets)
                    return {
                        "success": True,
                        "logs": run_logs,
                        "captured_node_id": node_id,
                        "captured_node_type": node_type,
                        "captured_inputs": [dataset.clone() for dataset in resolved_inputs],
                        "captured_input_bindings": [
                            {
                                "source_node_id": binding["source_node_id"],
                                "source_label": binding["source_label"],
                                "dataframe": binding["dataframe"].clone(),
                            }
                            for binding in input_bindings
                        ],
                    }

                if node_type == "dataset":
                    current_df = await self._resolve_local_dataset(node_type, data)
                    if current_df is None:
                        source_config = self._get_source_config(data)
                        session_id = data.get("sessionId")
                        if session_id and not source_config:
                            raise ValueError(
                                "Dataset Input node uses a temporary upload session that is no longer available. "
                                "To run this pipeline on a schedule, open the Dataset Input node in the pipeline builder, "
                                "re-upload your file, and save the pipeline again so the source file is stored persistently."
                            )
                        raise ValueError("Dataset Input node is configured without an available data source.")
                    node_outputs[node_id] = current_df.clone()
                    final_df = current_df.clone()
                    append_log(node_id, node_type, "success", f"Loaded {len(current_df)} rows from the configured dataset source")
                    continue

                if node_type == "scraper":
                    scraper = WebScraper(self.session_id)
                    scraper_config = {"template": data.get("template"), "url": data.get("url"), "urls": data.get("urls") or ([data.get("url")] if data.get("url") else []), "selectors": data.get("selectors", {})}
                    result = await scraper.execute(scraper_config)
                    if not result.success:
                        raise ValueError(result.error)
                    current_df = self._dataframe_from_records(result.data)
                    node_outputs[node_id] = current_df.clone()
                    final_df = current_df.clone()
                    append_log(node_id, node_type, "success", f"Created {len(current_df)} rows from {len(scraper_config['urls'])} configured URL(s)")
                    continue

                if node_type == "cleaner":
                    resolved_inputs = await local_first(node_type, data, input_datasets)
                    current_df = self._require_dataframe(node_type, node_id, resolved_inputs)
                    cleaner = DataCleaner(self.session_id)
                    cleaner.df = current_df
                    result = await cleaner.execute({"rules": data.get("rules", [])})
                    if not result.success:
                        raise ValueError(result.error)
                    next_df = self._dataframe_from_records(result.data, current_df.columns)
                    node_outputs[node_id] = next_df.clone()
                    final_df = next_df.clone()
                    append_log(node_id, node_type, "success", f"Applied {len(data.get('rules', []))} cleaning operation(s) to {len(next_df)} rows")
                    continue

                if node_type == "validation":
                    current_df = self._require_dataframe(node_type, node_id, await local_first(node_type, data, input_datasets))
                    rules = [ValidationRule(**rule) for rule in data.get("rules", [])]
                    engine = PolarsValidationEngine(self.session_id)
                    engine.load_data(dataframe=current_df)
                    result = engine.validate(rules)
                    node_outputs[node_id] = current_df.clone()
                    final_df = current_df.clone()
                    append_log(node_id, node_type, "success", f"Validated {result.get('total_rows', 0)} rows: {result.get('valid_rows', 0)} valid, {result.get('invalid_rows', 0)} invalid")
                    continue

                if node_type == "mapper":
                    current_df = self._require_dataframe(node_type, node_id, await local_first(node_type, data, input_datasets))
                    mapper = SchemaMapper(self.session_id)
                    mapper.df = current_df
                    result = await mapper.execute({"mappings": data.get("mappings", {}), "transformations": data.get("columnTransforms", {}), "concatenations": data.get("concatenations", {}), "aggregations": data.get("aggregations", {})})
                    if not result.success:
                        raise ValueError(result.error)
                    columns = result.metadata.get("columns") if isinstance(result.metadata, dict) else None
                    next_df = self._dataframe_from_records(result.data, columns)
                    node_outputs[node_id] = next_df.clone()
                    final_df = next_df.clone()
                    append_log(node_id, node_type, "success", f"Mapped {len(current_df.columns)} source columns into {len(next_df.columns)} output columns")
                    continue

                if node_type == "matching":
                    matcher_session = self._resolve_matching_session(data.get("matchingSessionId"))
                    dataset_1 = input_datasets[0].clone() if len(input_datasets) >= 1 else None
                    dataset_2 = input_datasets[1].clone() if len(input_datasets) >= 2 else None
                    if matcher_session is not None:
                        if dataset_1 is None:
                            dataset_1 = matcher_session.datasets.get("dataset1")
                        if dataset_2 is None:
                            dataset_2 = matcher_session.datasets.get("dataset2")
                    if dataset_1 is None or dataset_2 is None:
                        raise ValueError("Data Matching needs two connected datasets or a saved matching workspace.")
                    matcher = DataMatcher(data.get("matchingSessionId") or f"{self.session_id}_{node_id}")
                    matcher.load_dataset("dataset1", dataset_1)
                    matcher.load_dataset("dataset2", dataset_2)
                    result = await matcher.execute({"dataset1": "dataset1", "dataset2": "dataset2", "rules": data.get("matchRules", []), "output_columns": data.get("outputColumns", {"dataset1": dataset_1.columns, "dataset2": dataset_2.columns})})
                    if not result.success:
                        raise ValueError(result.error)
                    next_df = self._dataframe_from_records(result.data)
                    node_outputs[node_id] = next_df.clone()
                    final_df = next_df.clone()
                    append_log(node_id, node_type, "success", f"Generated {len(next_df)} matching result row(s)")
                    continue

                if node_type == "filter":
                    current_df = self._require_dataframe(node_type, node_id, await local_first(node_type, data, input_datasets))
                    next_df = self._apply_filter_rules(current_df, data.get("filterRules", []))
                    node_outputs[node_id] = next_df.clone()
                    final_df = next_df.clone()
                    append_log(node_id, node_type, "success", f"Filtered {len(current_df)} rows down to {len(next_df)} rows")
                    continue

                if node_type == "aggregate":
                    current_df = self._require_dataframe(node_type, node_id, await local_first(node_type, data, input_datasets))
                    next_df = self._apply_aggregate(current_df, data)
                    node_outputs[node_id] = next_df.clone()
                    final_df = next_df.clone()
                    append_log(node_id, node_type, "success", f"Aggregated {len(current_df)} input rows into {len(next_df)} grouped row(s)")
                    continue

                if node_type == "join":
                    next_df = self._apply_join(input_datasets, data)
                    node_outputs[node_id] = next_df.clone()
                    final_df = next_df.clone()
                    append_log(node_id, node_type, "success", f"Joined {len(input_datasets[0])} left rows with {len(input_datasets[1])} right rows into {len(next_df)} row(s)")
                    continue

                if node_type == "deduplicate":
                    current_df = self._require_dataframe(node_type, node_id, await local_first(node_type, data, input_datasets))
                    next_df = self._apply_deduplicate(current_df, data)
                    node_outputs[node_id] = next_df.clone()
                    final_df = next_df.clone()
                    append_log(node_id, node_type, "success", f"Removed duplicates and kept {len(next_df)} unique row(s)")
                    continue

                if node_type == "transformer":
                    current_df = self._require_dataframe(node_type, node_id, await local_first(node_type, data, input_datasets))
                    transformer_steps = data.get("transformerSteps", [])
                    if not transformer_steps:
                        node_outputs[node_id] = current_df.clone()
                        final_df = current_df.clone()
                        append_log(node_id, node_type, "skipped", "No transformation steps configured — dataset passed through unchanged.")
                        continue
                    t = DataTransformer(self.session_id)
                    t.df = current_df.clone()
                    if input_bindings:
                        for lookup_binding in input_bindings[1:]:
                            t.register_lookup(
                                str(lookup_binding["source_node_id"]),
                                str(lookup_binding["source_label"]),
                                lookup_binding["dataframe"].clone(),
                            )
                    result = t._execute_steps({"steps": transformer_steps}, preview_limit=None)
                    if not result.success:
                        raise ValueError(result.error or "Transformation failed")
                    next_df = pl.from_dicts(result.data) if result.data else current_df
                    node_outputs[node_id] = next_df.clone()
                    final_df = next_df.clone()
                    step_count = len(transformer_steps)
                    append_log(node_id, node_type, "success", f"Applied {step_count} transformation step(s): {len(current_df)} → {len(next_df)} rows, {len(next_df.columns)} cols")
                    continue

                if node_type == "conditional":
                    current_df = self._require_dataframe(node_type, node_id, await local_first(node_type, data, input_datasets))
                    next_df = self._apply_condition(current_df, data.get("conditionExpression", ""))
                    node_outputs[node_id] = next_df.clone()
                    final_df = next_df.clone()
                    append_log(node_id, node_type, "success", f"Conditional branch passed {len(next_df)} of {len(current_df)} row(s)")
                    continue

                if node_type == "loop":
                    current_df = self._require_dataframe(node_type, node_id, await local_first(node_type, data, input_datasets))
                    chunk_size = max(int(data.get("chunkSize") or 100), 1)
                    chunk_count = math.ceil(len(current_df) / chunk_size) if len(current_df) else 0
                    node_outputs[node_id] = current_df.clone()
                    final_df = current_df.clone()
                    append_log(node_id, node_type, "success", f"Prepared {chunk_count} iteration batch(es) at {chunk_size} row(s) per chunk")
                    continue

                if node_type in {"sql", "python", "script"}:
                    current_df = self._require_dataframe(node_type, node_id, await local_first(node_type, data, input_datasets))
                    script_preview = self.preview_script(current_df, node_type=node_type, data=data, validate_only=False)
                    next_df = script_preview["output_df"]
                    node_outputs[node_id] = next_df.clone()
                    final_df = next_df.clone()
                    append_log(
                        node_id,
                        node_type,
                        "success",
                        f"{script_preview['language'].title()} script returned {len(next_df)} row(s)",
                    )
                    continue

                if node_type == "email":
                    context_df = self._pick_context_dataframe(primary_df, final_df, self.initial_df)
                    to_email = str(data.get("toEmail", "")).strip()
                    subject = str(data.get("emailSubject", "Pipeline Alert")).strip()
                    body = str(data.get("emailBody", "")).strip()
                    today = datetime.now().strftime("%Y-%m-%d %H:%M")
                    row_count = str(len(context_df) if isinstance(context_df, pl.DataFrame) else 0)
                    status_text = "Success" if all(log.get("status") == "success" for log in run_logs) else "Partial"

                    def resolve(text: str) -> str:
                        return text.replace("{{TODAY_DATE}}", today).replace("{{STATUS}}", status_text).replace("{{ROW_COUNT}}", row_count).replace("{{PIPELINE_NAME}}", pipeline_name)

                    subject = resolve(subject)
                    body = resolve(body) or f"Pipeline '{pipeline_name}' completed on {today}.\nStatus: {status_text}\nRows processed: {row_count}"

                    if not to_email:
                        append_log(node_id, node_type, "skipped", "Email skipped: Recipient email address is not configured.")
                    else:
                        try:
                            from email_utils import send_pipeline_email
                            result = send_pipeline_email(to_email=to_email, subject=subject, body=body, pipeline_name=pipeline_name)
                            append_log(node_id, node_type, "success" if result.get("success") else "error", f"Email sent to {to_email} via Resend" if result.get("success") else f"Email failed: {result.get('error', 'Unknown error')}")
                        except Exception as exc:
                            append_log(node_id, node_type, "error", f"Email failed: {exc}")
                    continue

                if node_type == "webhook":
                    context_df = self._pick_context_dataframe(primary_df, final_df, self.initial_df)
                    payload = {
                        "pipeline_name": pipeline_name,
                        "node_id": node_id,
                        "status": "success",
                        "row_count": len(context_df) if isinstance(context_df, pl.DataFrame) else 0,
                        "columns": context_df.columns if isinstance(context_df, pl.DataFrame) else [],
                        "preview_rows": context_df.head(10).to_dicts() if isinstance(context_df, pl.DataFrame) else [],
                    }
                    webhook_result = self._send_webhook(node_id, data, payload)
                    append_log(node_id, node_type, webhook_result["status"], webhook_result["message"])
                    continue

                if node_type == "export":
                    current_df = self._require_dataframe(node_type, node_id, await local_first(node_type, data, input_datasets))
                    output_file_path = self._export_dataframe(current_df, data, pipeline_name)
                    final_df = current_df.clone()
                    append_log(node_id, node_type, "success", f"Exported to {os.path.basename(output_file_path)}")
                    continue

                append_log(node_id, node_type, "skipped", f"Pipeline execution for '{node_type}' nodes is not implemented yet")

            if final_df is None:
                return {"success": False, "error": "No dataset was produced by the pipeline.", "logs": run_logs}

            return {
                "success": True,
                "logs": run_logs,
                "preview_data": final_df.head(100).to_dicts(),
                "output_file": output_file_path,
                "output_columns": final_df.columns,
                "output_row_count": len(final_df),
                "output_df": final_df,
            }
        except Exception as exc:
            logger.warning("Pipeline execution failed: %s", exc)
            return {"success": False, "error": str(exc), "logs": run_logs}
