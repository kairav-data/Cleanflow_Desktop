"""
Data Transformation Engine for CleanFlow
All operations implemented using Polars.
Supports N lookup datasets for complex multi-dataset joins.
"""

from typing import Dict, List, Any, Optional, Tuple
import re
import polars as pl
from .base import BaseFeature, FeatureResult


_TYPE_MAP = {
    "String": pl.Utf8,
    "Int32": pl.Int32,
    "Int64": pl.Int64,
    "Float32": pl.Float32,
    "Float64": pl.Float64,
    "Boolean": pl.Boolean,
    "Date": pl.Date,
    "Datetime": pl.Datetime,
}

_JOIN_MAP = {
    "left": "left",
    "inner": "inner",
    "right": "right",
    "full": "full",
    "semi": "semi",
    "anti": "anti",
}

_OP_MAP = {"==", "!=", ">", ">=", "<", "<=", "contains", "starts_with", "ends_with", "is_null", "is_not_null"}


class DataTransformer(BaseFeature):
    """Data Transformation feature — low-code/no-code approach using Polars."""

    CATEGORIES: List[Dict[str, Any]] = [
        {"id": "structural", "name": "Structural",      "icon": "Columns",    "color": "#6366f1", "desc": "Rename, drop, reorder, add columns"},
        {"id": "values",     "name": "Value Updates",   "icon": "Edit3",      "color": "#059669", "desc": "Set, update, replace, fill values"},
        {"id": "rows",       "name": "Row Operations",  "icon": "Rows",       "color": "#dc2626", "desc": "Delete, deduplicate, sort, limit rows"},
        {"id": "types",      "name": "Type & Format",   "icon": "Type",       "color": "#d97706", "desc": "Cast types, date formats, extract parts"},
        {"id": "lookup",     "name": "Lookup / Join",   "icon": "Link",       "color": "#7c3aed", "desc": "Join with N uploaded reference datasets"},
        {"id": "string",     "name": "String",          "icon": "AlignLeft",  "color": "#0891b2", "desc": "Trim, case, substring, concat, split, pad"},
        {"id": "math",       "name": "Math & Formula",  "icon": "Calculator", "color": "#db2777", "desc": "Round, abs, formula-based computed columns"},
    ]

    OPERATIONS: List[Dict[str, Any]] = [
        # ─── Structural ───────────────────────────────────────────
        {
            "id": "rename_column", "name": "Rename Column", "category": "structural",
            "description": "Rename an existing column to a new name.",
            "params": [
                {"key": "column",   "label": "Source Column", "type": "column_select"},
                {"key": "new_name", "label": "New Name",       "type": "text", "placeholder": "new_column_name"},
            ],
        },
        {
            "id": "drop_column", "name": "Drop Column(s)", "category": "structural",
            "description": "Remove one or more columns from the dataset permanently.",
            "params": [
                {"key": "columns", "label": "Columns to Drop", "type": "multi_column_select"},
            ],
        },
        {
            "id": "reorder_columns", "name": "Reorder Columns", "category": "structural",
            "description": "Drag columns into the desired order — remaining columns are appended.",
            "params": [
                {"key": "column_order", "label": "New Column Order", "type": "column_order"},
            ],
        },
        {
            "id": "add_computed_column", "name": "Add Computed Column", "category": "structural",
            "description": "Add a new column derived from an arithmetic expression over existing columns.",
            "params": [
                {"key": "new_name",    "label": "New Column Name", "type": "text", "placeholder": "computed_col"},
                {"key": "expression",  "label": "Expression",      "type": "expression", "placeholder": "price * 1.18 - discount"},
            ],
        },
        # ─── Value Updates ────────────────────────────────────────
        {
            "id": "set_value", "name": "Set Hardcoded Value", "category": "values",
            "description": "Overwrite every row in a column with a fixed literal value.",
            "params": [
                {"key": "column", "label": "Column", "type": "column_select"},
                {"key": "value",  "label": "Value",  "type": "text", "placeholder": "e.g. 0 or N/A"},
            ],
        },
        {
            "id": "update_conditional", "name": "Update Values (Conditional)", "category": "values",
            "description": "WHEN a condition is met THEN set a value, ELSE keep original or set another.",
            "params": [
                {"key": "column",           "label": "Column to Update",     "type": "column_select"},
                {"key": "condition_column", "label": "Condition Column",      "type": "column_select"},
                {"key": "condition_op",     "label": "Operator",              "type": "dropdown",
                 "options": ["==","!=",">",">=","<","<=","contains","starts_with","ends_with","is_null","is_not_null"]},
                {"key": "condition_value",  "label": "Condition Value",       "type": "text", "placeholder": "e.g. Active"},
                {"key": "then_value",       "label": "Then Set To",           "type": "text", "placeholder": "new value"},
                {"key": "else_value",       "label": "Else Set To (optional)","type": "text", "placeholder": "leave blank to keep original", "optional": True},
            ],
        },
        {
            "id": "replace_value", "name": "Replace Value", "category": "values",
            "description": "Find and replace values inside a column — exact, partial, or regex match.",
            "params": [
                {"key": "column",      "label": "Column",       "type": "column_select"},
                {"key": "target",      "label": "Find",         "type": "text", "placeholder": "old value"},
                {"key": "replacement", "label": "Replace With", "type": "text", "placeholder": "new value"},
                {"key": "match_type",  "label": "Match Type",   "type": "dropdown", "options": ["exact","partial","regex"]},
            ],
        },
        {
            "id": "fill_nulls", "name": "Fill Null Values", "category": "values",
            "description": "Fill missing / null cells using a statistical method or a fixed value.",
            "params": [
                {"key": "column",       "label": "Column",                         "type": "column_select"},
                {"key": "method",       "label": "Fill Method",                    "type": "dropdown",
                 "options": ["custom","mean","median","min","max","forward_fill","backward_fill"]},
                {"key": "custom_value", "label": "Custom Value (method = custom)", "type": "text", "optional": True, "placeholder": "0"},
            ],
        },
        # ─── Row Operations ───────────────────────────────────────
        {
            "id": "filter_rows", "name": "Delete Rows by Condition", "category": "rows",
            "description": "Remove all rows that match the condition (inverse filter — rows NOT matching are kept).",
            "params": [
                {"key": "column", "label": "Column",   "type": "column_select"},
                {"key": "op",     "label": "Operator", "type": "dropdown",
                 "options": ["==","!=",">",">=","<","<=","contains","starts_with","ends_with","is_null","is_not_null"]},
                {"key": "value",  "label": "Value",    "type": "text", "placeholder": "e.g. Inactive"},
            ],
        },
        {
            "id": "deduplicate", "name": "Deduplicate Rows", "category": "rows",
            "description": "Remove duplicate rows across all columns or a subset of key columns.",
            "params": [
                {"key": "subset", "label": "Key Columns (empty = all)", "type": "multi_column_select", "optional": True},
                {"key": "keep",   "label": "Keep",   "type": "dropdown", "options": ["first","last","none"]},
            ],
        },
        {
            "id": "sort_rows", "name": "Sort Rows", "category": "rows",
            "description": "Sort the dataset by one or more columns ascending or descending.",
            "params": [
                {"key": "columns",    "label": "Sort By",   "type": "multi_column_select"},
                {"key": "descending", "label": "Direction", "type": "dropdown", "options": ["ascending","descending"]},
                {"key": "nulls_last", "label": "Nulls",     "type": "dropdown", "options": ["nulls_last","nulls_first"]},
            ],
        },
        {
            "id": "limit_rows", "name": "Limit / Sample Rows", "category": "rows",
            "description": "Keep only the first N, last N, or a random sample of N rows.",
            "params": [
                {"key": "mode", "label": "Mode", "type": "dropdown", "options": ["head","tail","sample"]},
                {"key": "n",    "label": "N",    "type": "number", "placeholder": "100"},
            ],
        },
        # ─── Type & Format ────────────────────────────────────────
        {
            "id": "cast_type", "name": "Cast Column Type", "category": "types",
            "description": "Convert a column to a different Polars data type (failed conversions → null).",
            "params": [
                {"key": "column",      "label": "Column",      "type": "column_select"},
                {"key": "target_type", "label": "Target Type", "type": "dropdown",
                 "options": ["String","Int32","Int64","Float32","Float64","Boolean","Date","Datetime"]},
            ],
        },
        {
            "id": "change_date_format", "name": "Change Date Format", "category": "types",
            "description": "Parse a string column as a date then re-serialize it in a new format.",
            "params": [
                {"key": "column",              "label": "Column",                   "type": "column_select"},
                {"key": "input_format",        "label": "Input Format",             "type": "dropdown",
                 "options": ["%Y-%m-%d","%d/%m/%Y","%m/%d/%Y","%d-%m-%Y","%Y%m%d","%d %b %Y","custom"]},
                {"key": "input_format_custom", "label": "Custom Input Format",      "type": "text", "optional": True, "placeholder": "%d.%m.%Y"},
                {"key": "output_format",       "label": "Output Format",            "type": "dropdown",
                 "options": ["%Y-%m-%d","%d/%m/%Y","%m/%d/%Y","%d-%m-%Y","%d %b %Y","%B %d, %Y","custom"]},
                {"key": "output_format_custom","label": "Custom Output Format",     "type": "text", "optional": True, "placeholder": "%B %d, %Y"},
            ],
        },
        {
            "id": "extract_date_part", "name": "Extract Date Part", "category": "types",
            "description": "Extract year, month, day, weekday etc. from a date column into a new column.",
            "params": [
                {"key": "column",       "label": "Date Column",                    "type": "column_select"},
                {"key": "part",         "label": "Extract",                        "type": "dropdown",
                 "options": ["year","month","day","hour","minute","second","weekday","quarter","week"]},
                {"key": "new_column",   "label": "New Column Name",                "type": "text", "placeholder": "date_year"},
                {"key": "input_format", "label": "Parse Format (if string col)",   "type": "text", "optional": True, "placeholder": "%Y-%m-%d"},
            ],
        },
        # ─── Lookup / Join ───────────────────────────────────────
        {
            "id": "lookup_join", "name": "Lookup Join", "category": "lookup",
            "description": "Join the main dataset with any uploaded reference/lookup dataset using any join type.",
            "params": [
                {"key": "lookup_id",     "label": "Lookup Dataset",                     "type": "lookup_select"},
                {"key": "left_key",      "label": "Left Key (main dataset)",             "type": "column_select"},
                {"key": "right_key",     "label": "Right Key (lookup dataset)",          "type": "lookup_column_select"},
                {"key": "join_type",     "label": "Join Type",                           "type": "dropdown",
                 "options": ["left","inner","right","full","semi","anti"]},
                {"key": "select_cols",   "label": "Columns to Pull (empty = all)",       "type": "lookup_multi_column_select", "optional": True},
                {"key": "suffix",        "label": "Suffix for conflicting columns",      "type": "text", "optional": True, "placeholder": "_lookup"},
            ],
        },
        # ─── String ───────────────────────────────────────────────
        {
            "id": "string_trim", "name": "Trim Whitespace", "category": "string",
            "description": "Strip leading, trailing, or both sides of whitespace from a text column.",
            "params": [
                {"key": "column", "label": "Column", "type": "column_select"},
                {"key": "side",   "label": "Side",   "type": "dropdown", "options": ["both","left","right"]},
            ],
        },
        {
            "id": "string_case", "name": "Change Case", "category": "string",
            "description": "Convert text to UPPER, lower, or Title Case.",
            "params": [
                {"key": "column", "label": "Column", "type": "column_select"},
                {"key": "case",   "label": "Case",   "type": "dropdown", "options": ["upper","lower","title"]},
            ],
        },
        {
            "id": "string_substring", "name": "Substring", "category": "string",
            "description": "Extract characters by position — specify start offset and character length.",
            "params": [
                {"key": "column",     "label": "Column",             "type": "column_select"},
                {"key": "offset",     "label": "Start (0-indexed)",  "type": "number", "placeholder": "0"},
                {"key": "length",     "label": "Length (0=to end)",  "type": "number", "placeholder": "10"},
                {"key": "new_column", "label": "Output Column Name", "type": "text", "optional": True, "placeholder": "leave blank to overwrite"},
            ],
        },
        {
            "id": "concat_columns", "name": "Concat Columns", "category": "string",
            "description": "Merge two or more columns into a single new text column with a separator.",
            "params": [
                {"key": "columns",    "label": "Columns to Concat", "type": "multi_column_select"},
                {"key": "separator",  "label": "Separator",         "type": "text", "placeholder": " "},
                {"key": "new_column", "label": "New Column Name",   "type": "text", "placeholder": "full_name"},
            ],
        },
        {
            "id": "split_column", "name": "Split Column", "category": "string",
            "description": "Split a column by a delimiter and extract part N (0=before first delimiter, 1=after first, -1=last part). Rows without the delimiter return null for any index ≥ 1.",
            "params": [
                {"key": "column",     "label": "Column",                  "type": "column_select"},
                {"key": "delimiter",  "label": "Delimiter",               "type": "text", "placeholder": ","},
                {"key": "index",      "label": "Part Index (0-based)",    "type": "number", "placeholder": "0"},
                {"key": "new_column", "label": "Output Column Name",      "type": "text", "placeholder": "first_part"},
            ],
        },
        {
            "id": "string_pad", "name": "Pad String", "category": "string",
            "description": "Pad a string column to a fixed width using a fill character.",
            "params": [
                {"key": "column",    "label": "Column",         "type": "column_select"},
                {"key": "width",     "label": "Total Width",    "type": "number", "placeholder": "10"},
                {"key": "fill_char", "label": "Fill Character", "type": "text",   "placeholder": "0"},
                {"key": "side",      "label": "Pad Side",       "type": "dropdown", "options": ["left","right"]},
            ],
        },
        # ─── Math ────────────────────────────────────────────────
        {
            "id": "math_round", "name": "Round Numbers", "category": "math",
            "description": "Round a numeric column to N decimal places.",
            "params": [
                {"key": "column",   "label": "Column",         "type": "column_select"},
                {"key": "decimals", "label": "Decimal Places", "type": "number", "placeholder": "2"},
            ],
        },
        {
            "id": "math_abs", "name": "Absolute Value", "category": "math",
            "description": "Replace all negative values with their absolute (positive) value.",
            "params": [
                {"key": "column", "label": "Column", "type": "column_select"},
            ],
        },
        {
            "id": "math_expression", "name": "Math Expression (Formula)", "category": "math",
            "description": "Create a new column from an arithmetic formula referencing existing columns.",
            "params": [
                {"key": "new_column",  "label": "New Column Name", "type": "text",       "placeholder": "total_price"},
                {"key": "expression",  "label": "Formula",         "type": "expression", "placeholder": "price * qty * 1.18"},
            ],
        },
    ]

    # ─────────────────────────────────────────────────────────────
    # Initialisation
    # ─────────────────────────────────────────────────────────────

    def __init__(self, session_id: str):
        super().__init__(session_id)
        self.lookup_datasets: Dict[str, Dict[str, Any]] = {}
        # {lookup_id: {"name": str, "df": pl.DataFrame}}

    # ─────────────────────────────────────────────────────────────
    # Public API (BaseFeature interface)
    # ─────────────────────────────────────────────────────────────

    async def preview(self, config: Dict[str, Any], limit: int = 200) -> FeatureResult:
        return self._execute_steps(config, preview_limit=limit)

    async def execute(self, config: Dict[str, Any]) -> FeatureResult:
        return self._execute_steps(config, preview_limit=None)

    def validate(self, config: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        steps = config.get("steps", [])
        if not isinstance(steps, list):
            return False, "'steps' must be an array."
        valid_ops = {op["id"] for op in self.OPERATIONS}
        for i, step in enumerate(steps):
            op = step.get("operation", "")
            if op not in valid_ops:
                return False, f"Step {i + 1} has unknown operation: {op!r}"
        return True, None

    # ─────────────────────────────────────────────────────────────
    # Lookup Dataset Management
    # ─────────────────────────────────────────────────────────────

    def register_lookup(self, lookup_id: str, name: str, df: pl.DataFrame) -> None:
        self.lookup_datasets[lookup_id] = {"name": name, "df": df}

    def get_lookup_meta(self) -> List[Dict[str, Any]]:
        return [
            {"id": lid, "name": meta["name"], "columns": meta["df"].columns, "rows": len(meta["df"])}
            for lid, meta in self.lookup_datasets.items()
        ]

    def get_lookup_columns(self, lookup_id: str) -> List[str]:
        if lookup_id in self.lookup_datasets:
            return self.lookup_datasets[lookup_id]["df"].columns
        return []

    def remove_lookup(self, lookup_id: str) -> bool:
        if lookup_id in self.lookup_datasets:
            del self.lookup_datasets[lookup_id]
            return True
        return False

    # ─────────────────────────────────────────────────────────────
    # Step Execution Chain
    # ─────────────────────────────────────────────────────────────

    def _execute_steps(self, config: Dict[str, Any], preview_limit: Optional[int]) -> FeatureResult:
        steps = config.get("steps", [])
        if self.df is None:
            return FeatureResult(success=False, error="No dataset loaded.")

        df = self.df.clone()
        if preview_limit:
            df = df.head(preview_limit)

        step_logs: List[Dict[str, Any]] = []

        for i, step in enumerate(steps):
            op = step.get("operation", "")
            params = step.get("params", {})
            rows_before = len(df)
            cols_before = len(df.columns)

            try:
                df = self._apply_step(df, op, params)
                step_logs.append({
                    "step": i, "operation": op, "status": "ok",
                    "rows_before": rows_before, "rows_after": len(df),
                    "cols_before": cols_before, "cols_after": len(df.columns),
                })
            except Exception as exc:
                step_logs.append({
                    "step": i, "operation": op, "status": "error",
                    "error": str(exc),
                    "rows_before": rows_before, "rows_after": rows_before,
                })
                return FeatureResult(
                    success=False,
                    error=f"Step {i + 1} ({op}) failed: {exc}",
                    data=df.to_dicts(),
                    metadata={
                        "steps": step_logs,
                        "total_rows": len(df),
                        "total_columns": len(df.columns),
                        "columns": df.columns,
                    },
                )

        return FeatureResult(
            success=True,
            data=df.to_dicts(),
            metadata={
                "steps": step_logs,
                "total_rows": len(df),
                "total_columns": len(df.columns),
                "columns": df.columns,
            },
        )

    # ─────────────────────────────────────────────────────────────
    # Individual Step Dispatcher
    # ─────────────────────────────────────────────────────────────

    def _apply_step(self, df: pl.DataFrame, op: str, params: Dict[str, Any]) -> pl.DataFrame:  # noqa: C901
        # ── Structural ──────────────────────────────────────────────
        if op == "rename_column":
            col, new_name = params["column"], params["new_name"].strip()
            if not new_name:
                raise ValueError("New name cannot be blank.")
            if col not in df.columns:
                raise ValueError(f"Column '{col}' not found.")
            return df.rename({col: new_name})

        if op == "drop_column":
            cols = params.get("columns") or []
            if isinstance(cols, str):
                cols = [cols]
            existing = [c for c in cols if c in df.columns]
            return df.drop(existing) if existing else df

        if op == "reorder_columns":
            order = params.get("column_order") or []
            first = [c for c in order if c in df.columns]
            rest = [c for c in df.columns if c not in first]
            return df.select(first + rest)

        if op == "add_computed_column":
            new_name = params["new_name"].strip()
            if not new_name:
                raise ValueError("New column name cannot be blank.")
            expr = self._parse_expression(params["expression"], df)
            return df.with_columns(expr.alias(new_name))

        # ── Value Updates ───────────────────────────────────────────
        if op == "set_value":
            col = params["column"]
            val = self._cast_value(str(params.get("value", "")), df.schema.get(col))
            return df.with_columns(pl.lit(val).cast(df.schema[col], strict=False).alias(col))

        if op == "update_conditional":
            col         = params["column"]
            cond_col    = params.get("condition_column") or col
            cond_op     = params.get("condition_op", "==")
            cond_val    = str(params.get("condition_value", ""))
            then_val    = str(params.get("then_value", ""))
            else_raw    = params.get("else_value")
            cond        = self._build_condition(df, cond_col, cond_op, cond_val)
            then_expr   = pl.lit(then_val)
            if else_raw is not None and str(else_raw).strip() != "":
                result = pl.when(cond).then(then_expr).otherwise(pl.lit(str(else_raw)))
            else:
                result = pl.when(cond).then(then_expr).otherwise(pl.col(col).cast(pl.Utf8))
            return df.with_columns(result.alias(col))

        if op == "replace_value":
            col        = params["column"]
            target     = str(params.get("target", ""))
            replacement= str(params.get("replacement", ""))
            match_type = params.get("match_type", "exact")
            if match_type == "exact":
                return df.with_columns(
                    pl.when(pl.col(col).cast(pl.Utf8) == target)
                    .then(pl.lit(replacement))
                    .otherwise(pl.col(col).cast(pl.Utf8))
                    .alias(col)
                )
            if match_type == "partial":
                return df.with_columns(
                    pl.col(col).cast(pl.Utf8).str.replace_all(target, replacement, literal=True).alias(col)
                )
            # regex
            return df.with_columns(
                pl.col(col).cast(pl.Utf8).str.replace_all(target, replacement, literal=False).alias(col)
            )

        if op == "fill_nulls":
            col    = params["column"]
            method = params.get("method", "custom")
            custom = str(params.get("custom_value", ""))
            if method == "forward_fill":
                return df.with_columns(pl.col(col).forward_fill())
            if method == "backward_fill":
                return df.with_columns(pl.col(col).backward_fill())
            if method in ("mean", "median", "min", "max"):
                is_num = df.schema.get(col) and df.schema[col].is_numeric()
                if is_num:
                    stat = df.select(getattr(pl.col(col), method)()).to_series()[0]
                    return df.with_columns(pl.col(col).fill_null(pl.lit(stat)))
                return df  # skip non-numeric for stat methods
            # custom
            try:
                val = self._cast_value(custom, df.schema.get(col))
                return df.with_columns(pl.col(col).fill_null(pl.lit(val)))
            except Exception:
                return df.with_columns(pl.col(col).cast(pl.Utf8).fill_null(pl.lit(custom)))

        # ── Row Operations ──────────────────────────────────────────
        if op == "filter_rows":
            col = params["column"]
            cond = self._build_condition(df, col, params.get("op", "=="), str(params.get("value", "")))
            return df.filter(~cond)  # DELETE matching rows → keep NOT matching

        if op == "deduplicate":
            subset = params.get("subset") or None
            keep   = params.get("keep", "first")
            if isinstance(subset, list):
                subset = [c for c in subset if c in df.columns] or None
            return df.unique(subset=subset, keep=keep, maintain_order=True)

        if op == "sort_rows":
            cols_raw = params.get("columns") or []
            if isinstance(cols_raw, str):
                cols_raw = [cols_raw]
            cols_valid = [c for c in cols_raw if c in df.columns]
            if not cols_valid:
                raise ValueError("No valid sort columns provided.")
            desc       = params.get("descending", "ascending") == "descending"
            nulls_last = params.get("nulls_last", "nulls_last") == "nulls_last"
            return df.sort(cols_valid, descending=desc, nulls_last=nulls_last)

        if op == "limit_rows":
            mode = params.get("mode", "head")
            n    = max(1, int(params.get("n", 100)))
            if mode == "tail":
                return df.tail(n)
            if mode == "sample":
                return df.sample(n=min(n, len(df)), seed=42)
            return df.head(n)

        # ── Type & Format ────────────────────────────────────────────
        if op == "cast_type":
            col   = params["column"]
            dtype = _TYPE_MAP.get(params.get("target_type", "String"), pl.Utf8)
            return df.with_columns(pl.col(col).cast(dtype, strict=False))

        if op == "change_date_format":
            col     = params["column"]
            in_fmt  = params.get("input_format_custom") or params.get("input_format", "%Y-%m-%d")
            out_fmt = params.get("output_format_custom") or params.get("output_format", "%Y-%m-%d")
            return df.with_columns(
                pl.col(col)
                .cast(pl.Utf8)
                .str.strptime(pl.Date, in_fmt, strict=False)
                .dt.strftime(out_fmt)
                .alias(col)
            )

        if op == "extract_date_part":
            col      = params["column"]
            part     = params.get("part", "year")
            new_col  = (params.get("new_column") or f"{col}_{part}").strip()
            in_fmt   = params.get("input_format") or None
            series   = pl.col(col)
            if df.schema.get(col) == pl.Utf8:
                series = series.str.strptime(pl.Date, in_fmt, strict=False) if in_fmt else series.str.strptime(pl.Date, strict=False)
            part_exprs = {
                "year":    series.dt.year(),    "month":   series.dt.month(),
                "day":     series.dt.day(),     "hour":    series.dt.hour(),
                "minute":  series.dt.minute(),  "second":  series.dt.second(),
                "weekday": series.dt.weekday(), "quarter": series.dt.quarter(),
                "week":    series.dt.week(),
            }
            return df.with_columns(part_exprs.get(part, series.dt.year()).alias(new_col))

        # ── Lookup / Join ─────────────────────────────────────────────
        if op == "lookup_join":
            lookup_id = params.get("lookup_id", "")
            if not lookup_id or lookup_id not in self.lookup_datasets:
                raise ValueError(f"Lookup dataset '{lookup_id}' not registered. Upload it first.")
            lookup_df  = self.lookup_datasets[lookup_id]["df"].clone()
            left_key   = params["left_key"]
            right_key  = params.get("right_key") or left_key
            join_how   = _JOIN_MAP.get(params.get("join_type", "left"), "left")
            select_cols= params.get("select_cols") or []
            suffix     = params.get("suffix") or "_right"

            if select_cols:
                keep = [right_key] + [c for c in select_cols if c != right_key and c in lookup_df.columns]
                lookup_df = lookup_df.select(keep)

            if left_key not in df.columns:
                raise ValueError(f"Left key '{left_key}' not found in main dataset.")
            if right_key not in lookup_df.columns:
                raise ValueError(f"Right key '{right_key}' not found in lookup dataset.")

            return df.join(lookup_df, left_on=left_key, right_on=right_key, how=join_how, suffix=suffix)

        # ── String ────────────────────────────────────────────────────
        if op == "string_trim":
            col  = params["column"]
            side = params.get("side", "both")
            s    = pl.col(col).cast(pl.Utf8)
            if side == "left":
                return df.with_columns(s.str.lstrip_chars().alias(col))
            if side == "right":
                return df.with_columns(s.str.rstrip_chars().alias(col))
            return df.with_columns(s.str.strip_chars().alias(col))

        if op == "string_case":
            col  = params["column"]
            case = params.get("case", "lower")
            s    = pl.col(col).cast(pl.Utf8)
            if case == "upper":
                return df.with_columns(s.str.to_uppercase().alias(col))
            if case == "title":
                return df.with_columns(s.str.to_titlecase().alias(col))
            return df.with_columns(s.str.to_lowercase().alias(col))

        if op == "string_substring":
            col     = params["column"]
            offset  = int(params.get("offset", 0))
            length_raw = int(params.get("length", 0))
            length  = length_raw if length_raw > 0 else None
            out_col = (params.get("new_column") or "").strip() or col
            return df.with_columns(
                pl.col(col).cast(pl.Utf8).str.slice(offset, length).alias(out_col)
            )

        if op == "concat_columns":
            cols    = params.get("columns") or []
            sep     = str(params.get("separator", " "))
            new_col = (params.get("new_column") or "concatenated").strip()
            existing= [c for c in cols if c in df.columns]
            if not existing:
                raise ValueError("No valid columns selected for concatenation.")
            return df.with_columns(
                pl.concat_str([pl.col(c).cast(pl.Utf8) for c in existing], separator=sep).alias(new_col)
            )

        if op == "split_column":
            col     = params["column"]
            delim   = str(params.get("delimiter", ","))
            idx     = int(params.get("index", 0))
            new_col = (params.get("new_column") or f"{col}_part{idx}").strip()
            return df.with_columns(
                pl.col(col).cast(pl.Utf8).str.split(delim).list.get(idx, null_on_oob=True).alias(new_col)
            )

        if op == "string_pad":
            col       = params["column"]
            width     = int(params.get("width", 10))
            fill_char = (str(params.get("fill_char", " ")) + " ")[:1]
            side      = params.get("side", "left")
            s         = pl.col(col).cast(pl.Utf8)
            if side == "right":
                return df.with_columns(s.str.ljust(width, fill_char).alias(col))
            return df.with_columns(s.str.rjust(width, fill_char).alias(col))

        # ── Math ───────────────────────────────────────────────────────
        if op == "math_round":
            col      = params["column"]
            decimals = int(params.get("decimals", 2))
            return df.with_columns(pl.col(col).round(decimals))

        if op == "math_abs":
            col = params["column"]
            return df.with_columns(pl.col(col).abs())

        if op == "math_expression":
            new_col = params["new_column"].strip()
            if not new_col:
                raise ValueError("New column name cannot be blank.")
            expr = self._parse_expression(params["expression"], df)
            return df.with_columns(expr.alias(new_col))

        raise ValueError(f"Unknown operation: '{op}'")

    # ─────────────────────────────────────────────────────────────
    # Helpers
    # ─────────────────────────────────────────────────────────────

    def _build_condition(self, df: pl.DataFrame, col: str, op_str: str, val: str) -> pl.Expr:
        if col not in df.columns:
            raise ValueError(f"Column '{col}' not found for condition.")
        series = pl.col(col)
        if op_str == "is_null":      return series.is_null()
        if op_str == "is_not_null":  return series.is_not_null()
        if op_str == "contains":     return series.cast(pl.Utf8).str.contains(val, literal=True)
        if op_str == "starts_with":  return series.cast(pl.Utf8).str.starts_with(val)
        if op_str == "ends_with":    return series.cast(pl.Utf8).str.ends_with(val)
        casted = self._cast_value(val, df.schema.get(col))
        if op_str == "==":  return series == casted
        if op_str == "!=":  return series != casted
        if op_str == ">":   return series > casted
        if op_str == ">=":  return series >= casted
        if op_str == "<":   return series < casted
        if op_str == "<=":  return series <= casted
        return pl.lit(True)

    @staticmethod
    def _cast_value(val: str, dtype: Any) -> Any:
        if dtype in (pl.Int32, pl.Int64, pl.UInt32, pl.UInt64):
            return int(float(val))
        if dtype in (pl.Float32, pl.Float64):
            return float(val)
        if dtype == pl.Boolean:
            return val.strip().lower() in ("true", "1", "yes")
        return val

    @staticmethod
    def _parse_expression(expr_str: str, df: pl.DataFrame) -> pl.Expr:
        """
        Safely evaluate a column arithmetic expression.
        Column names that exist in df are replaced with pl.col("name").
        """
        # Sort by length descending so longer names are replaced first (avoids partial-name collisions)
        expr_safe = expr_str.strip()
        for col in sorted(df.columns, key=len, reverse=True):
            # Only replace whole-word occurrences
            expr_safe = re.sub(
                r'(?<!["\w])' + re.escape(col) + r'(?!["\w])',
                f'pl.col("{col}")',
                expr_safe,
            )
        try:
            result = eval(expr_safe, {"pl": pl, "__builtins__": {}})  # noqa: S307
            if not isinstance(result, pl.Expr):
                raise TypeError("Expression must evaluate to a Polars Expr.")
            return result
        except Exception as exc:
            raise ValueError(f"Could not parse expression {expr_str!r}: {exc}") from exc

    # ─────────────────────────────────────────────────────────────
    # Class-level metadata
    # ─────────────────────────────────────────────────────────────

    @classmethod
    def get_operations(cls) -> List[Dict[str, Any]]:
        return cls.OPERATIONS

    @classmethod
    def get_categories(cls) -> List[Dict[str, Any]]:
        return cls.CATEGORIES
