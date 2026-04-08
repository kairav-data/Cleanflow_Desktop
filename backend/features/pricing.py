"""
Pricing Intelligence feature for CleanFlow.

This module recommends market-aware product prices by:
- matching internal products to competitor products
- summarizing competitor price positions
- validating prices against internal cost structure
- applying dynamic repricing signals
- testing elasticity scenarios for profitability
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
    """Price recommendation engine built on competitor benchmarks."""

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
                df = pl.read_csv(
                    file_path,
                    separator=sep,
                    ignore_errors=True,
                    truncate_ragged_lines=True,
                    null_values=["", "NA", "NaN"],
                )

            self.datasets[dataset_id] = df
            return df.columns, len(df)
        except Exception as exc:
            logger.exception("Failed to load pricing dataset")
            raise ValueError(f"Failed to load dataset: {exc}") from exc

    async def preview(self, config: Dict[str, Any], limit: int = 5) -> FeatureResult:
        return await self._run_pricing(config, preview_limit=limit)

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

    async def _run_pricing(self, config: Dict[str, Any], preview_limit: Optional[int] = None) -> FeatureResult:
        is_valid, error = self.validate(config)
        if not is_valid:
            return FeatureResult(success=False, error=error)

        our_dataset_id = config.get("our_dataset", "dataset1")
        competitor_dataset_id = config.get("competitor_dataset", "dataset2")

        if our_dataset_id not in self.datasets or competitor_dataset_id not in self.datasets:
            return FeatureResult(success=False, error="Pricing datasets were not loaded")

        our_df = self.datasets[our_dataset_id]
        competitor_df = self.datasets[competitor_dataset_id]

        if preview_limit:
            our_df = our_df.head(preview_limit)
            competitor_df = competitor_df.head(max(preview_limit * 5, preview_limit))

        result = self._build_price_recommendations(our_df, competitor_df, config, preview_limit=preview_limit)
        return FeatureResult(success=True, data=result, metadata=result.get("summary", {}))

    def _build_price_recommendations(
        self,
        our_df: pl.DataFrame,
        competitor_df: pl.DataFrame,
        config: Dict[str, Any],
        preview_limit: Optional[int] = None,
    ) -> Dict[str, Any]:
        match_rule = config.get("match_rule", {})
        our_columns = config.get("our_columns", {})
        competitor_columns = config.get("competitor_columns", {})
        strategy = config.get("strategy", {})
        signals = config.get("signals", {})
        elasticity = config.get("elasticity", {})
        pricing_limits = config.get("pricing_limits", {})

        our_match_col = match_rule.get("our_column")
        competitor_match_col = match_rule.get("competitor_column")
        algorithm = match_rule.get("algorithm", "fuzzy")
        threshold = float(match_rule.get("threshold", 0.8))

        if our_match_col not in our_df.columns or competitor_match_col not in competitor_df.columns:
            raise ValueError("Pricing match columns are missing in one of the datasets")

        self.progress = {"percent": 10, "message": "Matching similar products...", "status": "running"}

        match_method = getattr(
            MatchingAlgorithm,
            MatchingAlgorithm.ALGORITHMS.get(algorithm, "fuzzy_match_batch"),
        )

        def progress_cb(current, total):
            percent = 10 + int((current / total) * 35) if total else 10
            self.progress = {
                "percent": min(percent, 45),
                "message": f"Matching similar products with {algorithm}...",
                "status": "running",
            }

        raw_matches = match_method(
            our_df[our_match_col],
            competitor_df[competitor_match_col],
            threshold,
            progress_callback=progress_cb if preview_limit is None else None,
        )

        grouped_matches: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
        for match in raw_matches:
            grouped_matches[int(match["index1"])].append(match)

        self.progress = {"percent": 55, "message": "Calculating price recommendations...", "status": "running"}

        rows: List[Dict[str, Any]] = []
        matched_products = 0
        price_changes = {"increase": 0, "decrease": 0, "hold": 0}

        for our_index in range(len(our_df)):
            our_row = our_df.row(our_index, named=True)
            matches = grouped_matches.get(our_index, [])
            recommendation = self._score_product(
                our_row=our_row,
                matches=matches,
                competitor_df=competitor_df,
                our_columns=our_columns,
                competitor_columns=competitor_columns,
                strategy=strategy,
                signals=signals,
                elasticity=elasticity,
                pricing_limits=pricing_limits,
            )

            rows.append(recommendation)

            if recommendation["competitor_count"] > 0:
                matched_products += 1

            action = recommendation["pricing_action"]
            if action.startswith("Increase"):
                price_changes["increase"] += 1
            elif action.startswith("Decrease"):
                price_changes["decrease"] += 1
            else:
                price_changes["hold"] += 1

        rows.sort(
            key=lambda row: (
                row.get("competitor_count", 0),
                row.get("margin_pct", 0.0),
                row.get("match_score", 0.0),
            ),
            reverse=True,
        )

        summary = self._build_summary(rows, len(our_df), matched_products, strategy, price_changes)

        self.progress = {"percent": 95, "message": "Finalizing output...", "status": "running"}

        return {
            "summary": summary,
            "rows": rows if preview_limit is None else rows[:preview_limit],
        }

    def _score_product(
        self,
        our_row: Dict[str, Any],
        matches: List[Dict[str, Any]],
        competitor_df: pl.DataFrame,
        our_columns: Dict[str, str],
        competitor_columns: Dict[str, str],
        strategy: Dict[str, Any],
        signals: Dict[str, Any],
        elasticity: Dict[str, Any],
        pricing_limits: Dict[str, Any],
    ) -> Dict[str, Any]:
        our_product_label = self._string_value(
            our_row,
            our_columns.get("product_name") or our_columns.get("match_name"),
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

        competitor_entries = self._collect_competitor_entries(matches, competitor_df, competitor_columns)
        competitor_prices = [entry["price"] for entry in competitor_entries if entry["price"] is not None]
        competitor_ratings = [entry["rating"] for entry in competitor_entries if entry["rating"] is not None]
        competitor_names = [entry["seller"] for entry in competitor_entries if entry["seller"]]

        if not competitor_prices:
            recommended_price = current_price or self._cost_floor(total_cost, float(strategy.get("min_margin_pct", 15)))
            recommended_price = self._apply_limits(recommended_price, pricing_limits)
            margin_pct = self._margin_pct(recommended_price, total_cost)
            return {
                "product_name": our_product_label,
                "sku": sku,
                "current_price": round(current_price, 2),
                "recommended_price": round(recommended_price, 2),
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
                "elasticity_best_price": round(recommended_price, 2),
                "elasticity_best_profit_index": round(max(recommended_price - total_cost, 0), 2),
                "recommended_vs_current_pct": round(self._pct_change(current_price, recommended_price), 2),
                "note": "Upload or match more competitor rows to improve the recommendation.",
            }

        min_price = min(competitor_prices)
        avg_price = sum(competitor_prices) / len(competitor_prices)
        max_price = max(competitor_prices)
        match_score = sum(item.get("similarity_score", 0.0) for item in matches) / max(len(matches), 1)

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

        margin_pct = self._margin_pct(final_price, total_cost)
        price_action = self._action_label(current_price, final_price)

        return {
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
            "margin_pct": round(margin_pct, 2),
            "floor_price": round(floor_price, 2),
            "pricing_action": price_action,
            "strategy": position,
            "matched_competitors": ", ".join(sorted(set(competitor_names)))[:160],
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

    def _collect_competitor_entries(
        self,
        matches: List[Dict[str, Any]],
        competitor_df: pl.DataFrame,
        competitor_columns: Dict[str, str],
    ) -> List[Dict[str, Any]]:
        entries: List[Dict[str, Any]] = []
        seen_rows = set()
        price_col = competitor_columns.get("price")

        for match in sorted(matches, key=lambda item: item.get("similarity_score", 0), reverse=True):
            competitor_index = int(match["index2"])
            if competitor_index in seen_rows:
                continue
            seen_rows.add(competitor_index)

            try:
                competitor_row = competitor_df.row(competitor_index, named=True)
            except Exception:
                continue

            price = self._numeric_value(competitor_row, price_col)
            if price <= 0:
                continue

            entries.append(
                {
                    "price": price,
                    "seller": self._string_value(competitor_row, competitor_columns.get("seller_name")),
                    "rating": self._numeric_value(competitor_row, competitor_columns.get("rating")),
                    "similarity_score": float(match.get("similarity_score", 0.0)),
                }
            )

        return entries

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
            if not stock_column:
                return "normal"
            raw_stock_value = our_row.get(stock_column)
            if raw_stock_value in (None, ""):
                return "normal"
            stock_value = self._numeric_value(our_row, stock_column)
            low_threshold = float(signals.get("stock_low_threshold", 15) or 15)
            critical_threshold = float(signals.get("stock_critical_threshold", 5) or 5)
            if stock_value <= critical_threshold:
                return "critical"
            if stock_value <= low_threshold:
                return "low"
            return "normal"

        if signal_type == "demand":
            demand_value = self._numeric_value(our_row, our_columns.get("demand"))
            rising_threshold = float(signals.get("demand_rising_threshold", 60) or 60)
            surging_threshold = float(signals.get("demand_surging_threshold", 85) or 85)
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
            unit_profit = max(candidate - total_cost, 0)
            profit_index = demand_index * unit_profit

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
        }

    def _cost_floor(self, total_cost: float, min_margin_pct: float) -> float:
        if total_cost <= 0:
            return 0.0
        margin_decimal = min(max(min_margin_pct / 100.0, 0.0), 0.95)
        denominator = max(1 - margin_decimal, 0.05)
        return total_cost / denominator

    def _action_label(self, current_price: float, recommended_price: float) -> str:
        if current_price <= 0:
            return "Set launch price"
        delta = recommended_price - current_price
        if abs(delta) < 0.5:
            return "Hold current price"
        if delta > 0:
            return f"Increase by {delta:.2f}"
        return f"Decrease by {abs(delta):.2f}"

    def _build_note(
        self,
        position: str,
        min_price: float,
        avg_price: float,
        max_price: float,
        floor_price: float,
        final_price: float,
    ) -> str:
        market_anchor = {
            "below": f"Undercutting the lowest tracked competitor at {min_price:.2f}.",
            "match": f"Anchored to the market average of {avg_price:.2f}.",
            "above": f"Positioned above the highest tracked competitor at {max_price:.2f}.",
        }.get(position, f"Anchored to the market average of {avg_price:.2f}.")

        if final_price <= floor_price + 0.01:
            return f"{market_anchor} Margin protection raised the final price to the safe floor."
        return f"{market_anchor} Dynamic signals and elasticity checks kept the price market-competitive."

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
        if position == "below":
            rounded = math.floor(ratio) * step
        elif position == "above":
            rounded = math.ceil(ratio) * step
        else:
            rounded = round(ratio) * step
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

    def _pct_change(self, current_price: float, recommended_price: float) -> float:
        if current_price <= 0:
            return 0.0
        return ((recommended_price - current_price) / current_price) * 100

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

    def validate(self, config: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        match_rule = config.get("match_rule", {})
        our_columns = config.get("our_columns", {})
        competitor_columns = config.get("competitor_columns", {})

        if not match_rule.get("our_column") or not match_rule.get("competitor_column"):
            return False, "Select product columns for internal and competitor matching"

        if not our_columns.get("current_price"):
            return False, "Select your current price column"

        if not competitor_columns.get("price"):
            return False, "Select the competitor price column"

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
