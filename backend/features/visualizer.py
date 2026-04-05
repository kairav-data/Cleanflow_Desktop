"""
AI Visualizer Engine  –  CleanFlow
Intelligently analyzes a dataset and returns a set of
ready-to-render chart configurations + KPI tiles.
No external LLM API is needed. The "AI" is fast, rule-based
column-type inference + statistical analysis using Polars.
"""

from __future__ import annotations
import math
import polars as pl
from typing import Any


# ── helpers ────────────────────────────────────────────────────────────────

CHART_COLORS = [
    "#6366f1", "#10b981", "#f59e0b", "#ef4444",
    "#8b5cf6", "#06b6d4", "#f97316", "#84cc16",
    "#ec4899", "#14b8a6",
]

GRADIENT_PAIRS = [
    ["#6366f1", "#818cf8"],
    ["#10b981", "#34d399"],
    ["#f59e0b", "#fbbf24"],
    ["#ef4444", "#f87171"],
    ["#8b5cf6", "#a78bfa"],
    ["#06b6d4", "#22d3ee"],
]


def _safe_float(v) -> float:
    try:
        return float(v)
    except Exception:
        return 0.0


def _truncate_label(s: str, max_len: int = 18) -> str:
    s = str(s)
    return s if len(s) <= max_len else s[:max_len - 1] + "…"


# ── column-type detection ──────────────────────────────────────────────────

def _detect_column_types(df: pl.DataFrame) -> dict[str, str]:
    """Returns a dict col_name -> 'numeric' | 'categorical' | 'datetime' | 'boolean'"""
    result: dict[str, str] = {}
    for col in df.columns:
        dtype = df[col].dtype

        if dtype in (pl.Boolean,):
            result[col] = "boolean"
        elif dtype in (
            pl.Int8, pl.Int16, pl.Int32, pl.Int64,
            pl.UInt8, pl.UInt16, pl.UInt32, pl.UInt64,
            pl.Float32, pl.Float64,
        ):
            result[col] = "numeric"
        elif dtype in (pl.Date, pl.Datetime, pl.Time):
            result[col] = "datetime"
        elif dtype == pl.Utf8:
            # Heuristic: try casting to float on a sample
            sample = df[col].drop_nulls().head(20)
            try:
                sample.cast(pl.Float64)
                result[col] = "numeric"
            except Exception:
                result[col] = "categorical"
        else:
            result[col] = "categorical"
    return result


# ── chart builders ─────────────────────────────────────────────────────────

def _build_bar_chart(
    df: pl.DataFrame, cat_col: str, num_col: str, color_idx: int
) -> dict[str, Any]:
    """Categorical × Numeric → Bar chart"""
    try:
        grouped = (
            df.select([cat_col, num_col])
            .drop_nulls()
            .group_by(cat_col)
            .agg(pl.col(num_col).mean().alias("value"))
            .sort("value", descending=True)
            .head(12)
        )
        data = [
            {
                "name": _truncate_label(row[cat_col]),
                "value": round(_safe_float(row["value"]), 2),
            }
            for row in grouped.to_dicts()
        ]
        if not data:
            return None
        return {
            "type": "bar",
            "title": f"{num_col} by {cat_col}",
            "description": f"Average {num_col} grouped by {cat_col}",
            "xKey": "name",
            "dataKey": "value",
            "color": CHART_COLORS[color_idx % len(CHART_COLORS)],
            "gradient": GRADIENT_PAIRS[color_idx % len(GRADIENT_PAIRS)],
            "data": data,
        }
    except Exception:
        return None


def _build_area_chart(
    df: pl.DataFrame, num_col: str, color_idx: int
) -> dict[str, Any]:
    """Numeric distribution → Area chart (row-indexed)"""
    try:
        series = (
            df.select(num_col)
            .drop_nulls()
            .head(60)
            .with_row_index("idx")
        )
        data = [
            {"idx": row["idx"], "value": round(_safe_float(row[num_col]), 3)}
            for row in series.to_dicts()
        ]
        if len(data) < 3:
            return None
        return {
            "type": "area",
            "title": f"{num_col} Trend",
            "description": f"Distribution of {num_col} across rows",
            "xKey": "idx",
            "dataKey": "value",
            "color": CHART_COLORS[color_idx % len(CHART_COLORS)],
            "gradient": GRADIENT_PAIRS[color_idx % len(GRADIENT_PAIRS)],
            "data": data,
        }
    except Exception:
        return None


