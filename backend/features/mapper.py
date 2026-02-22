"""
Enhanced Schema Mapping Feature for CleanFlow

Advanced transformations including:
- Column concatenation
- Aggregation (sum, avg, count, min, max)
- Header generation
- Custom formulas
- All previous transformations
"""

from typing import Dict, List, Any, Optional
import polars as pl
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
    """Advanced data transformation functions mapping to Polars expressions"""
    
    # Map transformation names to factory functions that return Polars Expressions
    @staticmethod
    def get_expression(transform_name: str, col_name: str) -> Optional[pl.Expr]:
        c = pl.col(col_name)
        
        if transform_name == 'uppercase':
            return c.cast(pl.Utf8).str.to_uppercase()
        elif transform_name == 'lowercase':
            return c.cast(pl.Utf8).str.to_lowercase()
        elif transform_name == 'trim':
            return c.cast(pl.Utf8).str.strip_chars()
        elif transform_name == 'title_case':
            return c.cast(pl.Utf8).str.to_titlecase()
        elif transform_name == 'remove_special_chars':
            return c.cast(pl.Utf8).str.replace_all(r'[^a-zA-Z0-9\s]', '')
        elif transform_name == 'extract_numbers':
            return c.cast(pl.Utf8).str.extract_all(r'\d+').list.join('')
        elif transform_name == 'pad_zeros':
            # Default length 5 for now as param wasn't passed in old architecture easily
            return c.cast(pl.Utf8).str.zfill(5) 
        
        return None

    @staticmethod
    def get_aggregation(agg_type: str, col_name: str) -> Optional[pl.Expr]:
        c = pl.col(col_name)
        if agg_type == 'sum': return c.sum()
        elif agg_type == 'avg': return c.mean()
        elif agg_type == 'count': return c.count()
        elif agg_type == 'min': return c.min()
        elif agg_type == 'max': return c.max()
        return None


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
            
            # Use lazy evaluation
            # limit before processing for speed
            sample_lf = self.df.lazy().limit(limit)
            result_df = self._apply_mappings(sample_lf, config).collect()
            
            return FeatureResult(
                success=True,
                data=result_df.to_dicts(),
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
            
            result_df = self._apply_mappings(self.df.lazy(), config).collect()
            
            return FeatureResult(
                success=True,
                data=result_df.to_dicts(),
                metadata={
                    'total_rows': len(result_df),
                    'columns': list(result_df.columns)
                }
            )
        except Exception as e:
            return FeatureResult(success=False, error=str(e))
    
    def _apply_mappings(self, lf: pl.LazyFrame, config: Dict[str, Any]) -> pl.LazyFrame:
        """Apply all mappings and transformations using Polars Expressions"""
        
        mappings = config.get('mappings', {})
        transformations = config.get('transformations', {})
        concatenations = config.get('concatenations', {})
        aggregations = config.get('aggregations', {})
        
        # We need to construct a SELECT statement essentially.
        # Start with mappings
        
        exprs = []
        
        # 1. Simple Mappings & Transformations
        for source_col, target_col in mappings.items():
            if source_col not in self.df.columns: # Check against original columns
                continue
            
            # Base expression: alias source to target
            col_expr = pl.col(source_col).alias(target_col)
            
            # Apply transformations chain
            if target_col in transformations:
                for transform_name in transformations[target_col]:
                    # We need to apply transformation to the expression built so far
                    # But get_expression expects a col name.
                    # We can chain it: pl.col(source).transform().alias(target)
                    
                    # Re-implement transformation logic to accept expr instead of col_name
                    if transform_name == 'uppercase':
                        col_expr = col_expr.cast(pl.Utf8).str.to_uppercase()
                    elif transform_name == 'lowercase':
                        col_expr = col_expr.cast(pl.Utf8).str.to_lowercase()
                    elif transform_name == 'trim':
                        col_expr = col_expr.cast(pl.Utf8).str.strip_chars()
                    elif transform_name == 'title_case':
                        col_expr = col_expr.cast(pl.Utf8).str.to_titlecase()
                    elif transform_name == 'remove_special_chars':
                        col_expr = col_expr.cast(pl.Utf8).str.replace_all(r'[^a-zA-Z0-9\s]', '')
                    elif transform_name == 'extract_numbers':
                         col_expr = col_expr.cast(pl.Utf8).str.extract_all(r'\d+').list.join('')
                    elif transform_name == 'pad_zeros':
                        col_expr = col_expr.cast(pl.Utf8).str.zfill(5)
            
            exprs.append(col_expr)
        
        # 2. Concatenations
        for new_col, concat_config in concatenations.items():
            columns = concat_config.get('columns', [])
            separator = concat_config.get('separator', ' ')
            
            # Filter valid columns
            valid_cols = [c for c in columns if c in self.df.columns]
            if not valid_cols:
                continue
                
            # pl.concat_str([cols], separator)
            concat_expr = pl.concat_str([pl.col(c).cast(pl.Utf8).fill_null('') for c in valid_cols], separator=separator).alias(new_col)
            exprs.append(concat_expr)
            
        # 3. Aggregations 
        # Aggregations return a single row usually, implying we should return a single row DF?
        # Or attach the aggregation to every row (window function)?
        # The original code did `result_df[new_col] = agg_value` which broadcasts the scalar to all rows.
        # Polars: select(agg). But if we mix column maps and aggs, we might want broadcasting.
        
        # If aggregations are present, we probably want to return them as columns repeated?
        # Or if ONLY aggregations are present, return 1 row?
        # The UI probably expects the transformed dataset.
        
        # Let's support broadcasting for now to match pandas behavior
        agg_exprs = []
        for new_col, agg_config in aggregations.items():
            column = agg_config.get('column')
            agg_type = agg_config.get('type')
            
            if column in self.df.columns and agg_type:
                expr = AdvancedTransformation.get_aggregation(agg_type, column)
                if expr is not None:
                    # Broadcast to all rows?
                    # In Polars select context, a scalar is broadcasted.
                    agg_exprs.append(expr.alias(new_col))
        
        # If we have aggregations, add them to the select list
        exprs.extend(agg_exprs)
        
        # Return new dataframe with selected columns
        return lf.select(exprs)
    
    def validate(self, config: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        """Validate mapping configuration"""
        if not config.get('mappings') and not config.get('concatenations') and not config.get('aggregations'):
            return False, "At least one mapping, concatenation, or aggregation is required"
        
        return True, None
    
    def suggest_mappings(self, target_schema: Dict[str, Any]) -> Dict[str, Any]:
        """Suggest intelligent column mappings"""
        if self.df is None:
            return {}
        
        source_columns = self.df.columns
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
