"""
Data Matching Feature for CleanFlow

Match records across multiple datasets using various algorithms:
- Fuzzy Matching (Levenshtein distance) (via RapidFuzz)
- Cosine Similarity (via Scikit-Learn)
- Exact Matching (via Polars Join)
- Jaccard Similarity (Custom set logic)
"""

from typing import Dict, List, Any, Optional, Tuple
import polars as pl
import numpy as np
import time
import os
from rapidfuzz import process, fuzz, utils
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity as sklearn_cosine_similarity
from .base import BaseFeature, FeatureResult
try:
    from logger import setup_logger
    logger = setup_logger(__name__)
except ImportError:
    # Fallback if run elsewhere
    import logging
    logger = logging.getLogger(__name__)


class MatchingAlgorithm:
    """Base class for matching algorithms"""
    
    @staticmethod
    def fuzzy_match_batch(series1: pl.Series, series2: pl.Series, threshold: float, progress_callback=None) -> List[Dict[str, Any]]:
        """
        Batch fuzzy matching using RapidFuzz
        """
        # Convert to python list of strings (handling nulls)
        # Polars to_list is fast
        s1_list = series1.fill_null("").cast(pl.Utf8).str.to_lowercase().str.strip_chars().to_list()
        s2_list = series2.fill_null("").cast(pl.Utf8).str.to_lowercase().str.strip_chars().to_list()
        
        # Keep original indices? 
        # For simplicity, we assume index corresponds to list position 0..N
        # If original DF had specific index, we might need to pass it, but Polars uses integer indexing by default.
        
        # Filter out empty strings to speed up?
        # We need to map back to original index, so let's keep them but skip processing.
        
        results = []
        
        choices = [s for s in s2_list if s] # Filtered for matching targets
        # We need a map from choice to original index to return correct index
        # This is tricky if duplicates exist.
        # Let's map value -> list of indices
        choice_map = {}
        for idx, val in enumerate(s2_list):
            if val:
                if val not in choice_map: choice_map[val] = []
                choice_map[val].append(idx)
        
        unique_choices = list(choice_map.keys())
        
        if not s1_list or not unique_choices:
            return []

        logger.debug(f"Matching {len(s1_list)} items against {len(unique_choices)} unique choices. Threshold: {threshold}")
        
        total_items = len(s1_list)
        processed_count = 0
        
        # Iterate over source items
        for idx1, query in enumerate(s1_list):
            if not query: continue
            
            # rapidfuzz.process.extract returns (match, score, index_in_choices)
            # score_cutoff helps early pruning
            matches = process.extract(
                query, 
                unique_choices, 
                scorer=fuzz.ratio, 
                score_cutoff=threshold * 100,
                limit=None # Get all matches above threshold
            )
            
            for match, score, _ in matches:
                # Get all original indices for this match value
                # match is the string value
                original_indices_2 = choice_map.get(match, [])
                
                for idx2 in original_indices_2:
                    results.append({
                        'index1': idx1,
                        'index2': idx2,
                        'similarity_score': score / 100.0, # Normalize to 0-1
                        'match_value_1': query,
                        'match_value_2': match
                    })
            
            processed_count += 1
            if progress_callback and processed_count % 100 == 0:
                progress_callback(processed_count, total_items)
                
        if progress_callback:
            progress_callback(total_items, total_items)
            
        return results

    @staticmethod
    def exact_match_batch(series1: pl.Series, series2: pl.Series, threshold: float = 1.0, progress_callback=None) -> List[Dict[str, Any]]:
        """
        Vectorized exact matching using Polars join
        """
        # Create small dataframes with index to join
        df1 = pl.DataFrame({"idx": range(len(series1)), "val": series1}).with_columns(
            pl.col("val").fill_null("").cast(pl.Utf8).str.to_lowercase().str.strip_chars().alias("key")
        )
        df2 = pl.DataFrame({"idx": range(len(series2)), "val": series2}).with_columns(
            pl.col("val").fill_null("").cast(pl.Utf8).str.to_lowercase().str.strip_chars().alias("key")
        )
        
        # Filter empty keys
        df1 = df1.filter(pl.col("key") != "")
        df2 = df2.filter(pl.col("key") != "")
        
        # Join
        joined = df1.join(df2, on="key", how="inner")
        
        # Collect results
        # joined columns: idx, val, key, idx_right, val_right
        results = []
        rows = joined.select(["idx", "idx_right", "val", "val_right"]).to_dicts()
        
        for row in rows:
            results.append({
                'index1': row['idx'],
                'index2': row['idx_right'],
                'similarity_score': 1.0,
                'match_value_1': row['val'],
                'match_value_2': row['val_right']
            })
            
        if progress_callback: progress_callback(100, 100)
        return results
    
    @staticmethod
    def cosine_similarity_batch(series1: pl.Series, series2: pl.Series, threshold: float, progress_callback=None) -> List[Dict[str, Any]]:
        """
        Vectorized cosine similarity using scikit-learn
        """
        # Convert to list/numpy
        s1_list = series1.fill_null("").cast(pl.Utf8).str.to_lowercase().str.strip_chars().to_list()
        s2_list = series2.fill_null("").cast(pl.Utf8).str.to_lowercase().str.strip_chars().to_list()
        
        # Indices of non-empty strings
        s1_indices = [i for i, s in enumerate(s1_list) if s]
        s2_indices = [i for i, s in enumerate(s2_list) if s]
        
        s1_valid = [s1_list[i] for i in s1_indices]
        s2_valid = [s2_list[i] for i in s2_indices]
        
        if not s1_valid or not s2_valid:
            return []
            
        # Combine corpus to ensure same vocabulary
        corpus = s1_valid + s2_valid
        vectorizer = CountVectorizer(analyzer='char', ngram_range=(1, 3)) 
        tf_matrix = vectorizer.fit_transform(corpus)
        
        # Split back
        len_s1 = len(s1_valid)
        tf_s1 = tf_matrix[:len_s1]
        tf_s2 = tf_matrix[len_s1:]
        
        if progress_callback: progress_callback(50, 100)

        # Compute cosine similarity matrix
        similarity_matrix = sklearn_cosine_similarity(tf_s1, tf_s2, dense_output=True)
        
        results = []
        rows, cols = np.where(similarity_matrix >= threshold)
        
        count = 0
        total_rows = len(rows)
        for r, c in zip(rows, cols):
            score = similarity_matrix[r, c]
            results.append({
                'index1': s1_indices[r],
                'index2': s2_indices[c],
                'similarity_score': float(score),
                'match_value_1': s1_valid[r],
                'match_value_2': s2_valid[c]
            })
            count += 1
            if progress_callback and count % 1000 == 0:
                 progress_callback(50 + int(50 * count / total_rows), 100)
            
        if progress_callback: progress_callback(100, 100)
        return results

    @staticmethod
    def jaccard_similarity_batch(series1: pl.Series, series2: pl.Series, threshold: float, progress_callback=None) -> List[Dict[str, Any]]:
        """
        Jaccard similarity batch processing
        """
        s1_list = series1.fill_null("").cast(pl.Utf8).str.to_lowercase().str.strip_chars().to_list()
        s2_list = series2.fill_null("").cast(pl.Utf8).str.to_lowercase().str.strip_chars().to_list()
        
        # Pre-compute sets
        # mapping: index -> set of chars
        s1_sets = {idx: set(val) for idx, val in enumerate(s1_list) if val}
        s2_sets = {idx: set(val) for idx, val in enumerate(s2_list) if val}
        
        results = []
        total_items = len(s1_sets)
        processed = 0
        
        for idx1, set1 in s1_sets.items():
            
            for idx2, set2 in s2_sets.items():
                
                intersection = len(set1.intersection(set2))
                union = len(set1.union(set2))
                
                score = intersection / union if union > 0 else 0.0
                
                if score >= threshold:
                    results.append({
                        'index1': idx1,
                        'index2': idx2,
                        'similarity_score': score,
                        'match_value_1': s1_list[idx1],
                        'match_value_2': s2_list[idx2]
                    })
            
            processed += 1
            if progress_callback and processed % 10 == 0:
                progress_callback(processed, total_items)
                    
        return results

    
    ALGORITHMS = {
        'fuzzy': 'fuzzy_match_batch',
        'exact': 'exact_match_batch',
        'cosine': 'cosine_similarity_batch',
        'jaccard': 'jaccard_similarity_batch'
    }


