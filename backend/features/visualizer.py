"""
AI Visualizer Engine  –  CleanFlow
=====================================
Two analysis paths share the same chart-builder library:

  1. [AI path]   analyze_with_ai(df, user_prompt, hf_api_key)
     - Builds a compact schema summary from the dataset
     - Sends schema + user prompt to Qwen/Qwen2.5-72B-Instruct via HF InferenceClient
     - Qwen returns chart *specifications* (which columns, which type, title, description)
     - Backend resolves each spec into real aggregated data using Polars
     - Falls back to rule-based if HF call fails

  2. [Rule-based path]   analyze(df)
     - Fast heuristic column-type-inference + statistics (no external API)
     - Used when no prompt is supplied or when HF is unavailable
"""

from __future__ import annotations
import json
import logging
import math
import re
import polars as pl
from typing import Any, Optional

logger = logging.getLogger(__name__)

# ── Palette ────────────────────────────────────────────────────────────────

CHART_COLORS = [
    "#005999", "#0072C6", "#4DA1FF", "#99C9FF", # Deep Tableau Blues
    "#00A3AD", "#00BFB3", "#707070", "#9E9E9E", # Teal/Greys
    "#4E79A7", "#A0CBE8", # Classic Tableau
]

GRADIENT_PAIRS = [
    ["#005999", "#0072C6"],
    ["#0072C6", "#4DA1FF"],
    ["#00A3AD", "#00BFB3"],
    ["#4E79A7", "#A0CBE8"],
    ["#707070", "#9E9E9E"],
]


# ── Utility helpers ────────────────────────────────────────────────────────

def _safe_float(v) -> float:
    try:
        return float(v)
    except Exception:
        return 0.0


def _truncate_label(s: str, max_len: int = 18) -> str:
    s = str(s)
    return s if len(s) <= max_len else s[:max_len - 1] + "…"


# ── Column-type detection ──────────────────────────────────────────────────

def _detect_column_types(df: pl.DataFrame) -> dict[str, str]:
    """Returns {col_name: 'numeric' | 'categorical' | 'datetime' | 'boolean'}"""
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
            sample = df[col].drop_nulls().head(20)
            try:
                sample.cast(pl.Float64)
                result[col] = "numeric"
            except Exception:
                result[col] = "categorical"
        else:
            result[col] = "categorical"
    return result


# ── Chart builders (shared by both paths) ──────────────────────────────────

def _build_bar_chart(df: pl.DataFrame, cat_col: str, num_col: str, color_idx: int) -> dict[str, Any] | None:
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
            {"name": _truncate_label(row[cat_col]), "value": round(_safe_float(row["value"]), 2)}
            for row in grouped.to_dicts()
        ]
        if not data:
            return None
        return {
            "type": "bar",
            "title": f"{num_col} by {cat_col}",
            "description": f"Average {num_col} grouped by {cat_col}",
            "xKey": "name", "dataKey": "value",
            "color": CHART_COLORS[color_idx % len(CHART_COLORS)],
            "gradient": GRADIENT_PAIRS[color_idx % len(GRADIENT_PAIRS)],
            "data": data,
        }
    except Exception:
        return None


def _build_area_chart(df: pl.DataFrame, num_col: str, color_idx: int) -> dict[str, Any] | None:
    try:
        series = df.select(num_col).drop_nulls().head(60).with_row_index("idx")
        data = [{"idx": r["idx"], "value": round(_safe_float(r[num_col]), 3)} for r in series.to_dicts()]
        if len(data) < 3:
            return None
        return {
            "type": "area",
            "title": f"{num_col} Trend",
            "description": f"Distribution of {num_col} across rows",
            "xKey": "idx", "dataKey": "value",
            "color": CHART_COLORS[color_idx % len(CHART_COLORS)],
            "gradient": GRADIENT_PAIRS[color_idx % len(GRADIENT_PAIRS)],
            "data": data,
        }
    except Exception:
        return None


