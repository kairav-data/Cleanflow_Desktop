"""
Data Matching Feature for CleanFlow

Match records across multiple datasets using various algorithms:
- Fuzzy Matching (Levenshtein distance)
- Cosine Similarity
- Exact Matching
- Jaccard Similarity
"""

from typing import Dict, List, Any, Optional, Tuple
import pandas as pd
import numpy as np
from difflib import SequenceMatcher
from .base import BaseFeature, FeatureResult


class MatchingAlgorithm:
    """Base class for matching algorithms"""
    
    @staticmethod
    def fuzzy_match(str1: str, str2: str) -> float:
        """
        Fuzzy matching using SequenceMatcher (similar to Levenshtein)
        Returns similarity score 0-1
        """
        if pd.isna(str1) or pd.isna(str2):
            return 0.0
        
        s1 = str(str1).lower().strip()
        s2 = str(str2).lower().strip()
        
        return SequenceMatcher(None, s1, s2).ratio()
    
    @staticmethod
    def exact_match(str1: str, str2: str) -> float:
        """Exact string matching"""
        if pd.isna(str1) or pd.isna(str2):
            return 0.0
        
        return 1.0 if str(str1).lower().strip() == str(str2).lower().strip() else 0.0
    
    @staticmethod
    def cosine_similarity(str1: str, str2: str) -> float:
        """
        Cosine similarity based on character frequency
        Returns similarity score 0-1
        """
        if pd.isna(str1) or pd.isna(str2):
            return 0.0
        
        s1 = str(str1).lower().strip()
        s2 = str(str2).lower().strip()
        
        # Create character frequency vectors
        all_chars = set(s1 + s2)
        vec1 = np.array([s1.count(c) for c in all_chars])
        vec2 = np.array([s2.count(c) for c in all_chars])
        
        # Calculate cosine similarity
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return dot_product / (norm1 * norm2)
    
    @staticmethod
    def jaccard_similarity(str1: str, str2: str) -> float:
        """
        Jaccard similarity based on character sets
        Returns similarity score 0-1
        """
        if pd.isna(str1) or pd.isna(str2):
            return 0.0
        
        s1 = set(str(str1).lower().strip())
        s2 = set(str(str2).lower().strip())
        
        intersection = len(s1.intersection(s2))
        union = len(s1.union(s2))
        
        if union == 0:
            return 0.0
        
        return intersection / union
    
    ALGORITHMS = {
        'fuzzy': fuzzy_match.__func__,
        'exact': exact_match.__func__,
        'cosine': cosine_similarity.__func__,
        'jaccard': jaccard_similarity.__func__
    }


