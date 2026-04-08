"""
Pricing Intelligence feature for CleanFlow.

Supports:
- one client dataset
- multiple competitor datasets
- side-by-side match review output
- price recommendation with strategy, cost floors, dynamic signals, and elasticity
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List, Optional
import math
import os
import re

import polars as pl

from .base import BaseFeature, FeatureResult
from .matching import MatchingAlgorithm

try:
    from logger import setup_logger

    logger = setup_logger(__name__)
except ImportError:
    import logging

    logger = logging.getLogger(__name__)


class PricingIntelligence(BaseFeature):
    DEFAULT_SIGNALS = {
        "demand": {"normal": 0.0, "rising": 0.03, "surging": 0.06},
        "stock": {"normal": 0.0, "low": 0.02, "critical": 0.05},
        "review": {"neutral": 0.0, "better": 0.015, "worse": -0.02},
    }

    def __init__(self, session_id: str):
        super().__init__(session_id)
        self.datasets: Dict[str, pl.DataFrame] = {}
        self.progress = {"percent": 0, "message": "Initializing...", "status": "idle"}
        self.results: Optional[Dict[str, Any]] = None

    def load_dataset(self, dataset_id: str, dataframe: pl.DataFrame):
        self.datasets[dataset_id] = dataframe

    def load_dataset_from_file(self, dataset_id: str, file_path: str, sep: str = ","):
        ext = os.path.splitext(file_path)[1].lower()
        try:
            if ext in [".xlsx", ".xls"]:
                df = pl.read_excel(file_path)
            else:
                separator = self._normalize_separator(sep)
                df = pl.read_csv(
                    file_path,
                    separator=separator,
                    ignore_errors=True,
                    truncate_ragged_lines=True,
                    quote_char=None,
                    null_values=["", "NA", "NaN"],
                )
                df = df.select(pl.all().cast(pl.Utf8))

            self.datasets[dataset_id] = df
            return df.columns, len(df)
        except Exception as exc:
            logger.exception("Failed to load pricing dataset")
            raise ValueError(f"Failed to load dataset: {exc}") from exc

    async def preview(self, config: Dict[str, Any], limit: int = 5) -> FeatureResult:
        return await self._run_pricing(config, preview_limit=limit)

    async def review_matches(self, config: Dict[str, Any]) -> FeatureResult:
        self.progress = {"percent": 0, "message": "Preparing match review...", "status": "running"}
        return await self._run_pricing(config, preview_limit=None, review_only=True)

    async def execute(self, config: Dict[str, Any]) -> FeatureResult:
        self.progress = {"percent": 0, "message": "Preparing pricing model...", "status": "running"}
        try:
            result = await self._run_pricing(config, preview_limit=None)
            self.results = result.data if result.success else None
            self.progress = {"percent": 100, "message": "Pricing analysis complete", "status": "completed"}
            return result
        except Exception as exc:
            self.progress = {"percent": 0, "message": f"Error: {exc}", "status": "error"}
            raise

    async def _run_pricing(
        self,
        config: Dict[str, Any],
        preview_limit: Optional[int] = None,
        review_only: bool = False,
    ) -> FeatureResult:
        is_valid, error = self.validate(config, review_only=review_only)
        if not is_valid:
            return FeatureResult(success=False, error=error)

        our_dataset_id = config.get("our_dataset", "our_dataset")
        competitor_sources = self._normalize_competitor_sources(config)

        if our_dataset_id not in self.datasets:
            return FeatureResult(success=False, error="Client dataset was not loaded")

        missing_sources = [source["dataset_id"] for source in competitor_sources if source["dataset_id"] not in self.datasets]
        if missing_sources:
            return FeatureResult(success=False, error=f"Competitor datasets not loaded: {', '.join(missing_sources)}")

        our_df = self.datasets[our_dataset_id]
        if preview_limit:
            our_df = our_df.head(preview_limit)

        competitor_frames = {}
        for source in competitor_sources:
            df = self.datasets[source["dataset_id"]]
            competitor_frames[source["dataset_id"]] = df.head(max(preview_limit * 5, preview_limit)) if preview_limit else df

        result = self._build_price_recommendations(
            our_df=our_df,
            competitor_frames=competitor_frames,
            competitor_sources=competitor_sources,
            config=config,
            review_only=review_only,
        )
        return FeatureResult(success=True, data=result, metadata=result.get("summary", {}))

    def _normalize_competitor_sources(self, config: Dict[str, Any]) -> List[Dict[str, Any]]:
        sources = config.get("competitor_sources") or []
        if sources:
            normalized = []
            for index, source in enumerate(sources, start=1):
                columns = source.get("columns", {})
                match_columns = self._normalize_match_columns(
                    source.get("match_columns"),
                    source.get("match_column") or columns.get("product_name"),
                )
                normalized.append(
                    {
                        "dataset_id": source.get("dataset_id"),
                        "label": source.get("label") or f"Competitor {index}",
                        "match_column": source.get("match_column") or match_columns.get("rule_1") or columns.get("product_name"),
                        "match_columns": match_columns,
                        "columns": columns,
                    }
                )
            return normalized

        legacy_columns = config.get("competitor_columns", {})
        legacy_match_column = config.get("match_rule", {}).get("competitor_column") or legacy_columns.get("product_name")
        return [
            {
                "dataset_id": config.get("competitor_dataset", "competitor_dataset"),
                "label": "Competitor 1",
                "match_column": legacy_match_column,
                "match_columns": self._normalize_match_columns(None, legacy_match_column),
                "columns": legacy_columns,
            }
        ]

    def _normalize_match_rules(self, config: Dict[str, Any]) -> List[Dict[str, Any]]:
        rules = config.get("match_rules") or []
        if rules:
            normalized = []
            for index, rule in enumerate(rules, start=1):
                normalized.append(
                    {
                        "id": str(rule.get("id") or f"rule_{index}"),
                        "label": rule.get("label") or f"Rule {index}",
                        "our_column": rule.get("our_column"),
                        "algorithm": rule.get("algorithm", "fuzzy"),
                        "threshold": float(rule.get("threshold", 0.8) or 0.8),
                    }
                )
            return normalized

        legacy_rule = config.get("match_rule", {})
        return [
            {
                "id": "rule_1",
                "label": legacy_rule.get("label") or "Rule 1",
                "our_column": legacy_rule.get("our_column"),
                "algorithm": legacy_rule.get("algorithm", "fuzzy"),
                "threshold": float(legacy_rule.get("threshold", 0.8) or 0.8),
            }
        ]

    def _normalize_match_columns(self, raw_match_columns: Any, fallback_column: Optional[str]) -> Dict[str, str]:
        normalized: Dict[str, str] = {}

        if isinstance(raw_match_columns, dict):
            normalized = {
                str(rule_id): str(column).strip()
                for rule_id, column in raw_match_columns.items()
                if rule_id is not None and column not in (None, "")
            }
        elif isinstance(raw_match_columns, list):
            for item in raw_match_columns:
                if not isinstance(item, dict):
                    continue
                rule_id = item.get("rule_id")
                column = item.get("competitor_column")
                if rule_id is None or column in (None, ""):
                    continue
                normalized[str(rule_id)] = str(column).strip()

        if fallback_column and "rule_1" not in normalized:
            normalized["rule_1"] = str(fallback_column).strip()

        return normalized

    def _build_price_recommendations(
        self,
        our_df: pl.DataFrame,
        competitor_frames: Dict[str, pl.DataFrame],
        competitor_sources: List[Dict[str, Any]],
        config: Dict[str, Any],
        review_only: bool = False,
    ) -> Dict[str, Any]:
        match_rules = self._normalize_match_rules(config)
        our_columns = config.get("our_columns", {})
        strategy = config.get("strategy", {})
        signals = config.get("signals", {})
        elasticity = config.get("elasticity", {})
        pricing_limits = config.get("pricing_limits", {})
        excluded_match_ids = {
            str(match_id).strip()
            for match_id in (config.get("excluded_match_ids") or [])
            if str(match_id).strip()
        }

        if not match_rules:
            raise ValueError("At least one matching rule is required")

        grouped_matches: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
        total_rules = max(len(match_rules), 1)
        aggregate_threshold = sum(float(rule.get("threshold", 0.8) or 0.8) for rule in match_rules) / total_rules
        matching_jobs = []

        for source in competitor_sources:
            competitor_df = competitor_frames[source["dataset_id"]]
            for rule in match_rules:
                our_match_col = rule.get("our_column")
                competitor_match_col = source.get("match_columns", {}).get(rule["id"])
                if our_match_col in our_df.columns and competitor_match_col in competitor_df.columns:
                    matching_jobs.append((source["label"], rule.get("label") or rule.get("our_column") or "Rule"))

        total_jobs = max(len(matching_jobs), 1)
        self.progress = {"percent": 10, "message": "Matching client products with competitors...", "status": "running"}
        job_index = 0

        for source_index, source in enumerate(competitor_sources):
            competitor_df = competitor_frames[source["dataset_id"]]
            candidate_scores = defaultdict(lambda: [0.0] * total_rules)
            candidate_details = defaultdict(lambda: [None] * total_rules)

            for rule_idx, rule in enumerate(match_rules):
                our_match_col = rule.get("our_column")
                competitor_match_col = source.get("match_columns", {}).get(rule["id"])

                if our_match_col not in our_df.columns:
                    logger.warning("Skipping rule %s because client column %s is missing", rule["id"], our_match_col)
                    continue
                if competitor_match_col not in competitor_df.columns:
                    logger.warning(
                        "Skipping rule %s for source %s because competitor column %s is missing",
                        rule["id"],
                        source["label"],
                        competitor_match_col,
                    )
                    continue

                match_method = getattr(
                    MatchingAlgorithm,
                    MatchingAlgorithm.ALGORITHMS.get(rule.get("algorithm", "fuzzy"), "fuzzy_match_batch"),
                )
                current_job_index = job_index
                job_index += 1

                def progress_cb(current, total, idx=current_job_index, label=source["label"], rule_label=rule.get("label")):
                    current_progress = (current / total) if total else 0
                    percent = 10 + int((((idx + current_progress) / total_jobs) * 35))
                    self.progress = {
                        "percent": min(percent, 45),
                        "message": f"Matching {label}: {rule_label}...",
                        "status": "running",
                    }

                raw_matches = match_method(
                    our_df[our_match_col],
                    competitor_df[competitor_match_col],
                    float(rule.get("threshold", 0.8) or 0.8),
                    progress_callback=progress_cb,
                )

                for match in raw_matches:
                    pair_key = (int(match["index1"]), int(match["index2"]))
                    candidate_scores[pair_key][rule_idx] = float(match.get("similarity_score", 0.0))
                    candidate_details[pair_key][rule_idx] = {
                        "rule_id": rule["id"],
                        "label": rule.get("label") or self._humanize_column(our_match_col),
                        "our_column": our_match_col,
                        "competitor_column": competitor_match_col,
                        "algorithm": rule.get("algorithm", "fuzzy"),
                        "threshold": float(rule.get("threshold", 0.8) or 0.8),
                        "score": float(match.get("similarity_score", 0.0)),
                        "client_value": match.get("match_value_1"),
                        "competitor_value": match.get("match_value_2"),
                    }

            for (our_index, competitor_index), scores in candidate_scores.items():
                aggregate_score = sum(scores) / total_rules
                if aggregate_score < aggregate_threshold:
                    continue

                grouped_matches[our_index].append(
                    {
                        "match_id": f"{source['dataset_id']}::{our_index}::{competitor_index}",
                        "index1": our_index,
                        "index2": competitor_index,
                        "similarity_score": aggregate_score,
                        "competitor_dataset_id": source["dataset_id"],
                        "competitor_label": source["label"],
                        "competitor_columns": source["columns"],
                        "match_details": [detail for detail in candidate_details[(our_index, competitor_index)] if detail],
                        "matched_rule_count": sum(1 for score in scores if score > 0),
                        "total_rule_count": total_rules,
                    }
                )

        self.progress = {
            "percent": 55,
            "message": "Compiling match review..." if review_only else "Calculating price recommendations...",
            "status": "running",
        }

        rows: List[Dict[str, Any]] = []
        review_rows: List[Dict[str, Any]] = []
        matched_products = 0
        price_changes = {"increase": 0, "decrease": 0, "hold": 0}
        primary_match_col = match_rules[0].get("our_column") if match_rules else ""

        for our_index in range(len(our_df)):
            our_row = our_df.row(our_index, named=True)
            matches = grouped_matches.get(our_index, [])
            if review_only:
                our_product_label = self._string_value(
                    our_row,
                    our_columns.get("product_name") or primary_match_col,
                    fallback="Unnamed product",
                )
                competitor_entries = self._collect_competitor_entries(
                    matches=matches,
                    competitor_frames=competitor_frames,
                    require_price=False,
                    excluded_match_ids=excluded_match_ids,
                )
                match_review = self._build_review_rows(
                    our_row=our_row,
                    our_product_label=our_product_label,
                    our_columns=our_columns,
                    primary_match_col=primary_match_col,
                    current_price=self._numeric_value(our_row, our_columns.get("current_price")),
                    sku=self._string_value(our_row, our_columns.get("sku")),
                    competitor_entries=competitor_entries,
                )
                if competitor_entries:
                    matched_products += 1
                review_rows.extend(match_review)
                continue

            recommendation, match_review = self._score_product(
                our_row=our_row,
                match_rules=match_rules,
                matches=matches,
                competitor_frames=competitor_frames,
                our_columns=our_columns,
                strategy=strategy,
                signals=signals,
                elasticity=elasticity,
                pricing_limits=pricing_limits,
                excluded_match_ids=excluded_match_ids,
            )

            rows.append(recommendation)
            review_rows.extend(match_review)

            if recommendation["competitor_count"] > 0:
                matched_products += 1

            action = recommendation["pricing_action"]
            if action.startswith("Increase"):
                price_changes["increase"] += 1
            elif action.startswith("Decrease"):
                price_changes["decrease"] += 1
            else:
                price_changes["hold"] += 1

        rows.sort(key=lambda row: (row.get("competitor_count", 0), row.get("match_score", 0.0)), reverse=True)
        review_rows.sort(key=lambda row: row.get("similarity_score", 0.0), reverse=True)

        summary = self._build_summary(
            rows=rows,
            analyzed_products=len(our_df),
            matched_products=matched_products,
            strategy=strategy,
            price_changes=price_changes,
            competitor_source_count=len(competitor_sources),
            review_pair_count=len(review_rows),
        )

        self.progress = {
            "percent": 95,
            "message": "Finalizing match review..." if review_only else "Finalizing output...",
            "status": "running",
        }

        return {
            "summary": summary,
            "rows": rows,
            "review_rows": review_rows[:300],
        }

    def _score_product(
        self,
        our_row: Dict[str, Any],
        match_rules: List[Dict[str, Any]],
        matches: List[Dict[str, Any]],
        competitor_frames: Dict[str, pl.DataFrame],
        our_columns: Dict[str, str],
        strategy: Dict[str, Any],
        signals: Dict[str, Any],
        elasticity: Dict[str, Any],
        pricing_limits: Dict[str, Any],
        excluded_match_ids: Optional[set[str]] = None,
    ) -> tuple[Dict[str, Any], List[Dict[str, Any]]]:
        primary_match_col = match_rules[0].get("our_column") if match_rules else ""
        our_product_label = self._string_value(
            our_row,
            our_columns.get("product_name") or primary_match_col,
            fallback="Unnamed product",
        )
        sku = self._string_value(our_row, our_columns.get("sku"))
        current_price = self._numeric_value(our_row, our_columns.get("current_price"))
        total_cost = (
            self._numeric_value(our_row, our_columns.get("cogs"))
            + self._numeric_value(our_row, our_columns.get("fulfillment"))
            + self._numeric_value(our_row, our_columns.get("commission"))
            + self._numeric_value(our_row, our_columns.get("advertising"))
        )

        competitor_entries = self._collect_competitor_entries(
            matches,
            competitor_frames,
            excluded_match_ids=excluded_match_ids,
        )
        review_rows = self._build_review_rows(
            our_row=our_row,
            our_product_label=our_product_label,
            our_columns=our_columns,
            primary_match_col=primary_match_col,
            current_price=current_price,
            sku=sku,
            competitor_entries=competitor_entries,
        )

        competitor_prices = [entry["price"] for entry in competitor_entries if entry["price"] is not None]
        competitor_ratings = [entry["rating"] for entry in competitor_entries if entry["rating"] is not None]
        source_labels = [entry["source_label"] for entry in competitor_entries if entry["source_label"]]

        if not competitor_prices:
            fallback_price = current_price or self._cost_floor(total_cost, float(strategy.get("min_margin_pct", 15)))
            fallback_price = self._apply_limits(fallback_price, pricing_limits)
            margin_pct = self._margin_pct(fallback_price, total_cost)
            recommendation = {
                "product_name": our_product_label,
                "sku": sku,
                "current_price": round(current_price, 2),
                "recommended_price": round(fallback_price, 2),
                "competitor_count": 0,
                "competitor_min_price": 0.0,
                "competitor_avg_price": 0.0,
                "competitor_max_price": 0.0,
                "market_average_price": 0.0,
                "total_cost": round(total_cost, 2),
                "margin_pct": round(margin_pct, 2),
                "floor_price": round(self._cost_floor(total_cost, float(strategy.get("min_margin_pct", 15))), 2),
                "pricing_action": "Hold - no comparable competitor product found",
                "strategy": strategy.get("position", "match"),
                "matched_competitors": "",
                "match_score": 0.0,
                "demand_signal": self._resolve_signal("demand", our_row, our_columns, competitor_ratings, signals),
                "stock_signal": self._resolve_signal("stock", our_row, our_columns, competitor_ratings, signals),
                "review_signal": self._resolve_signal("review", our_row, our_columns, competitor_ratings, signals),
                "dynamic_adjustment_pct": 0.0,
                "elasticity_best_price": round(fallback_price, 2),
                "elasticity_best_profit_index": round(max(fallback_price - total_cost, 0), 2),
                "recommended_vs_current_pct": round(self._pct_change(current_price, fallback_price), 2),
                "note": "Upload more competitor feeds or relax the threshold to improve match coverage.",
            }
            return recommendation, review_rows

        min_price = min(competitor_prices)
        avg_price = sum(competitor_prices) / len(competitor_prices)
        max_price = max(competitor_prices)
        match_score = sum(entry["similarity_score"] for entry in competitor_entries) / len(competitor_entries)

        position = strategy.get("position", "match")
        adjustment_value = float(strategy.get("adjustment_value", 0) or 0)
        rounding_step = float(strategy.get("rounding_step", 1) or 1)
        min_margin_pct = float(strategy.get("min_margin_pct", 15) or 15)

        if position == "below":
            base_price = min_price - adjustment_value
        elif position == "above":
            base_price = max_price + adjustment_value
        else:
            base_price = avg_price + adjustment_value

        demand_signal = self._resolve_signal("demand", our_row, our_columns, competitor_ratings, signals)
        stock_signal = self._resolve_signal("stock", our_row, our_columns, competitor_ratings, signals)
        review_signal = self._resolve_signal("review", our_row, our_columns, competitor_ratings, signals)

        dynamic_adjustment_pct = (
            self.DEFAULT_SIGNALS["demand"].get(demand_signal, 0.0)
            + self.DEFAULT_SIGNALS["stock"].get(stock_signal, 0.0)
            + self.DEFAULT_SIGNALS["review"].get(review_signal, 0.0)
        )

        adjusted_price = base_price * (1 + dynamic_adjustment_pct)
        floor_price = self._cost_floor(total_cost, min_margin_pct)
        elasticity_best_price, elasticity_best_profit = self._run_elasticity(
            base_price=adjusted_price,
            competitor_avg=avg_price,
            total_cost=total_cost,
            elasticity=elasticity,
            floor_price=floor_price,
            pricing_limits=pricing_limits,
        )

        final_price = max(elasticity_best_price, floor_price)
        final_price = self._apply_limits(final_price, pricing_limits)
        final_price = self._round_price(final_price, rounding_step, position)

        recommendation = {
            "product_name": our_product_label,
            "sku": sku,
            "current_price": round(current_price, 2),
            "recommended_price": round(final_price, 2),
            "competitor_count": len(competitor_prices),
            "competitor_min_price": round(min_price, 2),
            "competitor_avg_price": round(avg_price, 2),
            "competitor_max_price": round(max_price, 2),
            "market_average_price": round(avg_price, 2),
            "total_cost": round(total_cost, 2),
            "margin_pct": round(self._margin_pct(final_price, total_cost), 2),
            "floor_price": round(floor_price, 2),
            "pricing_action": self._action_label(current_price, final_price),
            "strategy": position,
            "matched_competitors": ", ".join(sorted(set(source_labels)))[:200],
            "match_score": round(match_score, 4),
            "demand_signal": demand_signal,
            "stock_signal": stock_signal,
            "review_signal": review_signal,
            "dynamic_adjustment_pct": round(dynamic_adjustment_pct * 100, 2),
            "elasticity_best_price": round(elasticity_best_price, 2),
            "elasticity_best_profit_index": round(elasticity_best_profit, 2),
            "recommended_vs_current_pct": round(self._pct_change(current_price, final_price), 2),
            "note": self._build_note(position, min_price, avg_price, max_price, floor_price, final_price),
        }
        return recommendation, review_rows

    def _collect_competitor_entries(
        self,
        matches: List[Dict[str, Any]],
        competitor_frames: Dict[str, pl.DataFrame],
        require_price: bool = True,
        excluded_match_ids: Optional[set[str]] = None,
    ) -> List[Dict[str, Any]]:
        entries: List[Dict[str, Any]] = []
        seen_pairs = set()

        for match in sorted(matches, key=lambda item: item.get("similarity_score", 0), reverse=True):
            match_id = str(match.get("match_id") or "").strip()
            if excluded_match_ids and match_id in excluded_match_ids:
                continue
            dataset_id = match.get("competitor_dataset_id")
            competitor_index = int(match["index2"])
            pair_key = (dataset_id, competitor_index)
            if pair_key in seen_pairs:
                continue
            seen_pairs.add(pair_key)

            competitor_df = competitor_frames.get(dataset_id)
            if competitor_df is None:
                continue

            columns = match.get("competitor_columns", {})
            try:
                competitor_row = competitor_df.row(competitor_index, named=True)
            except Exception:
                continue

            price = self._numeric_value(competitor_row, columns.get("price"))
            if require_price and price <= 0:
                continue

            entries.append(
                {
                    "match_id": match_id or f"{dataset_id}::{match.get('index1', 0)}::{competitor_index}",
                    "dataset_id": dataset_id,
                    "source_label": match.get("competitor_label") or dataset_id,
                    "product_name": self._string_value(competitor_row, columns.get("product_name")),
                    "seller": self._string_value(competitor_row, columns.get("seller_name")),
                    "product_url": self._string_value(competitor_row, columns.get("product_url")),
                    "image_url": self._string_value(competitor_row, columns.get("image_url")),
                    "price": price if price > 0 else None,
                    "rating": self._numeric_value(competitor_row, columns.get("rating")),
                    "similarity_score": float(match.get("similarity_score", 0.0)),
                    "match_details": match.get("match_details", []),
                    "matched_rule_count": int(match.get("matched_rule_count", 0)),
                    "total_rule_count": int(match.get("total_rule_count", 0)),
                    "client_index": int(match.get("index1", 0)),
                    "competitor_index": competitor_index,
                    "columns": columns,
                    "row": competitor_row,
                }
            )

        return entries

    def _build_review_rows(
        self,
        our_row: Dict[str, Any],
        our_product_label: str,
        our_columns: Dict[str, str],
        primary_match_col: str,
        current_price: float,
        sku: str,
        competitor_entries: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        rows = []
        our_match_value = self._string_value(our_row, primary_match_col, fallback=our_product_label)
        client_product_url = self._string_value(our_row, our_columns.get("product_url"))
        client_image_url = self._string_value(our_row, our_columns.get("image_url"))
        client_fields = self._build_display_fields(our_row, our_columns)
        client_record = self._build_record_fields(our_row)

        for entry in competitor_entries:
            competitor_price = entry["price"]
            matched_attributes = []
            for detail in entry.get("match_details", []):
                client_column = detail.get("our_column")
                competitor_column = detail.get("competitor_column")
                matched_attributes.append(
                    {
                        "label": detail.get("label") or self._humanize_column(client_column),
                        "client_column": client_column,
                        "client_value": self._string_value(our_row, client_column, fallback=str(detail.get("client_value") or "")),
                        "competitor_column": competitor_column,
                        "competitor_value": self._string_value(
                            entry["row"],
                            competitor_column,
                            fallback=str(detail.get("competitor_value") or ""),
                        ),
                        "algorithm": detail.get("algorithm", "fuzzy"),
                        "threshold": round(float(detail.get("threshold", 0.0) or 0.0), 4),
                        "score": round(float(detail.get("score", 0.0) or 0.0), 4),
                    }
                )

            rows.append(
                {
                    "match_id": entry.get("match_id"),
                    "client_index": entry.get("client_index", 0),
                    "client_product_name": our_product_label,
                    "client_sku": sku,
                    "client_match_value": our_match_value,
                    "client_price": round(current_price, 2) if current_price > 0 else None,
                    "client_product_url": client_product_url,
                    "client_image_url": client_image_url,
                    "client_fields": client_fields,
                    "client_record": client_record,
                    "competitor_source": entry["source_label"],
                    "competitor_dataset_id": entry.get("dataset_id"),
                    "competitor_index": entry.get("competitor_index", 0),
                    "competitor_product_name": entry["product_name"],
                    "competitor_seller": entry["seller"],
                    "competitor_price": round(competitor_price, 2) if competitor_price else None,
                    "competitor_product_url": entry.get("product_url", ""),
                    "competitor_image_url": entry.get("image_url", ""),
                    "competitor_fields": self._build_display_fields(entry["row"], entry.get("columns", {})),
                    "competitor_record": self._build_record_fields(entry["row"]),
                    "competitor_rating": round(entry["rating"], 2) if entry["rating"] else 0.0,
                    "similarity_score": round(entry["similarity_score"], 4),
                    "match_quality": self._confidence_label(entry["similarity_score"]),
                    "matched_rule_count": entry.get("matched_rule_count", len(matched_attributes)),
                    "total_rule_count": entry.get("total_rule_count", len(matched_attributes)),
                    "matched_attributes": matched_attributes,
                    "price_gap_pct": round(self._pct_change(current_price, competitor_price), 2) if competitor_price else 0.0,
                }
            )

        return rows

    def _resolve_signal(
        self,
        signal_type: str,
        our_row: Dict[str, Any],
        our_columns: Dict[str, str],
        competitor_ratings: List[float],
        signals: Dict[str, Any],
    ) -> str:
        mode_key = f"{signal_type}_mode"
        forced_mode = signals.get(mode_key, "auto")
        if forced_mode and forced_mode != "auto":
            return forced_mode

        if signal_type == "stock":
            stock_column = our_columns.get("stock")
            if not stock_column or our_row.get(stock_column) in (None, ""):
                return "normal"
            stock_value = self._numeric_value(our_row, stock_column)
            critical_threshold = float(signals.get("stock_critical_threshold", 5) or 5)
            low_threshold = float(signals.get("stock_low_threshold", 15) or 15)
            if stock_value <= critical_threshold:
                return "critical"
            if stock_value <= low_threshold:
                return "low"
            return "normal"

        if signal_type == "demand":
            demand_value = self._numeric_value(our_row, our_columns.get("demand"))
            surging_threshold = float(signals.get("demand_surging_threshold", 85) or 85)
            rising_threshold = float(signals.get("demand_rising_threshold", 60) or 60)
            if demand_value >= surging_threshold:
                return "surging"
            if demand_value >= rising_threshold:
                return "rising"
            return "normal"

        if signal_type == "review":
            our_rating = self._numeric_value(our_row, our_columns.get("rating"))
            if our_rating <= 0 or not competitor_ratings:
                return "neutral"
            competitor_avg_rating = sum(competitor_ratings) / len(competitor_ratings)
            delta_threshold = float(signals.get("review_delta_threshold", 0.2) or 0.2)
            if our_rating >= competitor_avg_rating + delta_threshold:
                return "better"
            if our_rating <= competitor_avg_rating - delta_threshold:
                return "worse"
            return "neutral"

        return "normal"

    def _run_elasticity(
        self,
        base_price: float,
        competitor_avg: float,
        total_cost: float,
        elasticity: Dict[str, Any],
        floor_price: float,
        pricing_limits: Dict[str, Any],
    ) -> tuple[float, float]:
        safe_base = max(base_price, 0.01)
        if not elasticity.get("enabled", True):
            return safe_base, max(safe_base - total_cost, 0)

        coefficient = float(elasticity.get("coefficient", 1.1) or 1.1)
        scenario_steps = elasticity.get("scenario_steps") or [-10, -5, 0, 5, 10]

        best_price = safe_base
        best_profit = -math.inf

        for raw_step in scenario_steps:
            step = float(raw_step) / 100.0
            candidate = safe_base * (1 + step)
            candidate = max(candidate, floor_price)
            candidate = self._apply_limits(candidate, pricing_limits)

            demand_index = (competitor_avg / max(candidate, 0.01)) ** coefficient if competitor_avg > 0 else 1.0
            demand_index = min(max(demand_index, 0.35), 2.5)
            profit_index = demand_index * max(candidate - total_cost, 0)

            if profit_index > best_profit:
                best_profit = profit_index
                best_price = candidate

        return best_price, best_profit if best_profit > -math.inf else 0.0

    def _build_summary(
        self,
        rows: List[Dict[str, Any]],
        analyzed_products: int,
        matched_products: int,
        strategy: Dict[str, Any],
        price_changes: Dict[str, int],
        competitor_source_count: int,
        review_pair_count: int,
    ) -> Dict[str, Any]:
        recommended_prices = [row["recommended_price"] for row in rows if row.get("recommended_price", 0) > 0]
        margins = [row["margin_pct"] for row in rows if row.get("competitor_count", 0) > 0]
        avg_price_change = [
            row["recommended_vs_current_pct"]
            for row in rows
            if row.get("current_price", 0) > 0 and row.get("competitor_count", 0) > 0
        ]

        return {
            "analyzed_products": analyzed_products,
            "matched_products": matched_products,
            "coverage_pct": round((matched_products / analyzed_products) * 100, 2) if analyzed_products else 0.0,
            "avg_recommended_price": round(sum(recommended_prices) / len(recommended_prices), 2) if recommended_prices else 0.0,
            "avg_margin_pct": round(sum(margins) / len(margins), 2) if margins else 0.0,
            "avg_price_change_pct": round(sum(avg_price_change) / len(avg_price_change), 2) if avg_price_change else 0.0,
            "strategy": strategy.get("position", "match"),
            "increase_count": price_changes["increase"],
            "decrease_count": price_changes["decrease"],
            "hold_count": price_changes["hold"],
            "competitor_source_count": competitor_source_count,
            "review_pair_count": review_pair_count,
        }

    def _cost_floor(self, total_cost: float, min_margin_pct: float) -> float:
        if total_cost <= 0:
            return 0.0
        margin_decimal = min(max(min_margin_pct / 100.0, 0.0), 0.95)
        return total_cost / max(1 - margin_decimal, 0.05)

    def _action_label(self, current_price: float, recommended_price: float) -> str:
        if current_price <= 0:
            return "Set launch price"
        delta = recommended_price - current_price
        if abs(delta) < 0.5:
            return "Hold current price"
        if delta > 0:
            return f"Increase by {delta:.2f}"
        return f"Decrease by {abs(delta):.2f}"

    def _build_note(self, position: str, min_price: float, avg_price: float, max_price: float, floor_price: float, final_price: float) -> str:
        anchor = {
            "below": f"Undercutting the lowest tracked competitor at {min_price:.2f}.",
            "match": f"Anchored to the market average of {avg_price:.2f}.",
            "above": f"Positioned above the highest tracked competitor at {max_price:.2f}.",
        }.get(position, f"Anchored to the market average of {avg_price:.2f}.")

        if final_price <= floor_price + 0.01:
            return f"{anchor} Margin protection raised the final price to the safe floor."
        return f"{anchor} Dynamic signals and elasticity checks kept the price competitive."

    def _apply_limits(self, value: float, pricing_limits: Dict[str, Any]) -> float:
        minimum = pricing_limits.get("min_price")
        maximum = pricing_limits.get("max_price")
        result = value
        if minimum not in (None, ""):
            result = max(result, float(minimum))
        if maximum not in (None, ""):
            result = min(result, float(maximum))
        return result

    def _round_price(self, value: float, step: float, position: str) -> float:
        if step <= 0:
            return round(value, 2)
        ratio = value / step
        rounded = (
            math.floor(ratio) * step if position == "below"
            else math.ceil(ratio) * step if position == "above"
            else round(ratio) * step
        )
        return round(max(rounded, 0), 2)

    def _numeric_value(self, row: Dict[str, Any], column: Optional[str]) -> float:
        if not column or column not in row:
            return 0.0
        value = row.get(column)
        if value is None:
            return 0.0
        if isinstance(value, (int, float)):
            return float(value)
        cleaned = re.sub(r"[^0-9.\-]", "", str(value))
        if cleaned in ("", "-", ".", "-."):
            return 0.0
        try:
            return float(cleaned)
        except ValueError:
            return 0.0

    def _string_value(self, row: Dict[str, Any], column: Optional[str], fallback: str = "") -> str:
        if not column or column not in row:
            return fallback
        value = row.get(column)
        if value is None:
            return fallback
        text = str(value).strip()
        return text or fallback

    def _margin_pct(self, price: float, cost: float) -> float:
        if price <= 0:
            return 0.0
        return ((price - cost) / price) * 100

    def _pct_change(self, current_price: float, target_price: float) -> float:
        if current_price <= 0:
            return 0.0
        return ((target_price - current_price) / current_price) * 100

    def _confidence_label(self, score: float) -> str:
        if score >= 0.9:
            return "High"
        if score >= 0.75:
            return "Medium"
        return "Low"

    def _humanize_column(self, column: Optional[str]) -> str:
        if not column:
            return "Attribute"
        cleaned = str(column).strip().replace("_", " ").replace("-", " ")
        return re.sub(r"\s+", " ", cleaned).title()

    def _build_display_fields(self, row: Dict[str, Any], mapped_columns: Dict[str, str]) -> List[Dict[str, str]]:
        labels = {
            "product_name": "Product Name",
            "sku": "SKU / Model",
            "current_price": "Current Price",
            "price": "Price",
            "stock": "Stock Qty",
            "rating": "Rating",
            "seller_name": "Seller",
            "demand": "Demand / Velocity",
            "cogs": "COGS",
            "fulfillment": "Fulfillment / Shipping",
            "commission": "Commission",
            "advertising": "Advertising",
        }
        ignored_keys = {"product_url", "image_url"}
        fields: List[Dict[str, str]] = []

        for key, column in mapped_columns.items():
            if key in ignored_keys or not column or column not in row:
                continue
            raw_value = row.get(column)
            if raw_value is None:
                continue
            value = str(raw_value).strip()
            if not value:
                continue
            fields.append(
                {
                    "key": key,
                    "label": labels.get(key, self._humanize_column(key)),
                    "value": value,
                }
            )

        return fields

    def _build_record_fields(self, row: Dict[str, Any]) -> List[Dict[str, str]]:
        fields: List[Dict[str, str]] = []
        for column, value in row.items():
            text = self._coerce_record_value(value)
            if text == "":
                continue
            fields.append(
                {
                    "column": str(column),
                    "label": self._humanize_column(column),
                    "value": text,
                }
            )
        return fields

    def _coerce_record_value(self, value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, float) and math.isnan(value):
            return ""
        text = str(value).strip()
        return text

    def _normalize_separator(self, sep: str) -> str:
        raw = "" if sep is None else str(sep)
        normalized = raw.strip()
        if normalized in ("", "default"):
            return ","
        if normalized.lower() in ("\\t", "tab"):
            return "\t"
        return normalized[0]

    def get_progress(self):
        return self.progress

    def get_results(self):
        return self.results

    def _export_rows(self) -> List[Dict[str, Any]]:
        if not self.results:
            return []
        return self.results.get("rows", [])

    def export_to_csv(self) -> Optional[str]:
        rows = self._export_rows()
        file_path = os.path.join(os.getcwd(), "uploads", f"pricing_results_{self.session_id}.csv")
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        if rows:
            pl.DataFrame(rows).write_csv(file_path)
        else:
            pl.DataFrame({"message": ["No pricing recommendations generated"]}).write_csv(file_path)
        return file_path

    def export_to_excel(self) -> Optional[str]:
        rows = self._export_rows()
        file_path = os.path.join(os.getcwd(), "uploads", f"pricing_results_{self.session_id}.xlsx")
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        if rows:
            pl.DataFrame(rows).write_excel(file_path)
        else:
            pl.DataFrame({"message": ["No pricing recommendations generated"]}).write_excel(file_path)
        return file_path

    def validate(self, config: Dict[str, Any], review_only: bool = False) -> tuple[bool, Optional[str]]:
        match_rules = self._normalize_match_rules(config)
        our_columns = config.get("our_columns", {})
        competitor_sources = self._normalize_competitor_sources(config)

        if not match_rules:
            return False, "Add at least one matching rule"
        for index, rule in enumerate(match_rules, start=1):
            if not rule.get("our_column"):
                return False, f"Select the client column for rule {index}"
        if not review_only and not our_columns.get("current_price"):
            return False, "Select your current price column"
        if not competitor_sources:
            return False, "Add at least one competitor dataset"

        for source in competitor_sources:
            columns = source.get("columns", {})
            if not source.get("dataset_id"):
                return False, "Each competitor source needs a dataset id"
            if not review_only and not columns.get("price"):
                return False, f"Select a price column for {source.get('label', 'a competitor source')}"
            match_columns = source.get("match_columns", {})
            for index, rule in enumerate(match_rules, start=1):
                if not match_columns.get(rule["id"]):
                    return False, f"Select a competitor match column for rule {index} in {source.get('label', 'a competitor source')}"

        return True, None

    @classmethod
    def get_available_algorithms(cls) -> List[Dict[str, Any]]:
        from .matching import DataMatcher

        return DataMatcher.get_available_algorithms()

    @classmethod
    def get_available_strategies(cls) -> List[Dict[str, Any]]:
        return [
            {
                "id": "below",
                "name": "Price Below Market",
                "description": "Beat the lowest competitor to win price-sensitive demand.",
            },
            {
                "id": "match",
                "name": "Price Match Market",
                "description": "Stay aligned with the competitor average for steady categories.",
            },
            {
                "id": "above",
                "name": "Price Above Market",
                "description": "Maintain a premium position when service, bundles, or brand justify it.",
            },
        ]
