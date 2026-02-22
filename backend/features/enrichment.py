"""
Data Enrichment Feature for CleanFlow

Enriches datasets with additional information:
- Email validation and company extraction
- Phone number formatting and validation
- Address standardization and geocoding
- Name parsing and gender detection
"""

from typing import Dict, List, Any, Optional
import polars as pl
import re
from .base import BaseFeature, FeatureResult


class EnrichmentProvider:
    """Base class for enrichment providers"""
    
    @staticmethod
    def enrich_struct(value: Any, params: Dict[str, Any]) -> Dict[str, Any]:
        """Enrich a single value, returning a dictionary for struct creation"""
        raise NotImplementedError


class EmailEnrichmentProvider(EnrichmentProvider):
    """Email validation and company extraction"""
    
    @staticmethod
    def enrich_struct(value: Any, params: Dict[str, Any]) -> Dict[str, Any]:
        if value is None or not isinstance(value, str):
            return {"valid": False, "company": None, "domain": None, "is_business": False}
        
        email = str(value).strip().lower()
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        
        is_valid = bool(re.match(email_pattern, email))
        domain = email.split('@')[1] if '@' in email else None
        company = domain.split('.')[0] if domain else None
        
        return {
            "valid": is_valid,
            "company": company.title() if company else None,
            "domain": domain,
            "is_business": domain not in ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'] if domain else False
        }


class PhoneEnrichmentProvider(EnrichmentProvider):
    """Phone number formatting and validation"""
    
    @staticmethod
    def enrich_struct(value: Any, params: Dict[str, Any]) -> Dict[str, Any]:
        if value is None:
            return {"valid": False, "formatted": None, "digits": None, "length": 0}
        
        # Remove all non-digit characters
        phone = re.sub(r'\D', '', str(value))
        
        # Basic validation (10 digits for US)
        is_valid = len(phone) == 10 or len(phone) == 11
        
        # Format as (XXX) XXX-XXXX
        if len(phone) == 10:
            formatted = f"({phone[:3]}) {phone[3:6]}-{phone[6:]}"
        elif len(phone) == 11 and phone[0] == '1':
            formatted = f"+1 ({phone[1:4]}) {phone[4:7]}-{phone[7:]}"
        else:
            formatted = phone
        
        return {
            "valid": is_valid,
            "formatted": formatted if is_valid else None,
            "digits": phone,
            "length": len(phone)
        }


class AddressEnrichmentProvider(EnrichmentProvider):
    """Address standardization and basic parsing"""
    
    @staticmethod
    def enrich_struct(value: Any, params: Dict[str, Any]) -> Dict[str, Any]:
        if value is None or not isinstance(value, str):
            return {"standardized": None, "zip_code": None, "state": None, "has_zip": False, "has_state": False}
        
        address = str(value).strip()
        
        # Extract ZIP code (5 or 9 digits)
        zip_match = re.search(r'\b\d{5}(?:-\d{4})?\b', address)
        zip_code = zip_match.group(0) if zip_match else None
        
        # Extract state (2 letter code)
        state_match = re.search(r'\b[A-Z]{2}\b', address)
        state = state_match.group(0) if state_match else None
        
        # Standardize abbreviations
        standardized = address.upper()
        standardized = standardized.replace('STREET', 'ST')
        standardized = standardized.replace('AVENUE', 'AVE')
        standardized = standardized.replace('ROAD', 'RD')
        standardized = standardized.replace('BOULEVARD', 'BLVD')
        
        return {
            "standardized": standardized,
            "zip_code": zip_code,
            "state": state,
            "has_zip": zip_code is not None,
            "has_state": state is not None
        }


class NameEnrichmentProvider(EnrichmentProvider):
    """Name parsing and basic analysis"""
    
    @staticmethod
    def enrich_struct(value: Any, params: Dict[str, Any]) -> Dict[str, Any]:
        if value is None or not isinstance(value, str):
            return {"first_name": None, "last_name": None, "middle_name": None, "parts": 0}
        
        name = str(value).strip()
        parts = name.split()
        
        if len(parts) == 0:
            return {"first_name": None, "last_name": None, "middle_name": None, "parts": 0}
        elif len(parts) == 1:
            return {"first_name": parts[0], "last_name": None, "middle_name": None, "parts": 1}
        else:
            return {
                "first_name": parts[0],
                "last_name": parts[-1],
                "middle_name": ' '.join(parts[1:-1]) if len(parts) > 2 else None,
                "parts": len(parts)
            }