class DataMatcher(BaseFeature):
    """Main data matching feature"""
    
    def __init__(self, session_id: str):
        super().__init__(session_id)
        self.datasets = {}  # Store multiple datasets
    
    def load_dataset(self, dataset_id: str, dataframe: pd.DataFrame):
        """Load a dataset for matching"""
        self.datasets[dataset_id] = dataframe
    
    async def preview(self, config: Dict[str, Any], limit: int = 5) -> FeatureResult:
        """Preview matching on sample rows"""
        try:
            is_valid, error = self.validate(config)
            if not is_valid:
                return FeatureResult(success=False, error=error)
            
            # Get sample data from each dataset
            dataset1_id = config.get('dataset1')
            dataset2_id = config.get('dataset2')
            
            if dataset1_id not in self.datasets or dataset2_id not in self.datasets:
                return FeatureResult(success=False, error="Datasets not found")
            
            df1 = self.datasets[dataset1_id].head(limit)
            df2 = self.datasets[dataset2_id].head(limit)
            
            # Perform matching
            matches = self._perform_matching(df1, df2, config)
            
            return FeatureResult(
                success=True,
                data=matches[:limit],
                metadata={
                    'preview_rows': len(matches[:limit]),
                    'algorithm': config.get('algorithm'),
                    'threshold': config.get('threshold', 0.8)
                }
            )
        except Exception as e:
            return FeatureResult(success=False, error=str(e))
    
    async def execute(self, config: Dict[str, Any]) -> FeatureResult:
        """Execute matching on full datasets"""
        try:
            is_valid, error = self.validate(config)
            if not is_valid:
                return FeatureResult(success=False, error=error)
            
            dataset1_id = config.get('dataset1')
            dataset2_id = config.get('dataset2')
            
            if dataset1_id not in self.datasets or dataset2_id not in self.datasets:
                return FeatureResult(success=False, error="Datasets not found")
            
            df1 = self.datasets[dataset1_id]
            df2 = self.datasets[dataset2_id]
            
            # Perform matching
            matches = self._perform_matching(df1, df2, config)
            
            return FeatureResult(
                success=True,
                data=matches,
                metadata={
                    'total_matches': len(matches),
                    'dataset1_rows': len(df1),
                    'dataset2_rows': len(df2),
                    'algorithm': config.get('algorithm'),
                    'threshold': config.get('threshold', 0.8)
                }
            )
        except Exception as e:
            return FeatureResult(success=False, error=str(e))
    
    def _perform_matching(self, df1: pd.DataFrame, df2: pd.DataFrame, config: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Perform the actual matching between datasets"""
        match_column1 = config.get('match_column1')
        match_column2 = config.get('match_column2')
        algorithm = config.get('algorithm', 'fuzzy')
        threshold = config.get('threshold', 0.8)
        output_columns = config.get('output_columns', {})
        
        if match_column1 not in df1.columns or match_column2 not in df2.columns:
            return []
        
        # Get matching algorithm
        match_func = MatchingAlgorithm.ALGORITHMS.get(algorithm, MatchingAlgorithm.fuzzy_match)
        
        matches = []
        
        # Compare each row in df1 with each row in df2
        for idx1, row1 in df1.iterrows():
            val1 = row1[match_column1]
            
            for idx2, row2 in df2.iterrows():
                val2 = row2[match_column2]
                
                # Calculate similarity
                similarity = match_func(val1, val2)
                
                # If above threshold, it's a match
                if similarity >= threshold:
                    match_record = {
                        'similarity_score': round(similarity, 4),
                        'match_value_1': val1,
                        'match_value_2': val2
                    }
                    
                    # Add selected output columns from dataset 1
                    for col in output_columns.get('dataset1', []):
                        if col in row1.index:
                            match_record[f'ds1_{col}'] = row1[col]
                    
                    # Add selected output columns from dataset 2
                    for col in output_columns.get('dataset2', []):
                        if col in row2.index:
                            match_record[f'ds2_{col}'] = row2[col]
                    
                    matches.append(match_record)
        
        # Sort by similarity score (highest first)
        matches.sort(key=lambda x: x['similarity_score'], reverse=True)
        
        return matches
    
    def validate(self, config: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        """Validate matching configuration"""
        if 'dataset1' not in config or 'dataset2' not in config:
            return False, "Two datasets are required"
        
        if 'match_column1' not in config or 'match_column2' not in config:
            return False, "Match columns must be specified for both datasets"
        
        algorithm = config.get('algorithm')
        if algorithm and algorithm not in MatchingAlgorithm.ALGORITHMS:
            return False, f"Unknown algorithm: {algorithm}"
        
        return True, None
    
    @classmethod
    def get_available_algorithms(cls) -> List[Dict[str, Any]]:
        """Get list of available matching algorithms"""
        return [
            {
                "id": "fuzzy",
                "name": "Fuzzy Matching",
                "description": "Levenshtein-based fuzzy string matching. Best for typos and variations.",
                "use_case": "Names with typos: 'John Smith' vs 'Jon Smith'",
                "speed": "Medium"
            },
            {
                "id": "exact",
                "name": "Exact Match",
                "description": "Exact string matching (case-insensitive). Fastest option.",
                "use_case": "IDs, codes, exact duplicates",
                "speed": "Fast"
            },
            {
                "id": "cosine",
                "name": "Cosine Similarity",
                "description": "Character frequency-based similarity. Good for longer texts.",
                "use_case": "Product descriptions, addresses",
                "speed": "Medium"
            },
            {
                "id": "jaccard",
                "name": "Jaccard Similarity",
                "description": "Set-based similarity. Good for comparing unique characters.",
                "use_case": "Tags, keywords, short codes",
                "speed": "Fast"
            }
        ]
