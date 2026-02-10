"""
Enhanced Schema Mapping Feature for CleanFlow

Advanced transformations including:
- Column concatenation
- Aggregation (sum, avg, count, min, max)
- Header generation
- Custom formulas
- All previous transformations
"""

from typing import Dict, List, Any, Optional, Tuple
import pandas as pd
import re
from difflib import SequenceMatcher
from .base import BaseFeature, FeatureResult


class ColumnMatcher:
    """Intelligent column name matching"""
    
    @staticmethod
    def fuzzy_match(source: str, target: str) -> float:
        """Calculate similarity score between two column names"""
        s1 = source.lower().replace('_', '').replace(' ', '')
        s2 = target.lower().replace('_', '').replace(' ', '')
        return SequenceMatcher(None, s1, s2).ratio()
    
    @staticmethod
    def suggest_mappings(source_columns: List[str], target_columns: List[str], threshold: float = 0.6) -> Dict[str, str]:
        """Suggest column mappings based on similarity"""
        mappings = {}
        
        for source_col in source_columns:
            best_match = None
            best_score = threshold
            
            for target_col in target_columns:
                score = ColumnMatcher.fuzzy_match(source_col, target_col)
                if score > best_score:
                    best_score = score
                    best_match = target_col
            
            if best_match:
                mappings[source_col] = best_match
        
        return mappings


class AdvancedTransformation:
    """Advanced data transformation functions"""
    
    @staticmethod
    def uppercase(value: Any) -> Any:
        if pd.isna(value): return value
        return str(value).upper()
    
    @staticmethod
    def lowercase(value: Any) -> Any:
        if pd.isna(value): return value
        return str(value).lower()
    
    @staticmethod
    def trim(value: Any) -> Any:
        if pd.isna(value): return value
        return str(value).strip()
    
    @staticmethod
    def title_case(value: Any) -> Any:
        if pd.isna(value): return value
        return str(value).title()
    
    @staticmethod
    def remove_special_chars(value: Any) -> Any:
        if pd.isna(value): return value
        return re.sub(r'[^a-zA-Z0-9\s]', '', str(value))
    
    @staticmethod
    def extract_numbers(value: Any) -> Any:
        if pd.isna(value): return value
        numbers = re.findall(r'\d+', str(value))
        return ''.join(numbers) if numbers else None
    
    @staticmethod
    def pad_zeros(value: Any, length: int = 5) -> Any:
        if pd.isna(value): return value
        return str(value).zfill(length)
    
    @staticmethod
    def concatenate(row: pd.Series, columns: List[str], separator: str = ' ') -> str:
        """Concatenate multiple columns"""
        values = [str(row[col]) if not pd.isna(row[col]) else '' for col in columns if col in row.index]
        return separator.join(values)
    
    @staticmethod
    def aggregate_sum(series: pd.Series) -> float:
        """Sum aggregation"""
        return series.sum()
    
    @staticmethod
    def aggregate_avg(series: pd.Series) -> float:
        """Average aggregation"""
        return series.mean()
    
    @staticmethod
    def aggregate_count(series: pd.Series) -> int:
        """Count aggregation"""
        return series.count()
    
    @staticmethod
    def aggregate_min(series: pd.Series) -> Any:
        """Min aggregation"""
        return series.min()
    
    @staticmethod
    def aggregate_max(series: pd.Series) -> Any:
        """Max aggregation"""
        return series.max()
    
    TRANSFORMATIONS = {
        'uppercase': uppercase.__func__,
        'lowercase': lowercase.__func__,
        'trim': trim.__func__,
        'title_case': title_case.__func__,
        'remove_special_chars': remove_special_chars.__func__,
        'extract_numbers': extract_numbers.__func__,
        'pad_zeros': pad_zeros.__func__
    }
    
    AGGREGATIONS = {
        'sum': aggregate_sum.__func__,
        'avg': aggregate_avg.__func__,
        'count': aggregate_count.__func__,
        'min': aggregate_min.__func__,
        'max': aggregate_max.__func__
    }


