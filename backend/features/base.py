"""
Base Feature Class for CleanFlow Plugin System

All features (enrichment, scraping, mapping, etc.) inherit from this base class
to ensure consistent interface and behavior.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
from pydantic import BaseModel
import pandas as pd


class FeatureConfig(BaseModel):
    """Base configuration for all features"""
    session_id: str
    params: Dict[str, Any] = {}


class FeatureResult(BaseModel):
    """Standard result format for all features"""
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = {}


class BaseFeature(ABC):
    """
    Abstract base class for all CleanFlow features.
    
    Features must implement:
    - preview(): Show sample results
    - execute(): Run full operation
    - validate(): Check if config is valid
    """
    
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.df: Optional[pd.DataFrame] = None
    
    @abstractmethod
    async def preview(self, config: Dict[str, Any], limit: int = 5) -> FeatureResult:
        """
        Preview feature results on a sample of data
        
        Args:
            config: Feature-specific configuration
            limit: Number of rows to preview
            
        Returns:
            FeatureResult with sample data
        """
        pass
    
    @abstractmethod
    async def execute(self, config: Dict[str, Any]) -> FeatureResult:
        """
        Execute feature on full dataset
        
        Args:
            config: Feature-specific configuration
            
        Returns:
            FeatureResult with complete data
        """
        pass
    
    @abstractmethod
    def validate(self, config: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        """
        Validate feature configuration
        
        Args:
            config: Feature-specific configuration
            
        Returns:
            (is_valid, error_message)
        """
        pass
    
    def load_data(self, dataframe: pd.DataFrame):
        """Load data into the feature"""
        self.df = dataframe
    
    def get_columns(self) -> List[str]:
        """Get available columns from loaded data"""
        if self.df is not None:
            return list(self.df.columns)
        return []
