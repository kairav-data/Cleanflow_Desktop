# Feasibility Analysis: Porting CleanFlow Backend to DuckDB or Polars

This document outlines the feasibility and impact of migrating the CleanFlow backend data processing code from Pandas to DuckDB or Polars.

## Recommendation
**Yes, it is definitely possible.** While both DuckDB and Polars offer significant performance benefits, **Polars** is likely the cleaner migration path for this specific Python codebase due to its DataFrame API similarities and tight integration with the Python ecosystem (scikit-learn, rapidfuzz). DuckDB is excellent for heavy analytical SQL-style queries but requires more significant refactoring of procedural logic.

## Impact Areas

### 1. Data Validation (`backend/engine.py`)
Currently relies heavily on vectorized Pandas operations (`pd.to_numeric`, `str.match`, `isin`).
- **Polars**: Directly maps to Polars expressions (e.g., `pl.col().str.contains()`). Faster execution and similar logic structure.
- **DuckDB**: Logic would need to be rewritten as SQL queries or use the Relational API. Complex validation rules (custom Python logic) might require User Defined Functions (UDFs), which can have overhead.

### 2. Data Matching (`backend/features/matching.py`)
Currently uses hybrid approaches:
- **Fuzzy Matching**: Uses `rapidfuzz` on Pandas Series. This iterates over rows.
    - *Migration*: Both DuckDB and Polars would require extracting data to standard Python lists or Arrow arrays to feed into `rapidfuzz`. Polars integrates well with Arrow, making this efficient.
- **Exact Matching**: Uses `pd.merge`.
    - *Migration*: Trivial in both. DuckDB JOINs are extremely fast. Polars joins are also very performant.
- **Cosine/Jaccard**: Uses `scikit-learn` (expects numpy/sparse matrices).
    - *Migration*: Both libraries can zero-copy export to Numpy/Arrow, so this logic remains largely the same, just the input preparation changes.

### 3. Data Loading (`backend/main.py`, `backend/features/scraper.py`)
- **DuckDB**: Excellent CSV/Excel reader (often faster than Pandas). Can query files directly without loading everything into memory.
- **Polars**: Very fast CSV/Excel readers with lazy evaluation capabilities.

## Comparison

| Feature | Pandas (Current) | Polars | DuckDB |
| :--- | :--- | :--- | :--- |
| **Paradigm** | Eager DataFrame | Lazy/Eager DataFrame | SQL / Relational |
| **Performance** | Good (Single Core) | Excellent (Multi-threaded) | Excellent (Vectorized Engine) |
| **Memory Usage** | High (Objects) | Low (Rust/Arrow) | Low (Out-of-core support) |
| **Syntax Change** | N/A | Moderate (Expression API) | High (SQL-centric) |
| **Ecosystem** | Universal | Growing, good Python interop | Standard SQL, good Python integration |

## Estimated Effort
**Medium**.
- Core logic in `engine.py` needs a rewrite to use Polars Expressions or DuckDB SQL generation.
- `matching.py` needs data conversion updates.
- API endpoints (`main.py`) need to handle the new data objects.

## Next Steps (If proceeding)
1. **Prototype**: Convert `engine.py` validation logic to Polars to benchmark performance.
2. **Refactor**: Abstract the "DataFrame" operations behind an interface to allow swapping engines easily.