class SchemaMapper(BaseFeature):
    """Enhanced schema mapping feature with advanced transformations"""
    
    async def preview(self, config: Dict[str, Any], limit: int = 5) -> FeatureResult:
        """Preview schema mapping on sample rows"""
        try:
            is_valid, error = self.validate(config)
            if not is_valid:
                return FeatureResult(success=False, error=error)
            
            if self.df is None:
                return FeatureResult(success=False, error="No data loaded")
            
            sample_df = self.df.head(limit).copy()
            result_df = self._apply_mappings(sample_df, config)
            
            return FeatureResult(
                success=True,
                data=result_df.to_dict('records'),
                metadata={
                    'rows': len(result_df),
                    'columns': list(result_df.columns)
                }
            )
        except Exception as e:
            return FeatureResult(success=False, error=str(e))
    
    async def execute(self, config: Dict[str, Any]) -> FeatureResult:
        """Execute schema mapping on full dataset"""
        try:
            is_valid, error = self.validate(config)
            if not is_valid:
                return FeatureResult(success=False, error=error)
            
            if self.df is None:
                return FeatureResult(success=False, error="No data loaded")
            
            result_df = self._apply_mappings(self.df.copy(), config)
            
            return FeatureResult(
                success=True,
                data=result_df.to_dict('records'),
                metadata={
                    'total_rows': len(result_df),
                    'columns': list(result_df.columns)
                }
            )
        except Exception as e:
            return FeatureResult(success=False, error=str(e))
    
    def _apply_mappings(self, df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
        """Apply all mappings and transformations"""
        result_df = pd.DataFrame()
        
        mappings = config.get('mappings', {})
        transformations = config.get('transformations', {})
        concatenations = config.get('concatenations', {})
        aggregations = config.get('aggregations', {})
        
        # Apply simple mappings
        for source_col, target_col in mappings.items():
            if source_col not in df.columns:
                continue
            
            result_df[target_col] = df[source_col].copy()
            
            # Apply transformations
            if target_col in transformations:
                for transform_name in transformations[target_col]:
                    if transform_name in AdvancedTransformation.TRANSFORMATIONS:
                        transform_func = AdvancedTransformation.TRANSFORMATIONS[transform_name]
                        result_df[target_col] = result_df[target_col].apply(transform_func)
        
        # Apply concatenations
        for new_col, concat_config in concatenations.items():
            columns = concat_config.get('columns', [])
            separator = concat_config.get('separator', ' ')
            result_df[new_col] = df.apply(
                lambda row: AdvancedTransformation.concatenate(row, columns, separator), 
                axis=1
            )
        
        # Apply aggregations
        for new_col, agg_config in aggregations.items():
            column = agg_config.get('column')
            agg_type = agg_config.get('type')
            
            if column in df.columns and agg_type in AdvancedTransformation.AGGREGATIONS:
                agg_func = AdvancedTransformation.AGGREGATIONS[agg_type]
                agg_value = agg_func(df[column])
                result_df[new_col] = agg_value
        
        return result_df
    
    def validate(self, config: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        """Validate mapping configuration"""
        if not config.get('mappings') and not config.get('concatenations') and not config.get('aggregations'):
            return False, "At least one mapping, concatenation, or aggregation is required"
        
        return True, None
    
    def suggest_mappings(self, target_schema: Dict[str, Any]) -> Dict[str, Any]:
        """Suggest intelligent column mappings"""
        if self.df is None:
            return {}
        
        source_columns = list(self.df.columns)
        target_columns = list(target_schema.keys())
        
        suggested = ColumnMatcher.suggest_mappings(source_columns, target_columns)
        
        return {
            'suggested_mappings': suggested,
            'unmapped_source': [col for col in source_columns if col not in suggested],
            'unmapped_target': [col for col in target_columns if col not in suggested.values()],
            'confidence_scores': {
                source: ColumnMatcher.fuzzy_match(source, target)
                for source, target in suggested.items()
            }
        }
    
    @classmethod
    def get_available_transformations(cls) -> List[Dict[str, Any]]:
        """Get list of available transformations"""
        return [
            {"id": "uppercase", "name": "Uppercase", "description": "Convert text to UPPERCASE", "example": "hello → HELLO"},
            {"id": "lowercase", "name": "Lowercase", "description": "Convert text to lowercase", "example": "HELLO → hello"},
            {"id": "trim", "name": "Trim Whitespace", "description": "Remove leading and trailing spaces", "example": "  hello  → hello"},
            {"id": "title_case", "name": "Title Case", "description": "Convert To Title Case", "example": "hello world → Hello World"},
            {"id": "remove_special_chars", "name": "Remove Special Characters", "description": "Keep only letters, numbers, and spaces", "example": "hello@world! → hello world"},
            {"id": "extract_numbers", "name": "Extract Numbers", "description": "Extract only numeric digits", "example": "abc123def456 → 123456"},
            {"id": "pad_zeros", "name": "Pad with Zeros", "description": "Add leading zeros to reach length", "example": "123 → 00123"}
        ]
    
    @classmethod
    def get_available_aggregations(cls) -> List[Dict[str, Any]]:
        """Get list of available aggregations"""
        return [
            {"id": "sum", "name": "Sum", "description": "Calculate sum of all values"},
            {"id": "avg", "name": "Average", "description": "Calculate average of all values"},
            {"id": "count", "name": "Count", "description": "Count non-null values"},
            {"id": "min", "name": "Minimum", "description": "Find minimum value"},
            {"id": "max", "name": "Maximum", "description": "Find maximum value"}
        ]