def _build_pie_chart(
    df: pl.DataFrame, cat_col: str, color_idx: int
) -> dict[str, Any]:
    """Low-cardinality categorical → Pie chart"""
    try:
        counts = (
            df.select(cat_col)
            .drop_nulls()
            .group_by(cat_col)
            .count()
            .sort("count", descending=True)
            .head(8)
        )
        data = [
            {
                "name": _truncate_label(row[cat_col]),
                "value": int(row["count"]),
                "color": CHART_COLORS[(color_idx + i) % len(CHART_COLORS)],
            }
            for i, row in enumerate(counts.to_dicts())
        ]
        if not data:
            return None
        return {
            "type": "pie",
            "title": f"{cat_col} Distribution",
            "description": f"Proportion breakdown of {cat_col} values",
            "data": data,
            "color": CHART_COLORS[color_idx % len(CHART_COLORS)],
            "gradient": GRADIENT_PAIRS[color_idx % len(GRADIENT_PAIRS)],
        }
    except Exception:
        return None


def _build_scatter_chart(
    df: pl.DataFrame, x_col: str, y_col: str, color_idx: int
) -> dict[str, Any]:
    """Numeric × Numeric → Scatter chart"""
    try:
        sample = (
            df.select([x_col, y_col])
            .drop_nulls()
            .sample(n=min(200, len(df)), seed=42)
        )
        data = [
            {"x": round(_safe_float(r[x_col]), 3), "y": round(_safe_float(r[y_col]), 3)}
            for r in sample.to_dicts()
        ]
        if len(data) < 5:
            return None
        return {
            "type": "scatter",
            "title": f"{x_col} vs {y_col}",
            "description": f"Correlation between {x_col} and {y_col}",
            "xKey": "x",
            "dataKey": "y",
            "xAxisLabel": x_col,
            "yAxisLabel": y_col,
            "color": CHART_COLORS[color_idx % len(CHART_COLORS)],
            "gradient": GRADIENT_PAIRS[color_idx % len(GRADIENT_PAIRS)],
            "data": data,
        }
    except Exception:
        return None


def _build_line_chart(
    df: pl.DataFrame, date_col: str, num_col: str, color_idx: int
) -> dict[str, Any]:
    """Datetime × Numeric → Line chart"""
    try:
        series = (
            df.select([date_col, num_col])
            .drop_nulls()
            .sort(date_col)
            .head(60)
        )
        data = [
            {
                "name": str(row[date_col])[:10],
                "value": round(_safe_float(row[num_col]), 3),
            }
            for row in series.to_dicts()
        ]
        if len(data) < 3:
            return None
        return {
            "type": "line",
            "title": f"{num_col} over Time",
            "description": f"{num_col} trend along {date_col}",
            "xKey": "name",
            "dataKey": "value",
            "color": CHART_COLORS[color_idx % len(CHART_COLORS)],
            "gradient": GRADIENT_PAIRS[color_idx % len(GRADIENT_PAIRS)],
            "data": data,
        }
    except Exception:
        return None


# ── KPI tile builder ───────────────────────────────────────────────────────

def _build_kpis(df: pl.DataFrame, col_types: dict[str, str]) -> list[dict]:
    kpis = []
    numeric_cols = [c for c, t in col_types.items() if t == "numeric"]
    total_rows = len(df)
    null_count = sum(df[c].null_count() for c in df.columns)
    total_cells = total_rows * len(df.columns)

    kpis.append({
        "label": "Total Rows",
        "value": f"{total_rows:,}",
        "icon": "rows",
        "color": "#6366f1",
    })
    kpis.append({
        "label": "Columns",
        "value": str(len(df.columns)),
        "icon": "columns",
        "color": "#10b981",
    })
    completeness = round((1 - null_count / max(total_cells, 1)) * 100, 1)
    kpis.append({
        "label": "Data Completeness",
        "value": f"{completeness}%",
        "icon": "check",
        "color": "#f59e0b",
    })
    if numeric_cols:
        col = numeric_cols[0]
        try:
            mean_val = df[col].mean()
            kpis.append({
                "label": f"Avg {col[:14]}",
                "value": f"{mean_val:,.2f}" if mean_val is not None else "—",
                "icon": "stats",
                "color": "#8b5cf6",
            })
        except Exception:
            pass
    return kpis


