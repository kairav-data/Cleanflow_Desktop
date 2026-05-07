"""
Web Scraping Feature for CleanFlow

Uses Firecrawl API to extract Markdown, HTML, Screenshots, and Structured JSON data.
Requires a valid Firecrawl API key linked to the user.
"""

from typing import Dict, List, Any, Optional
import httpx
import json
from .base import BaseFeature, FeatureResult

class WebScraper(BaseFeature):
    """Main web scraping feature using Firecrawl API"""
    
    FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1"
    
    def __init__(self, session_id: str, api_key: str = None):
        super().__init__(session_id)
        self.api_key = api_key

    async def _call_firecrawl_scrape(self, url: str, formats: List[str], extract_prompt: str = None) -> Dict[str, Any]:
        if not self.api_key:
            raise Exception("Firecrawl API key is missing. Please set it in your account resources.")
            
        payload = {
            "url": url,
            "formats": formats
        }
        
        if "extract" in formats and extract_prompt:
            payload["extract"] = {"prompt": extract_prompt}
            
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(f"{self.FIRECRAWL_BASE_URL}/scrape", json=payload, headers=headers)
            
            if response.status_code != 200:
                error_msg = response.text
                try:
                    error_msg = response.json().get("error", error_msg)
                except:
                    pass
                raise Exception(f"Firecrawl API Error: {error_msg}")
                
            return response.json()
            
    async def get_credit_usage(self) -> Dict[str, Any]:
        """Fetch and normalize Firecrawl credit usage for the UI."""
        if not self.api_key:
            return {
                "remaining": None,
                "consumed": None,
                "plan": None,
                "billing_period_start": None,
                "billing_period_end": None,
                "error": "API key not set"
            }

        headers = {
            "Authorization": f"Bearer {self.api_key}"
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.FIRECRAWL_BASE_URL}/team/credit-usage", headers=headers)

            if response.status_code != 200:
                return {
                    "remaining": None,
                    "consumed": None,
                    "plan": None,
                    "billing_period_start": None,
                    "billing_period_end": None,
                    "error": f"Failed to fetch credits: {response.status_code}"
                }

            payload = response.json()
            data = payload.get("data", {}) if isinstance(payload, dict) else {}

            remaining = data.get("remaining")
            if remaining is None:
                remaining = data.get("remainingCredits")
            if remaining is None:
                remaining = data.get("remaining_credits")

            plan = data.get("plan")
            if plan is None:
                plan = data.get("planCredits")
            if plan is None:
                plan = data.get("plan_credits")

            available_total = data.get("available_total")
            if available_total is None:
                available_total = remaining

            consumed = data.get("consumed")
            if consumed is None:
                consumed = data.get("consumedCredits")

            extra_credits = data.get("extraCredits")
            if (
                isinstance(plan, (int, float))
                and isinstance(available_total, (int, float))
            ):
                extra_credits = max(available_total - plan, 0)
                remaining = min(available_total, plan)

            if consumed is None and isinstance(plan, (int, float)) and isinstance(remaining, (int, float)):
                consumed = max(plan - remaining, 0)

            billing_period_start = (
                data.get("billing_period_start")
                or data.get("billingPeriodStart")
            )
            billing_period_end = (
                data.get("billing_period_end")
                or data.get("billingPeriodEnd")
            )

            return {
                "remaining": remaining,
                "available_total": available_total,
                "consumed": consumed,
                "plan": plan,
                "extra_credits": extra_credits,
                "billing_period_start": billing_period_start,
                "billing_period_end": billing_period_end,
                "error": None
            }

    async def preview(self, config: Dict[str, Any], limit: int = 1) -> FeatureResult:
        """Preview scraping on a single URL"""
        try:
            is_valid, error = self.validate(config)
            if not is_valid:
                return FeatureResult(success=False, error=error)
            
            url = config.get('url')
            formats = config.get('formats', ['markdown'])
            extract_prompt = config.get('extract_prompt')
            
            result = await self._call_firecrawl_scrape(url, formats, extract_prompt)
            data = result.get('data', {})
            
            formatted_item = {"url": url}
            
            if "markdown" in formats and "markdown" in data:
                formatted_item["markdown"] = data["markdown"][:500] + "..." if len(data.get("markdown", "")) > 500 else data.get("markdown")
            if "html" in formats and "html" in data:
                formatted_item["html"] = "HTML content retrieved (truncated for preview)"
            if "screenshot" in formats and "screenshot" in data:
                formatted_item["screenshot_url"] = data["screenshot"]
            if "extract" in formats and "extract" in data:
                extracted = data["extract"]
                if isinstance(extracted, dict):
                    formatted_item.update(extracted)
                else:
                    formatted_item["extracted_data"] = str(extracted)
            
            return FeatureResult(
                success=True,
                data=[formatted_item],
                metadata={
                    'formats_used': formats,
                    'fields_extracted': list(formatted_item.keys())
                }
            )
        except Exception as e:
            return FeatureResult(success=False, error=str(e))
    
    async def execute(self, config: Dict[str, Any]) -> FeatureResult:
        """Execute scraping on multiple URLs"""
        try:
            is_valid, error = self.validate(config)
            if not is_valid:
                return FeatureResult(success=False, error=error)
            
            urls = config.get('urls', [])
            formats = config.get('formats', ['markdown'])
            extract_prompt = config.get('extract_prompt')
            
            results = []
            failed = 0
            
            for url in urls:
                try:
                    result = await self._call_firecrawl_scrape(url, formats, extract_prompt)
                    data = result.get('data', {})
                    
                    item = {"url": url, "status": "success"}
                    if "markdown" in formats: item["markdown"] = data.get("markdown")
                    if "html" in formats: item["html"] = data.get("html")
                    if "screenshot" in formats: item["screenshot_url"] = data.get("screenshot")
                    if "extract" in formats and "extract" in data:
                        extracted = data["extract"]
                        if isinstance(extracted, dict):
                            item.update(extracted)
                        else:
                            item["extracted_data"] = str(extracted)
                            
                    results.append(item)
                except Exception as e:
                    failed += 1
                    results.append({"url": url, "status": "error", "error_message": str(e)})
            
            return FeatureResult(
                success=True,
                data=results,
                metadata={
                    'total_urls': len(urls),
                    'successful': len(results) - failed,
                    'failed': failed,
                    'formats_used': formats
                }
            )
        except Exception as e:
            return FeatureResult(success=False, error=str(e))
    
    def validate(self, config: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        """Validate scraping configuration"""
        if 'url' not in config and 'urls' not in config:
            return False, "At least one URL is required"
            
        formats = config.get('formats', [])
        if not formats:
            return False, "At least one format must be selected (markdown, html, screenshot, extract)"
            
        if "extract" in formats and not config.get("extract_prompt"):
            return False, "Extraction prompt is required when 'extract' format is selected"
        
        return True, None
    
    @classmethod
    def get_available_formats(cls) -> List[Dict[str, Any]]:
        """Get list of available scraping formats"""
        return [
            {
                "id": "markdown",
                "name": "Markdown",
                "description": "Clean, readable markdown text extracted from the page."
            },
            {
                "id": "html",
                "name": "HTML",
                "description": "Full HTML content of the page."
            },
            {
                "id": "screenshot",
                "name": "Screenshot",
                "description": "A full-page screenshot image URL."
            },
            {
                "id": "extract",
                "name": "AI Extraction",
                "description": "Extract structured data using an AI prompt (JSON format)."
            }
        ]

