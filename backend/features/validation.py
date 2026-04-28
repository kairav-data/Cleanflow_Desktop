import polars as pl
import uuid
import os
from typing import List, Tuple, Dict, Any
from models import ValidationRule, ValidationRuleType, DataType
import re
from runtime_paths import RESULTS_DIR, UPLOAD_DIR

from logger import setup_logger
logger = setup_logger(__name__)

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

class PolarsValidationEngine:
    def __init__(self, session_id: str = None):
        self.session_id = session_id or str(uuid.uuid4())
        self.df: pl.DataFrame = None

    def load_data(self, file_path: str = None, dataframe: Any = None, sep: str = ","):
        logger.debug(f"load_data called. file_path={file_path}, dataframe type={type(dataframe)}")
        if dataframe is not None:
            if isinstance(dataframe, pl.DataFrame):
                self.df = dataframe
            else:
                try:
                    # Attempt to convert from Pandas or other formats
                    self.df = pl.from_pandas(dataframe)
                except:
                    # Fallback or error
                    try:
                        self.df = pl.DataFrame(dataframe)
                    except Exception as e:
                        logger.error(f"Error converting dataframe to Polars: {e}")
                        return []
            cols = self.get_columns()
            logger.debug(f"Loaded dataframe. Columns: {cols}")
            return cols
        elif file_path:
            ext = os.path.splitext(file_path)[1].lower()
            logger.debug(f"Loading file {file_path} with extension {ext}")
            try:
                if ext in ['.csv', '.txt']: 
                    # Try to infer schema, handle potential errors
                    logger.debug(f"Reading CSV with separator='{sep}'")
                    self.df = pl.read_csv(file_path, separator=sep, ignore_errors=True, infer_schema_length=10000, truncate_ragged_lines=True)
                elif ext in ['.xlsx', '.xls']:
                    logger.debug("Reading Excel")
                    self.df = pl.read_excel(file_path)
                else:
                    logger.warning(f"Unsupported file extension: {ext}")
                    return []
            except Exception as e:
                logger.error(f"Error loading file with Polars: {e}")
                return []
            
            cols = self.get_columns()
            logger.debug(f"File loaded. Columns: {cols}")
            return cols
        return []

    def get_columns(self) -> List[str]:
        if self.df is not None:
            return self.df.columns
        return []

    def validate(self, rules: List[ValidationRule]) -> Dict[str, Any]:
        logger.debug(f"validate called with {len(rules)} rules.")
        if self.df is None:
            logger.error("No data loaded in engine.")
            raise ValueError("No data loaded")

        # Start with a lazy frame for potential optimization
        lf = self.df.lazy()
        
        # We need to track errors per row. 
        # Strategy: Create a list of boolean expressions for each rule.
        # However, we also need to aggregate error messages. 
        # Polars is fastest when doing columnar operations.
        
        # Let's add a column for validation errors if it doesn't exist
        # We will build up the error message column expression
        
        # Currently, Polars doesn't have a mutable "cell" concept like pandas for string concatenation in the same way.
        # We will create expressions that return the error string if failed, else None/Empty.
        # Then we can concat them.
        
        error_exprs = []
        column_stats = {}
        
        # Valid mask (starts as True for all)
        valid_condition = pl.lit(True)

        for rule in rules:
            col = rule.column
            if col not in self.df.columns:
                continue
            
            # --- Rule Logic Translation to Polars Expressions ---
            rule_validity_expr = pl.lit(True)

             # --- 1. Type & Format ---
            if rule.rule_type == ValidationRuleType.TYPE_CHECK:
                target_type = rule.params.get("type")
                if target_type == DataType.INTEGER:
                    # Check if castable to Int AND original matched strict numeric regex essentially
                    # Polars STRICT cast raises error, non-strict returns null.
                    # We can use strict=False to get nulls for failures
                    rule_validity_expr = pl.col(col).cast(pl.Int64, strict=False).is_not_null()
                elif target_type in [DataType.FLOAT, DataType.NUMERIC]:
                    rule_validity_expr = pl.col(col).cast(pl.Float64, strict=False).is_not_null()
                elif target_type == DataType.ALPHABETIC:
                    rule_validity_expr = pl.col(col).cast(pl.Utf8).str.contains(r'^[a-zA-Z]+$', strict=False)
                elif target_type == DataType.ALPHANUMERIC:
                    rule_validity_expr = pl.col(col).cast(pl.Utf8).str.contains(r'^[a-zA-Z0-9]+$', strict=False)
                elif target_type == DataType.BOOLEAN:
                     # Polars has boolean parsing, but let's stick to the explicit map to match generic behavior
                     bool_vals = ['true', 'false', '1', '0', 'yes', 'no']
                     rule_validity_expr = pl.col(col).cast(pl.Utf8).str.to_lowercase().is_in(bool_vals)
                elif target_type == DataType.DATE:
                     # Try casting to date
                     rule_validity_expr = pl.col(col).str.to_date(strict=False).is_not_null() # Default format might vary
                     # If strict format needed, use str.to_datetime with format
            
            elif rule.rule_type == ValidationRuleType.DATE_FORMAT:
                fmt = rule.params.get("format", "%Y-%m-%d")
                # Polars uses Rust chrono format, which is mostly compatible with strftime
                rule_validity_expr = pl.col(col).str.to_datetime(format=fmt, strict=False).is_not_null()

            # --- 2. Length & Size ---
            elif rule.rule_type == ValidationRuleType.LENGTH_MIN:
                min_len = int(rule.params.get("min", 0))
                rule_validity_expr = pl.col(col).cast(pl.Utf8).str.len_bytes() >= min_len
            
            elif rule.rule_type == ValidationRuleType.LENGTH_MAX:
                max_len = int(rule.params.get("max", 0))
                rule_validity_expr = pl.col(col).cast(pl.Utf8).str.len_bytes() <= max_len

            elif rule.rule_type == ValidationRuleType.LENGTH_EXACT:
                exact_len = int(rule.params.get("len", 0))
                rule_validity_expr = pl.col(col).cast(pl.Utf8).str.len_bytes() == exact_len

            # --- 3. Value Range ---
            elif rule.rule_type == ValidationRuleType.VALUE_GT:
                val = float(rule.params.get("value", 0))
                rule_validity_expr = pl.col(col).cast(pl.Float64, strict=False) > val

            elif rule.rule_type == ValidationRuleType.VALUE_LT:
                val = float(rule.params.get("value", 0))
                rule_validity_expr = pl.col(col).cast(pl.Float64, strict=False) < val
            
            elif rule.rule_type == ValidationRuleType.VALUE_BETWEEN:
                min_v = float(rule.params.get("min", 0))
                max_v = float(rule.params.get("max", 0))
                c = pl.col(col).cast(pl.Float64, strict=False)
                rule_validity_expr = (c >= min_v) & (c <= max_v)

            elif rule.rule_type == ValidationRuleType.VALUE_POSITIVE:
                 rule_validity_expr = pl.col(col).cast(pl.Float64, strict=False) > 0
            
            elif rule.rule_type == ValidationRuleType.VALUE_NEGATIVE:
                 rule_validity_expr = pl.col(col).cast(pl.Float64, strict=False) < 0

            # --- 4. Null Checks ---
            elif rule.rule_type == ValidationRuleType.NOT_NULL:
                # Polars null vs empty string
                rule_validity_expr = pl.col(col).is_not_null() & (pl.col(col).cast(pl.Utf8).str.strip_chars() != "")

            # --- 5. Pattern & Regex ---
            elif rule.rule_type == ValidationRuleType.REGEX_CUSTOM:
                pattern = rule.params.get("regex", ".*")
                rule_validity_expr = pl.col(col).cast(pl.Utf8).str.contains(pattern, strict=False)
            
            elif rule.rule_type == ValidationRuleType.REGEX_EMAIL:
                email_regex = r'^[\w\.-]+@[\w\.-]+\.\w+$'
                rule_validity_expr = pl.col(col).cast(pl.Utf8).str.contains(email_regex, strict=False)

            elif rule.rule_type == ValidationRuleType.STARTS_WITH:
                prefix = rule.params.get("prefix", "")
                rule_validity_expr = pl.col(col).cast(pl.Utf8).str.starts_with(prefix)
            
            elif rule.rule_type == ValidationRuleType.ENDS_WITH:
                suffix = rule.params.get("suffix", "")
                rule_validity_expr = pl.col(col).cast(pl.Utf8).str.ends_with(suffix)

            # --- 6. Domain ---
            elif rule.rule_type == ValidationRuleType.ALLOWED_VALUES:
                allowed = [str(x) for x in rule.params.get("values", [])]
                rule_validity_expr = pl.col(col).cast(pl.Utf8).is_in(allowed)

            elif rule.rule_type == ValidationRuleType.DISALLOWED_VALUES:
                disallowed = [str(x) for x in rule.params.get("values", [])]
                rule_validity_expr = ~pl.col(col).cast(pl.Utf8).is_in(disallowed)

            # --- 7. Custom Rules (Simple comparison) ---
            elif rule.rule_type == ValidationRuleType.COLUMN_COMPARE:
                operator = rule.params.get("operator", "==")
                compare_col = rule.params.get("compare_column", "")
                if compare_col and compare_col in self.df.columns:
                    c1 = pl.col(col).cast(pl.Float64, strict=False)
                    c2 = pl.col(compare_col).cast(pl.Float64, strict=False)
                    if operator == "==": rule_validity_expr = c1 == c2
                    elif operator == "!=": rule_validity_expr = c1 != c2
                    elif operator == ">": rule_validity_expr = c1 > c2
                    elif operator == "<": rule_validity_expr = c1 < c2
                    elif operator == ">=": rule_validity_expr = c1 >= c2
                    elif operator == "<=": rule_validity_expr = c1 <= c2
            
            # For complex Python evals (CUSTOM_EXPRESSION), Polars usually requires map_elements (UDF)
            # which is slower but supported.
            elif rule.rule_type == ValidationRuleType.CUSTOM_EXPRESSION:
                expression = rule.params.get("expression", "True")
                def eval_expr(val):
                     try:
                        safe_context = {"value": val, "len": len, "str": str, "int": int, "float": float}
                        return bool(eval(expression, {"__builtins__": {}}, safe_context))
                     except:
                        return False
                
                # pl.col().map_elements(param) -> python UDF
                rule_validity_expr = pl.col(col).map_elements(eval_expr, return_dtype=pl.Boolean)


            # --- Aggregate Logic ---
            
            # Update global valid mask
            valid_condition = valid_condition & rule_validity_expr.fill_null(False)
            
            # Create error message expression for this rule
            # If valid -> null/empty-string, If invalid -> error message
            error_msg = f"[{col}: Failed {rule.rule_type.value}] "
            
            # when(valid).then(lit("")).otherwise(lit(msg))
            rule_error_msg = pl.when(rule_validity_expr.fill_null(False)).then(pl.lit("")).otherwise(pl.lit(error_msg))
            error_exprs.append(rule_error_msg)
            
            # Add to stats (we need to compute this eagerly or partly lazy)
            # To get stats per column without breaking lazy chain too much, we can do a count on the inverted mask
            # But specific stats might be easier to calc after collection or using aggregation
            
            # Let's defer exact count stats until the end for max performance, 
            # OR we can just register the stat tracking requirement.
            
            column_stats[col] = column_stats.get(col, {"passed": True, "errors": []})
            # We'll need to count these later
            column_stats[col]["errors"].append({
                "rule": str(rule.rule_type),
                "msg": rule.rule_type.value, # simplified for now
                "expr": rule_validity_expr
            })

        # --- Execute ---
        
        # Concat all error messages
        if error_exprs:
            # multiple string concats: (e1 + e2 + e3...)
            combined_errors = error_exprs[0]
            for i in range(1, len(error_exprs)):
                combined_errors = combined_errors + error_exprs[i]
        else:
            combined_errors = pl.lit("")
            
        lf = lf.with_columns(
            combined_errors.alias("__validation_errors__"),
            valid_condition.alias("__is_valid__")
        )
        
        # Collect results
        final_df = lf.collect()
        
        valid_df = final_df.filter(pl.col("data_is_valid" if "__is_valid__" not in final_df.columns else "__is_valid__"))
        error_df = final_df.filter(~pl.col("__is_valid__"))
        
        # Recalculate stats counts on the materialized DF (fast enough)
        for col, data in column_stats.items():
            failed_count_total = 0
            for err_obj in data["errors"]:
                # err_obj['expr'] is the valid condition. Count False entries
                # We can't easily re-evaluate the expression on the final DF without re-doing it or saving intermediate cols.
                # Optimization strategy: For stats, just check total invalidity or rely on the final aggregation?
                # The user expects per-rule failure counts? The original pandas one did that.
                
                # To get per-rule counts efficiently:
                # We can do one big aggregation query.
                pass

        # To match original stats format perfectly is expensive (iterative). 
        # Let's simplify: return total valid/invalid and maybe column-level validity if strictly needed.
        # For this migration, preserving the exact "count per rule" might be heavy if we want pure vectorization.
        # Let's do a quick approximation or just skip granular per-rule counts for the prototype, 
        # or implement a separate agg step.
        
        # Let's compute counts for stats
        # We can run a selection of aggregations
        agg_exprs = []
        for col, data in column_stats.items():
            for i, err_obj in enumerate(data["errors"]):
                # Count how many failed
                # ~expr
                agg_exprs.append((~err_obj["expr"].fill_null(False)).sum().alias(f"stat_{col}_{i}"))
        
        if agg_exprs:
            stats_row = self.df.lazy().select(agg_exprs).collect().row(0)
            
            # Map back — always write failed_count (0 or more) and always delete the expr object
            idx = 0
            for col, data in column_stats.items():
                for i, err_obj in enumerate(data["errors"]):
                    fail_c = int(stats_row[idx]) if stats_row[idx] is not None else 0
                    idx += 1
                    err_obj["failed_count"] = fail_c   # always set, even if 0
                    if "expr" in err_obj:
                        del err_obj["expr"]             # always clean up Polars expression
                    if fail_c > 0:
                        data["passed"] = False          # mark column as failed

        # Clean up any remaining expressions in column_stats just in case
        for col, data in column_stats.items():
            for err_obj in data["errors"]:
                if "expr" in err_obj:
                    del err_obj["expr"]

        
        # Save output
        valid_path = os.path.join(RESULTS_DIR, f"{self.session_id}_valid.csv")
        error_path = os.path.join(RESULTS_DIR, f"{self.session_id}_error.csv")
        
        # Drop temp columns before save
        valid_df.drop(["__validation_errors__", "__is_valid__"]).write_csv(valid_path)
        error_df.write_csv(error_path) # keep errors for debugging? Or matches Pandas logic which kept error col I think?
        # distinct "error" column is usually kept in error output in these flows.
        
        return {
            "session_id": self.session_id,
            "total_rows": len(final_df),
            "valid_rows": len(valid_df),
            "invalid_rows": len(error_df),
            "valid_file": valid_path,
            "error_file": error_path,
            "column_stats": column_stats
        }