# ── main analysis function ─────────────────────────────────────────────────

def analyze(df: pl.DataFrame) -> dict[str, Any]:
    """
    Entry-point called by the FastAPI endpoint.
    Returns { kpis, charts, summary }
    """
    col_types = _detect_column_types(df)
    numeric_cols = [c for c, t in col_types.items() if t == "numeric"]
    categorical_cols = [c for c, t in col_types.items() if t == "categorical"]
    datetime_cols = [c for c, t in col_types.items() if t == "datetime"]
    boolean_cols = [c for c, t in col_types.items() if t == "boolean"]

    charts: list[dict] = []
    color_idx = 0

    # 1. Bar charts  (cat × num, up to 3)
    for cat in categorical_cols[:3]:
        cardinality = df[cat].n_unique()
        if 2 <= cardinality <= 30:
            for num in numeric_cols[:2]:
                chart = _build_bar_chart(df, cat, num, color_idx)
                if chart:
                    charts.append(chart)
                    color_idx += 1
                if color_idx >= 3:
                    break
        if color_idx >= 3:
            break

    # 2. Pie charts (low-cardinality categorical, up to 2)
    for cat in categorical_cols:
        cardinality = df[cat].n_unique()
        if 2 <= cardinality <= 8:
            chart = _build_pie_chart(df, cat, color_idx)
            if chart:
                charts.append(chart)
                color_idx += 1
            if color_idx >= 5:
                break

    # 3. Line charts (datetime × numeric, up to 2)
    for dc in datetime_cols[:2]:
        for num in numeric_cols[:2]:
            chart = _build_line_chart(df, dc, num, color_idx)
            if chart:
                charts.append(chart)
                color_idx += 1

    # 4. Area charts for numeric columns (up to 2)
    for num in numeric_cols[:2]:
        chart = _build_area_chart(df, num, color_idx)
        if chart:
            charts.append(chart)
            color_idx += 1

    # 5. Scatter chart (first two numeric columns)
    if len(numeric_cols) >= 2:
        chart = _build_scatter_chart(df, numeric_cols[0], numeric_cols[1], color_idx)
        if chart:
            charts.append(chart)
            color_idx += 1

    # 6. Boolean distribution as bar
    for bc in boolean_cols[:2]:
        try:
            counts = df.select(bc).drop_nulls().group_by(bc).count().to_dicts()
            data = [{"name": str(r[bc]), "value": r["count"]} for r in counts]
            charts.append({
                "type": "bar",
                "title": f"{bc} Distribution",
                "description": f"True/False breakdown of {bc}",
                "xKey": "name",
                "dataKey": "value",
                "color": CHART_COLORS[color_idx % len(CHART_COLORS)],
                "gradient": GRADIENT_PAIRS[color_idx % len(GRADIENT_PAIRS)],
                "data": data,
            })
            color_idx += 1
        except Exception:
            pass

    # Build column summary
    col_summary = []
    for col in df.columns:
        col_type = col_types.get(col, "unknown")
        null_pct = round(df[col].null_count() / max(len(df), 1) * 100, 1)
        entry = {
            "name": col,
            "type": col_type,
            "nullPct": null_pct,
            "unique": df[col].n_unique(),
        }
        if col_type == "numeric":
            try:
                entry["min"] = round(_safe_float(df[col].min()), 3)
                entry["max"] = round(_safe_float(df[col].max()), 3)
                entry["mean"] = round(_safe_float(df[col].mean()), 3)
            except Exception:
                pass
        col_summary.append(entry)

    return {
        "kpis": _build_kpis(df, col_types),
        "charts": charts,
        "columnSummary": col_summary,
        "totalRows": len(df),
        "totalColumns": len(df.columns),
    }