class DataMatcher(BaseFeature):
    """Main data matching feature"""
    
    def __init__(self, session_id: str):
        super().__init__(session_id)
        self.datasets: Dict[str, pl.DataFrame] = {} # Store Polars DataFrames
        self.progress = {"percent": 0, "message": "Initializing...", "status": "idle"}
        self.results = None
    
    def load_dataset(self, dataset_id: str, dataframe: pl.DataFrame):
        """Load a dataset for matching"""
        self.datasets[dataset_id] = dataframe

    def load_dataset_from_file(self, dataset_id: str, file_path: str, sep: str = ","):
        """Load dataset from file (CSV or Excel)"""
        ext = os.path.splitext(file_path)[1].lower()
        try:
            logger.debug(f"Loading {file_path} with sep='{sep}'")
            if ext in ['.xlsx', '.xls']:
                df = pl.read_excel(file_path)
            else:
                 # Try to infer schema, handle complex quotes
                 df = pl.read_csv(
                     file_path, 
                     separator=sep, 
                     ignore_errors=True, 
                     truncate_ragged_lines=True, 
                     quote_char=None,  # Crucial for messy scraped data with unescaped quotes
                     null_values=["", "NA", "NaN"]
                 )
            
            # Cast all to string for consistent matching? 
            # Or keep types? Matching usually implies string comparison.
            # Let's cast to string for safety in this version
            df = df.select(pl.all().cast(pl.Utf8))
            
            self.datasets[dataset_id] = df
            return df.columns, len(df)
        except Exception as e:
            logger.error(f"Error loading file: {e}")
            raise ValueError(f"Failed to load dataset: {str(e)}")
    
    async def preview(self, config: Dict[str, Any], limit: int = 5) -> FeatureResult:
        """Preview matching on sample rows"""
        return await self._run_matching(config, preview_limit=limit)
    
    async def execute(self, config: Dict[str, Any]) -> FeatureResult:
        """Execute matching on full datasets"""
        self.progress = {"percent": 0, "message": "Starting...", "status": "running"}
        try:
            result = await self._run_matching(config, preview_limit=None)
            self.results = result.data if result.success else None
            self.progress = {"percent": 100, "message": "Complete", "status": "completed"}
            return result
        except Exception as e:
            self.progress = {"percent": 0, "message": f"Error: {str(e)}", "status": "error"}
            raise e
        
    async def _run_matching(self, config: Dict[str, Any], preview_limit: Optional[int] = None) -> FeatureResult:
        try:
            dataset1_id = config.get('dataset1')
            dataset2_id = config.get('dataset2')
            
            if dataset1_id not in self.datasets or dataset2_id not in self.datasets:
                return FeatureResult(success=False, error="Datasets not found")
            
            df1 = self.datasets[dataset1_id]
            df2 = self.datasets[dataset2_id]
            
            # If preview, slice inputs
            if preview_limit:
                df1 = df1.head(preview_limit)
                df2 = df2.head(preview_limit)
            # Perform matching
            return self._perform_matching(df1, df2, config, preview_limit)
        except Exception as e:
            logger.exception(f"Error during matching: {e}")
            return FeatureResult(success=False, error=str(e))

    def _update_progress(self, current, total, prefix="Processing"):
        percent = int((current / total) * 100) if total > 0 else 0
        self.progress = {"percent": percent, "message": f"{prefix} {percent}%", "status": "running"}

    def _perform_matching(self, df1: pl.DataFrame, df2: pl.DataFrame, config: Dict[str, Any], limit_hint: Optional[float] = None) -> List[Dict[str, Any]]:
        """Perform matching w/ multiple rules"""
        
        rules = config.get('rules', [])
        if not rules:
            # Backwards compatibility
            rules = [{
                'column1': config.get('match_column1'),
                'column2': config.get('match_column2'),
                'algorithm': config.get('algorithm', 'fuzzy'),
                'threshold': config.get('threshold', 0.8)
            }]
            
        output_columns = config.get('output_columns', {})
        
        # Store scores for each pair: key=(idx1, idx2), value=[score_rule_1, score_rule_2, ...]
        from collections import defaultdict
        candidate_scores = defaultdict(lambda: [0.0] * len(rules))
        
        total_rules = len(rules)
        
        for rule_idx, rule in enumerate(rules):
            col1 = rule.get('column1')
            col2 = rule.get('column2')
            algo = rule.get('algorithm', 'fuzzy')
            thresh = rule.get('threshold', 0.8)
            
            # Polars syntax
            if col1 not in df1.columns or col2 not in df2.columns:
                logger.warning(f"Columns {col1} or {col2} not found for rule {rule_idx}")
                continue
                
            method_name = MatchingAlgorithm.ALGORITHMS.get(algo, 'fuzzy_match_batch')
            match_method = getattr(MatchingAlgorithm, method_name)
            
            # Callback adapter
            def progress_cb(cur, tot):
                rule_contribution = 1.0 / total_rules
                current_rule_progress = (cur / tot) if tot > 0 else 0
                global_percent = int(((rule_idx + current_rule_progress) / total_rules) * 100)
                self.progress = {
                    "percent": global_percent, 
                    "message": f"Rule {rule_idx+1}/{total_rules}: {algo} matching...",
                    "status": "running"
                }

            # Run matching
            # Polars extract column as Series
            logger.debug(f"Running Rule {rule_idx+1}: {algo} on {col1} <-> {col2}")
            s1 = df1[col1]
            s2 = df2[col2]
            
            raw_matches = match_method(s1, s2, thresh, progress_callback=progress_cb if not limit_hint else None)
            
            logger.debug(f"Rule {rule_idx+1} returned {len(raw_matches)} raw matches")
            # Aggregate scores
            for m in raw_matches:
                idx1, idx2 = m['index1'], m['index2']
                candidate_scores[(idx1, idx2)][rule_idx] = m['similarity_score']
                
        # Final aggregation
        final_matches = []
        global_threshold = config.get('global_threshold', 0.0)
        
        logger.debug(f"Processing {len(candidate_scores)} unique candidates. Global Threshold: {global_threshold}")
        self.progress = {"percent": 90, "message": "Finalizing results...", "status": "running"}
        
        # We need to fetch rows by index. Polars df[i] gets row i.
        # But we want to do batch lookup if possible.
        # Fetching rows one by one is slow.
        
        # Optimization: Collect all needed indices, then slice or join.
        # Since we just need to return dicts, we can iterate if result set isn't massive.
        # If massive, we should construct a Polars DF.
        
        # Let's iterate for now to match logic structure.
        
        for (idx1, idx2), scores in candidate_scores.items():
            avg_score = sum(scores) / total_rules
            
            if avg_score < global_threshold:
                continue
                
            record = {
                'similarity_score': round(avg_score, 4),
                'match_confidence': "High" if avg_score > 0.9 else "Medium" if avg_score > 0.7 else "Low",
                'match_details': scores
            }
            
            # Get Row Data
            # Polars row access
            try:
                row1 = df1.row(idx1, named=True)
                row2 = df2.row(idx2, named=True)
            except Exception as e:
                logger.error(f"Error accessing row idx1={idx1}, idx2={idx2}: {e}")
                continue
            
            if rules:
                r1 = rules[0]
                record['match_value_1'] = row1.get(r1['column1'], '')
                record['match_value_2'] = row2.get(r1['column2'], '')
            
            # Output columns
            for col in output_columns.get('dataset1', []):
                if col in row1:
                    record[f'ds1_{col}'] = row1[col]
                    
            for col in output_columns.get('dataset2', []):
                if col in row2:
                    record[f'ds2_{col}'] = row2[col]
            
            final_matches.append(record)
            
        logger.debug(f"Final aggregated matches: {len(final_matches)}")
        # Sort by score
        final_matches.sort(key=lambda x: x['similarity_score'], reverse=True)
        
        # Slice results for preview ensures exact limit if matches > limit
        if limit_hint:
            final_matches = final_matches[:int(limit_hint)]
            
        metadata = {
            'match_count': len(final_matches),
            'dataset1_rows': len(df1),
            'dataset2_rows': len(df2),
            'config': config
        }
        
        self.progress = {"percent": 100, "message": "Done", "status": "completed"}
        return FeatureResult(
            success=True,
            data=final_matches,
            metadata=metadata
        )
        
    def get_progress(self):
        return self.progress
    
    def get_results(self):
        return self.results
    
    def _flat_results(self) -> list:
        """Return results with match_details stripped (safe for export)."""
        if not self.results:
            return []
        flat = []
        for r in self.results:
            row = {k: v for k, v in r.items() if k != 'match_details'}
            flat.append(row)
        return flat

    def export_to_csv(self) -> Optional[str]:
        """Export results to CSV file and return path."""
        try:
            flat = self._flat_results()
            if flat:
                df = pl.DataFrame(flat)
            else:
                df = pl.DataFrame({"Message": ["No matches found"]})

            upload_dir = os.path.join(os.getcwd(), "uploads")
            os.makedirs(upload_dir, exist_ok=True)
            file_path = os.path.join(upload_dir, f"matching_results_{self.session_id}.csv")
            df.write_csv(file_path)
            return file_path
        except Exception as e:
            logger.exception(f"Error exporting CSV: {e}")
            raise ValueError(f"Failed to export CSV: {str(e)}")

    def export_to_excel(self) -> Optional[str]:
        """Export results to Excel (.xlsx) file and return path."""
        try:
            flat = self._flat_results()
            if flat:
                df = pl.DataFrame(flat)
            else:
                df = pl.DataFrame({"Message": ["No matches found"]})

            upload_dir = os.path.join(os.getcwd(), "uploads")
            os.makedirs(upload_dir, exist_ok=True)
            file_path = os.path.join(upload_dir, f"matching_results_{self.session_id}.xlsx")

            # Polars write_excel requires openpyxl (already in requirements via fastexcel / openpyxl)
            try:
                df.write_excel(file_path)
            except Exception:
                # Fallback: write CSV then convert with openpyxl
                import openpyxl
                wb = openpyxl.Workbook()
                ws = wb.active
                ws.title = "Matching Results"
                ws.append(df.columns)
                for row in df.rows():
                    ws.append([str(v) if v is not None else '' for v in row])
                wb.save(file_path)

            return file_path
        except Exception as e:
            logger.exception(f"Error exporting Excel: {e}")
            raise ValueError(f"Failed to export Excel: {str(e)}")

    def validate(self, config: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        """Validate matching configuration"""
        if 'dataset1' not in config or 'dataset2' not in config:
            return False, "Two datasets are required"
        
        rules = config.get('rules')
        if rules:
            if not isinstance(rules, list):
                return False, "Rules must be a list"
            for r in rules:
                if 'column1' not in r or 'column2' not in r:
                     return False, "Match columns must be specified for all rules"
        else:
            if 'match_column1' not in config or 'match_column2' not in config:
                return False, "Match columns must be specified for both datasets"
        
        return True, None

    @classmethod
    def get_available_algorithms(cls) -> List[Dict[str, Any]]:
        return [
            {
                "id": "fuzzy",
                "name": "Fuzzy Matching",
                "description": "Levenshtein-based fuzzy string matching. Best for typos and variations.",
                "use_case": "Names with typos: 'John Smith' vs 'Jon Smith'",
                "speed": "Fast (Rapidfuzz)"
            },
            {
                "id": "exact",
                "name": "Exact Match",
                "description": "Exact string matching (case-insensitive). Fastest option.",
                "use_case": "IDs, codes, exact duplicates",
                "speed": "Instant"
            },
            {
                "id": "cosine",
                "name": "Cosine Similarity",
                "description": "Character frequency-based similarity. Good for longer texts.",
                "use_case": "Product descriptions, addresses",
                "speed": "Fast (Vectorized)"
            },
            {
                "id": "jaccard",
                "name": "Jaccard Similarity",
                "description": "Set-based similarity. Good for comparing unique characters.",
                "use_case": "Tags, keywords, short codes",
                "speed": "Medium"
            }
        ]
