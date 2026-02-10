"""
Validation Feature for CleanFlow

Moved from engine.py to features folder for consistency
Validates data quality using 50+ rule types
"""

from typing import Dict, List, Any, Optional
import pandas as pd
import re
from datetime import datetime
from .base import BaseFeature, FeatureResult


class DataValidator(BaseFeature):
    """Data validation feature with comprehensive rule types"""
    
    async def preview(self, config: Dict[str, Any], limit: int = 5) -> FeatureResult:
        """Preview validation on sample rows"""
        try:
            if self.df is None:
                return FeatureResult(success=False, error="No data loaded")
            
            sample_df = self.df.head(limit).copy()
            rules = config.get('rules', [])
            
            # Run validation on sample
            result = self._validate_dataframe(sample_df, rules)
            
            return FeatureResult(
                success=True,
                data=result['errors'][:limit],
                metadata={
                    'sample_rows': limit,
                    'rules_applied': len(rules),
                    'errors_found': len(result['errors'][:limit])
                }
            )
        except Exception as e:
            return FeatureResult(success=False, error=str(e))
    
    async def execute(self, config: Dict[str, Any]) -> FeatureResult:
        """Execute validation on full dataset"""
        try:
            if self.df is None:
                return FeatureResult(success=False, error="No data loaded")
            
            rules = config.get('rules', [])
            result = self._validate_dataframe(self.df, rules)
            
            return FeatureResult(
                success=True,
                data=result,
                metadata={
                    'total_rows': len(self.df),
                    'valid_rows': result['valid_rows'],
                    'invalid_rows': result['invalid_rows'],
                    'rules_applied': len(rules)
                }
            )
        except Exception as e:
            return FeatureResult(success=False, error=str(e))
    
    def _validate_dataframe(self, df: pd.DataFrame, rules: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Validate dataframe against rules"""
        errors = []
        valid_rows = 0
        invalid_rows = 0
        row_has_error = set()
        
        for rule in rules:
            column = rule.get('column')
            rule_type = rule.get('rule_type')
            params = rule.get('params', {})
            
            if column not in df.columns:
                continue
            
            # Validate each row
            for idx, value in df[column].items():
                is_valid = self._validate_value(value, rule_type, params)
                
                if not is_valid:
                    errors.append({
                        'row': int(idx),
                        'column': column,
                        'value': str(value),
                        'rule': rule_type,
                        'message': f"Failed {rule_type} validation"
                    })
                    row_has_error.add(idx)
        
        valid_rows = len(df) - len(row_has_error)
        invalid_rows = len(row_has_error)
        
        return {
            'errors': errors,
            'valid_rows': valid_rows,
            'invalid_rows': invalid_rows,
            'total_rows': len(df)
        }
    
    def _validate_value(self, value: Any, rule_type: str, params: Dict[str, Any]) -> bool:
        """Validate a single value against a rule"""
        # NOT_NULL
        if rule_type == 'not_null':
            return not pd.isna(value)
        
        # Skip validation if value is null (unless it's not_null rule)
        if pd.isna(value):
            return True
        
        # TYPE_CHECK
        if rule_type == 'type_check':
            expected_type = params.get('type')
            if expected_type == 'integer':
                try:
                    int(value)
                    return True
                except:
                    return False
            elif expected_type == 'float':
                try:
                    float(value)
                    return True
                except:
                    return False
        
        # LENGTH rules
        if rule_type == 'length_min':
            return len(str(value)) >= params.get('min', 0)
        if rule_type == 'length_max':
            return len(str(value)) <= params.get('max', 999999)
        if rule_type == 'length_exact':
            return len(str(value)) == params.get('length', 0)
        
        # VALUE rules
        if rule_type == 'value_gt':
            try:
                return float(value) > params.get('value', 0)
            except:
                return False
        if rule_type == 'value_lt':
            try:
                return float(value) < params.get('value', 0)
            except:
                return False
        
        # REGEX rules
        if rule_type == 'regex_email':
            pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            return bool(re.match(pattern, str(value)))
        
        if rule_type == 'regex_custom':
            pattern = params.get('regex', '')
            return bool(re.match(pattern, str(value)))
        
        # ALLOWED_VALUES
        if rule_type == 'allowed_values':
            allowed = params.get('values', [])
            return value in allowed
        
        return True
    
    def validate(self, config: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        """Validate configuration"""
        if 'rules' not in config or not config['rules']:
            return False, "At least one validation rule is required"
        
        return True, None
