import pandas as pd
import uuid
import os
import re
from typing import List, Tuple, Dict
from models import ValidationRule, ValidationRuleType, DataType

UPLOAD_DIR = "uploads"
RESULTS_DIR = "results"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

class ValidationEngine:
    def __init__(self, session_id: str = None):
        self.session_id = session_id or str(uuid.uuid4())
        self.df = None

    def load_data(self, file_path: str = None, dataframe: pd.DataFrame = None, sep: str = ","):
            if dataframe is not None:
                self.df = dataframe
                return self.get_columns()
            elif file_path:
                ext = os.path.splitext(file_path)[1].lower()
                if ext in ['.csv', '.txt']: # Added .txt support
                    # Use the 'sep' parameter here
                    self.df = pd.read_csv(file_path, sep=sep) 
                elif ext in ['.xlsx', '.xls']:
                    self.df = pd.read_excel(file_path)
                
                return self.get_columns()
            return []

    def get_columns(self) -> List[str]:
        if self.df is not None:
            return list(self.df.columns)
        return []

    def validate(self, rules: List[ValidationRule]) -> Dict[str, str]:
        if self.df is None:
            raise ValueError("No data loaded")

        valid_mask = pd.Series([True] * len(self.df))
        column_stats = {}  # Track per-column validation results
        
        # We will add an 'errors' column to track why a row failed
        self.df['__validation_errors__'] = ""

        for rule in rules:
            col = rule.column
            if col not in self.df.columns:
                continue
            
            # Default to all valid initially for this rule
            current_validity = pd.Series([True] * len(self.df))
            
            # --- 1. Type & Format ---
            if rule.rule_type == ValidationRuleType.TYPE_CHECK:
                target_type = rule.params.get("type")
                if target_type == DataType.INTEGER:
                    # Check if numeric and integer (no decimal)
                    numeric = pd.to_numeric(self.df[col], errors='coerce')
                    current_validity = numeric.notna() & (numeric % 1 == 0)
                elif target_type == DataType.FLOAT or target_type == DataType.NUMERIC:
                    current_validity = pd.to_numeric(self.df[col], errors='coerce').notna()
                elif target_type == DataType.ALPHABETIC:
                    current_validity = self.df[col].astype(str).str.match(r'^[a-zA-Z]+$', na=False)
                elif target_type == DataType.ALPHANUMERIC:
                    current_validity = self.df[col].astype(str).str.match(r'^[a-zA-Z0-9]+$', na=False)
                elif target_type == DataType.BOOLEAN:
                     # Check for common bool representations
                     bool_map = {'true': True, 'false': False, '1': True, '0': False, 'yes': True, 'no': False}
                     lower_col = self.df[col].astype(str).str.lower()
                     current_validity = lower_col.isin(bool_map.keys())
                elif target_type == DataType.DATE:
                     current_validity = pd.to_datetime(self.df[col], errors='coerce').notna()

            elif rule.rule_type == ValidationRuleType.DATE_FORMAT:
                fmt = rule.params.get("format", "%Y-%m-%d")
                current_validity = pd.to_datetime(self.df[col], format=fmt, errors='coerce').notna()

            # --- 2. Length & Size ---
            elif rule.rule_type == ValidationRuleType.LENGTH_MIN:
                min_len = int(rule.params.get("min", 0))
                current_validity = self.df[col].astype(str).str.len() >= min_len
            
            elif rule.rule_type == ValidationRuleType.LENGTH_MAX:
                max_len = int(rule.params.get("max", 0))
                current_validity = self.df[col].astype(str).str.len() <= max_len

            elif rule.rule_type == ValidationRuleType.LENGTH_EXACT:
                exact_len = int(rule.params.get("len", 0))
                current_validity = self.df[col].astype(str).str.len() == exact_len

            # --- 3. Value Range ---
            elif rule.rule_type == ValidationRuleType.VALUE_GT:
                val = float(rule.params.get("value", 0))
                numeric = pd.to_numeric(self.df[col], errors='coerce')
                current_validity = numeric.notna() & (numeric > val)

            elif rule.rule_type == ValidationRuleType.VALUE_LT:
                val = float(rule.params.get("value", 0))
                numeric = pd.to_numeric(self.df[col], errors='coerce')
                current_validity = numeric.notna() & (numeric < val)
            
            elif rule.rule_type == ValidationRuleType.VALUE_BETWEEN:
                min_v = float(rule.params.get("min", 0))
                max_v = float(rule.params.get("max", 0))
                numeric = pd.to_numeric(self.df[col], errors='coerce')
                current_validity = numeric.notna() & (numeric >= min_v) & (numeric <= max_v)
            
            elif rule.rule_type == ValidationRuleType.VALUE_POSITIVE:
                 numeric = pd.to_numeric(self.df[col], errors='coerce')
                 current_validity = numeric.notna() & (numeric > 0)
            
            elif rule.rule_type == ValidationRuleType.VALUE_NEGATIVE:
                 numeric = pd.to_numeric(self.df[col], errors='coerce')
                 current_validity = numeric.notna() & (numeric < 0)

            # --- 4. Null Checks ---
            elif rule.rule_type == ValidationRuleType.NOT_NULL:
                current_validity = self.df[col].notna() & (self.df[col].astype(str).str.strip() != "")

            # --- 5. Pattern & Regex ---
            elif rule.rule_type == ValidationRuleType.REGEX_CUSTOM:
                pattern = rule.params.get("regex", ".*")
                current_validity = self.df[col].astype(str).str.match(pattern, na=False)
            
            elif rule.rule_type == ValidationRuleType.REGEX_EMAIL:
                email_regex = r'^[\w\.-]+@[\w\.-]+\.\w+$'
                current_validity = self.df[col].astype(str).str.match(email_regex, na=False)

            elif rule.rule_type == ValidationRuleType.STARTS_WITH:
                prefix = rule.params.get("prefix", "")
                current_validity = self.df[col].astype(str).str.startswith(prefix)
            
            elif rule.rule_type == ValidationRuleType.ENDS_WITH:
                suffix = rule.params.get("suffix", "")
                current_validity = self.df[col].astype(str).str.endswith(suffix)

            # --- 6. Domain ---
            elif rule.rule_type == ValidationRuleType.ALLOWED_VALUES:
                allowed = rule.params.get("values", [])
                # Convert both to string for robust comparison, or handle types?
                # Let's assume string comparison for simplicity in this MVP upgrade
                current_validity = self.df[col].astype(str).isin([str(x) for x in allowed])

            elif rule.rule_type == ValidationRuleType.DISALLOWED_VALUES:
                disallowed = rule.params.get("values", [])
                current_validity = ~self.df[col].astype(str).isin([str(x) for x in disallowed])

            # --- 7. Custom Rules ---
            elif rule.rule_type == ValidationRuleType.CUSTOM_EXPRESSION:
                expression = rule.params.get("expression", "True")
                # Safely evaluate the expression for each row
                def eval_expr(value):
                    try:
                        # Create a safe context with the value and basic functions
                        safe_context = {"value": value, "len": len, "str": str, "int": int, "float": float}
                        return eval(expression, {"__builtins__": {}}, safe_context)
                    except:
                        return False
                current_validity = self.df[col].apply(eval_expr)
            
            elif rule.rule_type == ValidationRuleType.COLUMN_COMPARE:
                operator = rule.params.get("operator", "==")
                compare_col = rule.params.get("compare_column", "")
                if compare_col and compare_col in self.df.columns:
                    col_a = pd.to_numeric(self.df[col], errors='coerce')
                    col_b = pd.to_numeric(self.df[compare_col], errors='coerce')
                    if operator == "==":
                        current_validity = col_a == col_b
                    elif operator == "!=":
                        current_validity = col_a != col_b
                    elif operator == ">":
                        current_validity = col_a > col_b
                    elif operator == "<":
                        current_validity = col_a < col_b
                    elif operator == ">=":
                        current_validity = col_a >= col_b
                    elif operator == "<=":
                        current_validity = col_a <= col_b
                    else:
                        current_validity = pd.Series([True] * len(self.df))
                else:
                    current_validity = pd.Series([True] * len(self.df))
            
            elif rule.rule_type == ValidationRuleType.CONDITIONAL_RULE:
                condition_col = rule.params.get("condition_column", "")
                condition_val = rule.params.get("condition_value", "")
                expected_val = rule.params.get("expected_value", "")
                
                if condition_col and condition_col in self.df.columns:
                    # Only validate rows where condition is met
                    condition_mask = self.df[condition_col].astype(str) == str(condition_val)
                    # For rows where condition is met, check if value matches expected
                    matches_expected = self.df[col].astype(str).str.contains(expected_val, regex=True, na=False)
                    # Valid if: condition not met OR (condition met AND matches expected)
                    current_validity = ~condition_mask | (condition_mask & matches_expected)
                else:
                    current_validity = pd.Series([True] * len(self.df))

            # Update master mask
            row_errors = ~current_validity
            # For rows that failed this rule, append error message
            # Handle NaN issues in masking
            row_errors = row_errors.fillna(False)
            
            # Track per-column stats
            fail_count = row_errors.sum()
            if col not in column_stats:
                column_stats[col] = {"passed": True, "errors": []}
            
            if fail_count > 0:
                column_stats[col]["passed"] = False
                column_stats[col]["errors"].append({
                    "rule": str(rule.rule_type.value),
                    "failed_count": int(fail_count),
                    "description": f"{fail_count} rows failed {rule.rule_type.value} check"
                })
                error_msg = f"[{col}: Failed {rule.rule_type}] "
                self.df.loc[row_errors, '__validation_errors__'] += error_msg
            
            valid_mask = valid_mask & current_validity

        # Split Data
        # Ensure mask aligns
        valid_mask = valid_mask.fillna(False)
        
        valid_df = self.df[valid_mask].drop(columns=['__validation_errors__'])
        error_df = self.df[~valid_mask]

        # Save results
        valid_path = os.path.join(RESULTS_DIR, f"{self.session_id}_valid.csv")
        error_path = os.path.join(RESULTS_DIR, f"{self.session_id}_error.csv")
        
        valid_df.to_csv(valid_path, index=False)
        error_df.to_csv(error_path, index=False)

        return {
            "session_id": self.session_id,
            "total_rows": len(self.df),
            "valid_rows": len(valid_df),
            "invalid_rows": len(error_df),
            "valid_file": valid_path,
            "error_file": error_path,
            "column_stats": column_stats
        }
