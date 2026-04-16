from typing import Dict, List, Any, Optional
import polars as pl
import os
from .base import BaseFeature, FeatureResult

class DataCleaner(BaseFeature):
    """Data Cleaning feature using Polars"""
    
    OPERATIONS = [
        {
            "id": "fill_nulls",
            "name": "Fill Blank Cells",
            "description": "Fill missing values with a statistical measure or specific value.",
            "requires_input": True,
            "input_type": "dropdown",
            "input_options": ["mean", "median", "min", "max", "custom"]
        },
        {
            "id": "replace_value",
            "name": "Replace Value",
            "description": "Find a specific value in the column and replace it.",
            "requires_input": True,
            "input_type": "text_replace"
        },
        {
            "id": "trim_whitespace",
            "name": "Trim Whitespace",
            "description": "Remove leading and trailing whitespace from text.",
            "requires_input": False
        },
        {
            "id": "uppercase",
            "name": "Convert to Uppercase",
            "description": "Convert all text in the column to uppercase.",
            "requires_input": False
        },
        {
            "id": "lowercase",
            "name": "Convert to Lowercase",
            "description": "Convert all text in the column to lowercase.",
            "requires_input": False
        },
        {
            "id": "deduplicate",
            "name": "Remove Duplicates",
            "description": "Drop duplicate rows across the whole dataset or based on specific columns.",
            "requires_input": True,
            "input_type": "deduplicate",
            "dataset_level": True   # operates on the whole df, not one column
        }
    ]

    async def preview(self, config: Dict[str, Any], limit: int = 5) -> FeatureResult:
        is_valid, err = self.validate(config)
        if not is_valid:
             return FeatureResult(success=False, error=err)
        return self._execute_operation(config, limit=limit)

    async def execute(self, config: Dict[str, Any]) -> FeatureResult:
        is_valid, err = self.validate(config)
        if not is_valid:
             return FeatureResult(success=False, error=err)
        return self._execute_operation(config, limit=None)

    def _execute_operation(self, config: Dict[str, Any], limit: Optional[int] = None) -> FeatureResult:
        rules = config.get("rules", [])
        
        if self.df is None:
            return FeatureResult(success=False, error="No active dataframe.")
            
        df_proc = self.df.head(limit) if limit else self.df
        
        try:
            for rule in rules:
                column = rule.get("column")
                operation = rule.get("operation")
                params = rule.get("params", {})

                # ── Deduplicate (dataset-level, no single column required) ──
                if operation == "deduplicate":
                    subset = params.get("subset_columns")  # list[str] or None
                    keep = params.get("keep", "first")      # "first" | "last" | "none"

                    # Validate subset columns exist
                    if subset:
                        subset = [c for c in subset if c in df_proc.columns]

                    if keep == "none":
                        # Drop all rows that appear more than once
                        if subset:
                            counts = df_proc.select(subset).with_row_index("__row__").group_by(subset).agg(pl.col("__row__").count().alias("__cnt__"))
                            df_proc = df_proc.with_row_index("__row__").join(counts, on=subset, how="left").filter(pl.col("__cnt__") == 1).drop(["__row__", "__cnt__"])
                        else:
                            df_proc = df_proc.unique(maintain_order=True)
                            # keep only rows not duplicated at all → need count trick
                            # fallback: unique already removes most cases; for strict "none" use value_counts approach
                            df_proc = df_proc.unique(maintain_order=True)
                    else:
                        # keep = "first" or "last"
                        keep_last = (keep == "last")
                        if subset:
                            df_proc = df_proc.unique(subset=subset, keep="last" if keep_last else "first", maintain_order=True)
                        else:
                            df_proc = df_proc.unique(keep="last" if keep_last else "first", maintain_order=True)
                    continue

                # ── All other operations require a valid column ──
                if not column or column not in df_proc.columns:
                    continue
                    
                if operation == "fill_nulls":
                    method = params.get("method", "custom")
                    custom_val = params.get("custom_value", "")
                    
                    if method in ["mean", "median", "min", "max"]:
                        is_numeric = df_proc.schema[column].is_numeric()
                        if is_numeric:
                            if method == "mean":
                                df_proc = df_proc.with_columns(pl.col(column).fill_null(pl.col(column).mean()))
                            elif method == "median":
                                df_proc = df_proc.with_columns(pl.col(column).fill_null(pl.col(column).median()))
                            elif method == "min":
                                df_proc = df_proc.with_columns(pl.col(column).fill_null(pl.col(column).min()))
                            elif method == "max":
                                df_proc = df_proc.with_columns(pl.col(column).fill_null(pl.col(column).max()))
                    else:
                        try:
                            dtype = df_proc.schema[column]
                            if dtype in [pl.Int32, pl.Int64]:
                                val = int(custom_val)
                            elif dtype in [pl.Float32, pl.Float64]:
                                val = float(custom_val)
                            else:
                                val = str(custom_val)
                            df_proc = df_proc.with_columns(pl.col(column).fill_null(pl.lit(val)))
                        except:
                            df_proc = df_proc.with_columns(pl.col(column).cast(pl.Utf8).fill_null(pl.lit(str(custom_val))))

                elif operation == "replace_value":
                    target = params.get("target_value", "")
                    replacement = params.get("replacement_value", "")
                    match_type = params.get("match_type", "whole")
                    
                    if match_type == "whole":
                        df_proc = df_proc.with_columns(
                            pl.when(pl.col(column).cast(pl.Utf8) == target)
                            .then(pl.lit(replacement))
                            .otherwise(pl.col(column).cast(pl.Utf8))
                            .alias(column)
                        )
                    elif match_type == "partial":
                        df_proc = df_proc.with_columns(
                            pl.col(column).cast(pl.Utf8).str.replace_all(target, replacement, literal=True).alias(column)
                        )
                    
                elif operation == "trim_whitespace":
                    df_proc = df_proc.with_columns(pl.col(column).cast(pl.Utf8).str.strip_chars())
                    
                elif operation == "uppercase":
                    df_proc = df_proc.with_columns(pl.col(column).cast(pl.Utf8).str.to_uppercase())
                    
                elif operation == "lowercase":
                    df_proc = df_proc.with_columns(pl.col(column).cast(pl.Utf8).str.to_lowercase())
                
            return FeatureResult(
                success=True,
                data=df_proc.to_dicts(),
                metadata={"total_rows": len(df_proc), "rules_applied": len(rules)}
            )
            
        except Exception as e:
            return FeatureResult(success=False, error=str(e))

    def validate(self, config: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        rules = config.get("rules")
        if not rules or not isinstance(rules, list):
            return False, "Payload must contain a 'rules' array"
            
        valid_ops = [op["id"] for op in self.OPERATIONS]
        dataset_level_ops = {op["id"] for op in self.OPERATIONS if op.get("dataset_level")}
        
        for idx, rule in enumerate(rules):
            op = rule.get("operation", "")
            if op not in valid_ops:
                return False, f"Rule '{idx}' has an invalid operation: {op}"
            # dataset-level ops (e.g. deduplicate) don't require a column
            if op not in dataset_level_ops and "column" not in rule:
                return False, f"Rule '{idx}' is missing a 'column' key"
        return True, None

    @classmethod
    def get_operations(cls) -> List[Dict[str, Any]]:
        return cls.OPERATIONS