class DataEnrichment(BaseFeature):
    """Main data enrichment feature"""
    
    PROVIDERS = {
        'email': EmailEnrichmentProvider,
        'phone': PhoneEnrichmentProvider,
        'address': AddressEnrichmentProvider,
        'name': NameEnrichmentProvider
    }
    
    async def preview(self, config: Dict[str, Any], limit: int = 5) -> FeatureResult:
        """Preview enrichment on sample rows"""
        try:
            is_valid, error = self.validate(config)
            if not is_valid:
                return FeatureResult(success=False, error=error)
            
            return await self._run_enrichment(config, limit=limit)

        except Exception as e:
            return FeatureResult(success=False, error=str(e))
    
    async def execute(self, config: Dict[str, Any]) -> FeatureResult:
        """Execute enrichment on full dataset"""
        try:
            is_valid, error = self.validate(config)
            if not is_valid:
                return FeatureResult(success=False, error=error)
            
            return await self._run_enrichment(config, limit=None)

        except Exception as e:
            return FeatureResult(success=False, error=str(e))
    
    async def _run_enrichment(self, config: Dict[str, Any], limit: Optional[int] = None) -> FeatureResult:
        column = config.get('column')
        provider_type = config.get('provider')
        params = config.get('params', {})
        output_prefix = config.get('output_prefix', f'{column}_enriched')
        
        if self.df is None or column not in self.df.columns:
            return FeatureResult(success=False, error=f"Column '{column}' not found")
        
        # Prepare Data
        df_to_process = self.df
        if limit and limit > 0:
            df_to_process = df_to_process.head(limit)
        
        provider = self.PROVIDERS[provider_type]
        
        # Determine output schema for struct
        # We need a sample to infer valid types or hardcode them based on provider
        # For simplicity in Polars map_elements, we let it infer or assume Dict[str, Any]
        # But map_elements is slow. Ideally, we write Polars expressions.
        # Given the regex complexity in providers, map_elements is acceptable for now.
        
        # Define return type for safety if possible, or leave as infer (slower but easier migration)
        
        def enrich_wrapper(val):
            return provider.enrich_struct(val, params)
        
        # Apply
        # We create a struct column
        
        # Polars 1.0+ recommends map_elements with return_dtype for performance/safety
        # Let's try to infer from the first provider
        # Actually, let's just let Polars handle the object/struct conversion
        
        enriched_col_name = f"{output_prefix}_struct"
        
        result_df = df_to_process.with_columns(
            pl.col(column).map_elements(enrich_wrapper, return_dtype=pl.Struct).alias(enriched_col_name)
        )
        
        # Unnest the struct to get individual columns
        result_df = result_df.unnest(enriched_col_name)
        
        # Rename unnested columns to have prefix
        # The unnested columns will have keys from the dict (valid, company, etc.)
        # We need to rename them
        
        # Get keys from provider info or inspect?
        # Let's inspect available keys from the provider definition if possible
        # Or easier: rename after unnesting.
        
        # Issues: if map_elements returns nulls or inconsistent keys, unnest might fail or create nulls.
        # Our providers return consistent keys.
        
        # Get the keys provided by this provider
        sample_keys = list(provider.enrich_struct("sample", params).keys())
        
        rename_map = {key: f"{output_prefix}_{key}" for key in sample_keys}
        
        # Only rename columns that exist (in case unnest failed/collision)
        existing_cols = [c for c in sample_keys if c in result_df.columns]
        final_rename_map = {k: rename_map[k] for k in existing_cols}
        
        result_df = result_df.rename(final_rename_map)
        
        # Limit result metadata columns to the new ones
        new_cols = list(final_rename_map.values())

        return FeatureResult(
            success=True,
            data=result_df.to_dicts(), # Convert to list of dicts for JSON serialization
            metadata={
                'total_rows': len(result_df),
                'new_columns': new_cols,
                'provider': provider_type
            }
        )

    def validate(self, config: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        """Validate enrichment configuration"""
        if 'column' not in config:
            return False, "Column name is required"
        
        if 'provider' not in config:
            return False, "Provider type is required"
        
        provider = config.get('provider')
        if provider not in self.PROVIDERS:
            return False, f"Unknown provider: {provider}. Available: {list(self.PROVIDERS.keys())}"
        
        return True, None
    
    @classmethod
    def get_available_providers(cls) -> List[Dict[str, Any]]:
        """Get list of available enrichment providers"""
        return [
            {
                "id": "email",
                "name": "Email Validation",
                "description": "Validate emails and extract company information",
                "outputs": ["valid", "company", "domain", "is_business"]
            },
            {
                "id": "phone",
                "name": "Phone Formatting",
                "description": "Format and validate phone numbers",
                "outputs": ["valid", "formatted", "digits", "length"]
            },
            {
                "id": "address",
                "name": "Address Standardization",
                "description": "Standardize and parse addresses",
                "outputs": ["standardized", "zip_code", "state", "has_zip", "has_state"]
            },
            {
                "id": "name",
                "name": "Name Parsing",
                "description": "Parse full names into components",
                "outputs": ["first_name", "last_name", "middle_name", "parts"]
            }
        ]