def _build_pie_chart(df: pl.DataFrame, cat_col: str, color_idx: int) -> dict[str, Any] | None:
    try:
        counts = (
            df.select(cat_col).drop_nulls()
            .group_by(cat_col).count()
            .sort("count", descending=True).head(8)
        )
        data = [
            {"name": _truncate_label(row[cat_col]), "value": int(row["count"]),
             "color": CHART_COLORS[(color_idx + i) % len(CHART_COLORS)]}
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


def _build_scatter_chart(df: pl.DataFrame, x_col: str, y_col: str, color_idx: int) -> dict[str, Any] | None:
    try:
        sample = df.select([x_col, y_col]).drop_nulls().sample(n=min(200, len(df)), seed=42)
        data = [{"x": round(_safe_float(r[x_col]), 3), "y": round(_safe_float(r[y_col]), 3)} for r in sample.to_dicts()]
        if len(data) < 5:
            return None
        return {
            "type": "scatter",
            "title": f"{x_col} vs {y_col}",
            "description": f"Correlation between {x_col} and {y_col}",
            "xKey": "x", "dataKey": "y",
            "xAxisLabel": x_col, "yAxisLabel": y_col,
            "color": CHART_COLORS[color_idx % len(CHART_COLORS)],
            "gradient": GRADIENT_PAIRS[color_idx % len(GRADIENT_PAIRS)],
            "data": data,
        }
    except Exception:
        return None


def _build_line_chart(df: pl.DataFrame, date_col: str, num_col: str, color_idx: int) -> dict[str, Any] | None:
    try:
        series = df.select([date_col, num_col]).drop_nulls().sort(date_col).head(60)
        data = [{"name": str(r[date_col])[:10], "value": round(_safe_float(r[num_col]), 3)} for r in series.to_dicts()]
        if len(data) < 3:
            return None
        return {
            "type": "line",
            "title": f"{num_col} over Time",
            "description": f"{num_col} trend along {date_col}",
            "xKey": "name", "dataKey": "value",
            "color": CHART_COLORS[color_idx % len(CHART_COLORS)],
            "gradient": GRADIENT_PAIRS[color_idx % len(GRADIENT_PAIRS)],
            "data": data,
        }
    except Exception:
        return None


def _build_funnel_chart(df: pl.DataFrame, cat_col: str, num_col: str, color_idx: int) -> dict[str, Any] | None:
    try:
        grouped = (
            df.select([cat_col, num_col])
            .drop_nulls()
            .group_by(cat_col)
            .agg(pl.col(num_col).sum().alias("value"))
            .sort("value", descending=True)
            .head(6)
        )
        data = [
            {"name": _truncate_label(row[cat_col]), "value": round(_safe_float(row["value"]), 2)}
            for row in grouped.to_dicts()
        ]
        if len(data) < 3:
            return None
        return {
            "type": "funnel",
            "title": f"{num_col} Conversion Funnel",
            "description": f"Funnel visualization of {num_col} across {cat_col} stages",
            "data": data,
            "color": CHART_COLORS[color_idx % len(CHART_COLORS)],
            "gradient": GRADIENT_PAIRS[color_idx % len(GRADIENT_PAIRS)],
        }
    except Exception:
        return None


def _build_map_chart(df: pl.DataFrame, loc_col: str, val_col: str, color_idx: int) -> dict[str, Any] | None:
    try:
        # Aggregating by location
        grouped = (
            df.select([loc_col, val_col])
            .drop_nulls()
            .group_by(loc_col)
            .agg(pl.col(val_col).sum().alias("value"))
            .sort("value", descending=True)
            .head(15)
        )
        data = [
            {"location": str(row[loc_col]), "value": round(_safe_float(row["value"]), 2)}
            for row in grouped.to_dicts()
        ]
        if not data:
            return None
        return {
            "type": "map",
            "title": f"Geographic Distribution of {val_col}",
            "description": f"{val_col} mapped by {loc_col}",
            "data": data,
            "locKey": "location",
            "valKey": "value",
            "color": CHART_COLORS[color_idx % len(CHART_COLORS)],
            "gradient": GRADIENT_PAIRS[color_idx % len(GRADIENT_PAIRS)],
        }
    except Exception:
        return None


# ── KPI builder ─────────────────────────────────────────────────────────────

def _build_kpis(df: pl.DataFrame, col_types: dict[str, str]) -> list[dict]:
    numeric_cols = [c for c, t in col_types.items() if t == "numeric"]
    categorical_cols = [c for c, t in col_types.items() if t == "categorical"]
    datetime_cols = [c for c, t in col_types.items() if t == "datetime"]
    total_rows = len(df)
    null_count = sum(df[c].null_count() for c in df.columns)
    total_cells = total_rows * len(df.columns)
    completeness = round((1 - null_count / max(total_cells, 1)) * 100, 1)
    duplicate_rows = 0
    try:
        duplicate_rows = max(total_rows - df.unique().height, 0)
    except Exception:
        duplicate_rows = 0

    kpis = [
        {
            "label": "Total Rows",
            "value": f"{total_rows:,}",
            "icon": "rows",
            "color": "#6366f1",
            "hint": "Records currently loaded into the dashboard",
        },
        {
            "label": "Columns",
            "value": str(len(df.columns)),
            "icon": "columns",
            "color": "#10b981",
            "hint": "Available attributes across the dataset",
        },
        {
            "label": "Data Completeness",
            "value": f"{completeness}%",
            "icon": "check",
            "color": "#f59e0b",
            "hint": f"{null_count:,} missing values across all cells",
        },
    ]
    if numeric_cols:
        col = numeric_cols[0]
        try:
            mean_val = df[col].mean()
            kpis.append(
                {
                    "label": f"Avg {col[:14]}",
                    "value": f"{mean_val:,.2f}" if mean_val is not None else "—",
                    "icon": "stats",
                    "color": "#8b5cf6",
                    "hint": f"First numeric metric selected from {len(numeric_cols)} numeric columns",
                }
            )
        except Exception:
            pass
    if categorical_cols:
        kpis.append(
            {
                "label": "Dimensions",
                "value": str(len(categorical_cols)),
                "icon": "segments",
                "color": "#0ea5e9",
                "hint": "Categorical columns available for grouping and slicing",
            }
        )
    if datetime_cols:
        kpis.append(
            {
                "label": "Time Columns",
                "value": str(len(datetime_cols)),
                "icon": "time",
                "color": "#ec4899",
                "hint": "Columns that can support trend and seasonality analysis",
            }
        )
    kpis.append(
        {
            "label": "Duplicate Rows",
            "value": f"{duplicate_rows:,}",
            "icon": "duplicate",
            "color": "#f97316",
            "hint": "Potential repeated records detected row by row",
        }
    )
    return kpis


def _build_dataset_profile(
    df: pl.DataFrame,
    col_types: dict[str, str],
    charts_count: int = 0,
    ai_used: bool = False,
    user_prompt: str = "",
) -> dict[str, Any]:
    total_rows = len(df)
    total_columns = len(df.columns)
    null_count = sum(df[c].null_count() for c in df.columns)
    total_cells = max(total_rows * total_columns, 1)
    completeness_pct = round((1 - null_count / total_cells) * 100, 1)
    missing_pct = round(100 - completeness_pct, 1)

    type_counts = {
        "numeric": sum(1 for kind in col_types.values() if kind == "numeric"),
        "categorical": sum(1 for kind in col_types.values() if kind == "categorical"),
        "datetime": sum(1 for kind in col_types.values() if kind == "datetime"),
        "boolean": sum(1 for kind in col_types.values() if kind == "boolean"),
    }

    duplicate_rows = 0
    try:
        duplicate_rows = max(total_rows - df.unique().height, 0)
    except Exception:
        duplicate_rows = 0
    duplicate_pct = round((duplicate_rows / max(total_rows, 1)) * 100, 1)

    columns_with_missing = sum(1 for column in df.columns if df[column].null_count() > 0)
    sparse_columns = []
    high_cardinality_columns = []
    for column in df.columns:
        null_pct = round(df[column].null_count() / max(total_rows, 1) * 100, 1)
        unique_count = df[column].n_unique()
        if null_pct >= 20:
            sparse_columns.append(column)
        if unique_count >= max(min(total_rows // 2, 200), 25):
            high_cardinality_columns.append(column)

    quality_score = round(
        max(
            0.0,
            min(
                100.0,
                completeness_pct
                - min(duplicate_pct * 0.8, 15)
                - min((len(sparse_columns) / max(total_columns, 1)) * 20, 12),
            ),
        ),
        1,
    )
    readiness_score = round(
        min(
            100.0,
            quality_score * 0.55
            + min(type_counts["numeric"] * 6, 18)
            + min(type_counts["categorical"] * 4, 16)
            + min(type_counts["datetime"] * 8, 16)
            + min(charts_count * 4, 20),
        ),
        1,
    )

    if readiness_score >= 85:
        readiness_label = "High"
    elif readiness_score >= 65:
        readiness_label = "Medium"
    else:
        readiness_label = "Low"

    return {
        "qualityScore": quality_score,
        "readinessScore": readiness_score,
        "readinessLabel": readiness_label,
        "completenessPct": completeness_pct,
        "missingPct": missing_pct,
        "nullCount": int(null_count),
        "duplicateRows": int(duplicate_rows),
        "duplicatePct": duplicate_pct,
        "columnsWithMissing": columns_with_missing,
        "chartCount": charts_count,
        "aiUsed": ai_used,
        "promptUsed": bool(user_prompt.strip()),
        "typeCounts": type_counts,
        "sparseColumns": sparse_columns[:8],
        "highCardinalityColumns": high_cardinality_columns[:8],
    }


def _build_top_columns(
    df: pl.DataFrame,
    col_types: dict[str, str],
    metric: str,
    limit: int = 5,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    total_rows = max(len(df), 1)

    for column in df.columns:
        null_pct = round(df[column].null_count() / total_rows * 100, 1)
        unique_count = df[column].n_unique()
        entry = {
            "name": column,
            "type": col_types.get(column, "categorical"),
            "nullPct": null_pct,
            "unique": unique_count,
        }
        if metric == "null_pct":
            entry["score"] = null_pct
        elif metric == "uniqueness":
            entry["score"] = round((unique_count / total_rows) * 100, 1)
        else:
            entry["score"] = 0
        rows.append(entry)

    return sorted(rows, key=lambda item: item.get("score", 0), reverse=True)[:limit]


def _build_insight_cards(
    df: pl.DataFrame,
    col_types: dict[str, str],
    charts_count: int,
    ai_used: bool,
    user_prompt: str,
) -> list[dict[str, str]]:
    profile = _build_dataset_profile(df, col_types, charts_count=charts_count, ai_used=ai_used, user_prompt=user_prompt)
    type_counts = profile["typeCounts"]
    metric_columns = type_counts["numeric"]
    dimension_columns = type_counts["categorical"]

    chart_note = (
        f"{charts_count} charts prepared from the dataset schema."
        if charts_count
        else "No charts could be prepared from the available schema."
    )

    return [
        {
            "title": "Dataset Readiness",
            "value": f"{profile['readinessScore']}%",
            "description": f"{profile['readinessLabel']} readiness based on quality, schema mix, and chartability.",
            "tone": "violet",
        },
        {
            "title": "Quality Score",
            "value": f"{profile['qualityScore']}%",
            "description": f"{profile['nullCount']:,} missing values and {profile['duplicateRows']:,} possible duplicate rows detected.",
            "tone": "emerald" if profile["qualityScore"] >= 85 else "amber" if profile["qualityScore"] >= 65 else "rose",
        },
        {
            "title": "Schema Mix",
            "value": f"{dimension_columns}D / {metric_columns}M",
            "description": f"{dimension_columns} dimensions and {metric_columns} metrics available for slicing and comparison.",
            "tone": "sky",
        },
        {
            "title": "AI Coverage",
            "value": "AI-guided" if ai_used else "Auto heuristics",
            "description": (user_prompt.strip() and ai_used)
            and "Dashboard refined from your prompt and dataset schema."
            or chart_note,
            "tone": "indigo",
        },
    ]


def _build_dashboard_summary(
    df: pl.DataFrame,
    col_types: dict[str, str],
    charts: list[dict[str, Any]],
    ai_used: bool = False,
    user_prompt: str = "",
) -> dict[str, Any]:
    profile = _build_dataset_profile(
        df,
        col_types,
        charts_count=len(charts),
        ai_used=ai_used,
        user_prompt=user_prompt,
    )

    quality_band = "Strong" if profile["qualityScore"] >= 85 else "Needs review" if profile["qualityScore"] < 65 else "Good"
    summary_text = (
        f"This dataset contains {len(df):,} rows across {len(df.columns)} columns. "
        f"Overall completeness is {profile['completenessPct']}%, with {profile['duplicateRows']:,} potential duplicate rows. "
        f"The schema includes {profile['typeCounts']['numeric']} numeric, {profile['typeCounts']['categorical']} categorical, "
        f"{profile['typeCounts']['datetime']} datetime, and {profile['typeCounts']['boolean']} boolean columns."
    )

    return {
        "headline": "AI dataset intelligence",
        "summary": summary_text,
        "qualityBand": quality_band,
        "profile": profile,
        "insightCards": _build_insight_cards(df, col_types, len(charts), ai_used, user_prompt),
        "topNullColumns": _build_top_columns(df, col_types, "null_pct", limit=5),
        "topUniqueColumns": _build_top_columns(df, col_types, "uniqueness", limit=5),
    }


# ── Column summary ───────────────────────────────────────────────────────────

def _build_column_summary(df: pl.DataFrame, col_types: dict[str, str]) -> list[dict]:
    summary = []
    for col in df.columns:
        col_type = col_types.get(col, "unknown")
        null_pct = round(df[col].null_count() / max(len(df), 1) * 100, 1)
        entry = {"name": col, "type": col_type, "nullPct": null_pct, "unique": df[col].n_unique()}
        if col_type == "numeric":
            try:
                entry["min"]  = round(_safe_float(df[col].min()),  3)
                entry["max"]  = round(_safe_float(df[col].max()),  3)
                entry["mean"] = round(_safe_float(df[col].mean()), 3)
            except Exception:
                pass
        summary.append(entry)
    return summary


# ── Dataset schema text (fed to Qwen) ──────────────────────────────────────

def _build_dataset_schema(df: pl.DataFrame, col_types: dict[str, str]) -> str:
    """
    Produces a compact plain-text description of the dataset so the AI
    can understand it without seeing every row.
    """
    lines = [f"Dataset: {len(df):,} rows × {len(df.columns)} columns\n"]
    for col in df.columns:
        ctype = col_types.get(col, "unknown")
        n_unique = df[col].n_unique()
        null_pct = round(df[col].null_count() / max(len(df), 1) * 100, 1)

        info = f"  [{ctype}] {col}  |  unique={n_unique}  null={null_pct}%"

        if ctype == "numeric":
            try:
                mn = round(_safe_float(df[col].min()), 3)
                mx = round(_safe_float(df[col].max()), 3)
                mean = round(_safe_float(df[col].mean()), 3)
                info += f"  |  min={mn}  max={mx}  mean={mean}"
            except Exception:
                pass
        elif ctype == "categorical":
            try:
                top_vals = (
                    df.select(col).drop_nulls()
                    .group_by(col).count()
                    .sort("count", descending=True).head(5)
                    .to_dicts()
                )
                sample_str = ", ".join(f'"{r[col]}"({r["count"]})' for r in top_vals)
                info += f"  |  top values: {sample_str}"
            except Exception:
                pass
        elif ctype == "datetime":
            try:
                info += f"  |  range: {df[col].min()} → {df[col].max()}"
            except Exception:
                pass

        lines.append(info)

    return "\n".join(lines)


# ── Qwen AI call ───────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """\
You are a data visualization expert for the CleanFlow platform.
Given a dataset schema and a user request, return a JSON array of chart specifications.

Each specification must be a JSON object with these fields:
{
  "chart_type": "bar" | "line" | "area" | "pie" | "scatter" | "funnel" | "map",
  "title": "Human-readable chart title",
  "description": "One-line description",
  "params": {
    // For bar:     {"cat_col": "<column>", "num_col": "<column>"}
    // For line:    {"date_col": "<column>", "num_col": "<column>"}
    // For area:    {"num_col": "<column>"}
    // For pie:     {"cat_col": "<column>"}
    // For scatter: {"x_col": "<column>", "y_col": "<column>"}
    // For funnel:  {"cat_col": "<column>", "num_col": "<column>"} (where cat_col represents stages/steps)
    // For map:     {"loc_col": "<column>", "val_col": "<column>"} (where loc_col is country/city/state/region)
  }
}

Rules:
- Use ONLY column names that exist in the schema.
- For bar/pie/funnel: cat_col must be categorical.
- For bar/line/area/scatter/funnel/map: num_col/x_col/y_col/val_col must be numeric.
- For map: loc_col should be a column with geographic names (country, city, state, etc).
- For line: date_col must be datetime.
- Choose chart types that best answer the user's request.
- Return 6–10 charts for a comprehensive premium dashboard.
- Return ONLY a valid JSON array. No markdown, no explanation, no backticks.
"""


def _call_qwen(schema_text: str, user_prompt: str, hf_api_key: str) -> list[dict]:
    """
    Calls Qwen/Qwen2.5-72B-Instruct with the dataset schema + user prompt.
    Returns a list of parsed chart spec dicts.
    Raises on failure so the caller can fall back.
    """
    from huggingface_hub import InferenceClient

    client = InferenceClient(api_key=hf_api_key)
    user_content = f"Dataset schema:\n{schema_text}\n\nUser request: {user_prompt or 'Generate a comprehensive dashboard with the most insightful charts for this dataset.'}"

    response = client.chat_completion(
        model="Qwen/Qwen2.5-72B-Instruct",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user",   "content": user_content},
        ],
        max_tokens=2000,
        temperature=0.2,
    )

    raw = response.choices[0].message.content.strip()
    logger.info(f"[Visualizer] Qwen raw response length: {len(raw)}")

    # Try to extract JSON array even if the model wraps it in markdown
    json_match = re.search(r"\[.*\]", raw, re.DOTALL)
    if json_match:
        raw = json_match.group(0)

    specs = json.loads(raw)
    if not isinstance(specs, list):
        raise ValueError("Qwen did not return a JSON array")
    return specs


# ── Resolve AI specs → real chart data ─────────────────────────────────────

def _resolve_specs(
    df: pl.DataFrame,
    col_types: dict[str, str],
    specs: list[dict],
) -> list[dict]:
    """
    Takes Qwen's chart specifications and builds real chart config dicts
    (with actual aggregated data) using the existing builder functions.
    """
    charts: list[dict] = []
    color_idx = 0

    for spec in specs:
        chart_type = spec.get("chart_type", "").lower()
        params = spec.get("params", {})
        ai_title = spec.get("title", "")
        ai_desc  = spec.get("description", "")

        chart = None

        try:
            if chart_type == "bar":
                cat_col = params.get("cat_col", "")
                num_col = params.get("num_col", "")
                if cat_col in df.columns and num_col in df.columns:
                    chart = _build_bar_chart(df, cat_col, num_col, color_idx)

            elif chart_type == "pie":
                cat_col = params.get("cat_col", "")
                if cat_col in df.columns:
                    chart = _build_pie_chart(df, cat_col, color_idx)

            elif chart_type == "area":
                num_col = params.get("num_col", "")
                if num_col in df.columns:
                    chart = _build_area_chart(df, num_col, color_idx)

            elif chart_type == "line":
                date_col = params.get("date_col", "")
                num_col  = params.get("num_col", "")
                if date_col in df.columns and num_col in df.columns:
                    chart = _build_line_chart(df, date_col, num_col, color_idx)

            elif chart_type == "scatter":
                x_col = params.get("x_col", "")
                y_col = params.get("y_col", "")
                if x_col in df.columns and y_col in df.columns:
                    chart = _build_scatter_chart(df, x_col, y_col, color_idx)

            elif chart_type == "funnel":
                cat_col = params.get("cat_col", "")
                num_col = params.get("num_col", "")
                if cat_col in df.columns and num_col in df.columns:
                    chart = _build_funnel_chart(df, cat_col, num_col, color_idx)

            elif chart_type == "map":
                loc_col = params.get("loc_col", "")
                val_col = params.get("val_col", "")
                if loc_col in df.columns and val_col in df.columns:
                    chart = _build_map_chart(df, loc_col, val_col, color_idx)

        except Exception as e:
            logger.warning(f"[Visualizer] Failed to build spec {spec}: {e}")

        if chart:
            # Override title/description with what the AI returned if available
            if ai_title:
                chart["title"] = ai_title
            if ai_desc:
                chart["description"] = ai_desc
            charts.append(chart)
            color_idx += 1

    return charts


# ── Public API ─────────────────────────────────────────────────────────────

def analyze_with_ai(
    df: pl.DataFrame,
    user_prompt: str = "",
    hf_api_key: str = "",
) -> dict[str, Any]:
    """
    AI-powered analysis entry point.
    Falls back to rule-based `analyze()` if the HF call fails.
    """
    col_types = _detect_column_types(df)
    schema_text = _build_dataset_schema(df, col_types)
    ai_used = False
    charts: list[dict] = []

    if hf_api_key:
        try:
            logger.info("[Visualizer] Calling Qwen via HF InferenceClient…")
            specs = _call_qwen(schema_text, user_prompt, hf_api_key)
            charts = _resolve_specs(df, col_types, specs)
            ai_used = True
            logger.info(f"[Visualizer] AI generated {len(charts)} charts successfully.")
        except Exception as e:
            logger.warning(f"[Visualizer] AI path failed, falling back to rule-based: {e}")

    if not charts:
        # Fallback: full rule-based analysis
        result = analyze(df)
        result["aiUsed"] = False
        result["schemaText"] = schema_text
        result["prompt"] = user_prompt
        return result

    dashboard_summary = _build_dashboard_summary(df, col_types, charts, ai_used=ai_used, user_prompt=user_prompt)

    return {
        "kpis":             _build_kpis(df, col_types),
        "charts":           charts,
        "columnSummary":    _build_column_summary(df, col_types),
        "totalRows":        len(df),
        "totalColumns":     len(df.columns),
        "aiUsed":           ai_used,
        "prompt":           user_prompt,
        "schemaText":       schema_text,
        "dashboardSummary": dashboard_summary,
    }


def analyze(df: pl.DataFrame) -> dict[str, Any]:
    """
    Rule-based analysis entry point (no external API).
    Kept unchanged for backward compatibility.
    """
    col_types = _detect_column_types(df)
    numeric_cols     = [c for c, t in col_types.items() if t == "numeric"]
    categorical_cols = [c for c, t in col_types.items() if t == "categorical"]
    datetime_cols    = [c for c, t in col_types.items() if t == "datetime"]
    boolean_cols     = [c for c, t in col_types.items() if t == "boolean"]

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

    # 2. Pie (low-cardinality categorical, up to 2)
    for cat in categorical_cols:
        if df[cat].n_unique() <= 8:
            chart = _build_pie_chart(df, cat, color_idx)
            if chart:
                charts.append(chart)
                color_idx += 1
            if color_idx >= 5:
                break

    # 3. Line (datetime × numeric, up to 2)
    for dc in datetime_cols[:2]:
        for num in numeric_cols[:2]:
            chart = _build_line_chart(df, dc, num, color_idx)
            if chart:
                charts.append(chart)
                color_idx += 1

    # 4. Area for numeric (up to 2)
    for num in numeric_cols[:2]:
        chart = _build_area_chart(df, num, color_idx)
        if chart:
            charts.append(chart)
            color_idx += 1

    # 5. Scatter (first two numerics)
    if len(numeric_cols) >= 2:
        chart = _build_scatter_chart(df, numeric_cols[0], numeric_cols[1], color_idx)
        if chart:
            charts.append(chart)
            color_idx += 1

    # 6. Boolean distribution
    for bc in boolean_cols[:2]:
        try:
            counts = df.select(bc).drop_nulls().group_by(bc).count().to_dicts()
            data = [{"name": str(r[bc]), "value": r["count"]} for r in counts]
            charts.append({
                "type": "bar", "title": f"{bc} Distribution",
                "description": f"True/False breakdown of {bc}",
                "xKey": "name", "dataKey": "value",
                "color": CHART_COLORS[color_idx % len(CHART_COLORS)],
                "gradient": GRADIENT_PAIRS[color_idx % len(GRADIENT_PAIRS)],
                "data": data,
            })
            color_idx += 1
        except Exception:
            pass

    return {
        "kpis":             _build_kpis(df, col_types),
        "charts":           charts,
        "columnSummary":    _build_column_summary(df, col_types),
        "totalRows":        len(df),
        "totalColumns":     len(df.columns),
        "aiUsed":           False,
        "dashboardSummary": _build_dashboard_summary(df, col_types, charts, ai_used=False, user_prompt=""),
    }
