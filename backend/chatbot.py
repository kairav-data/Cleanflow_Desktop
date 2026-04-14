import os
import re
import logging
from collections import Counter
from functools import lru_cache
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, HTTPException

from pydantic import BaseModel
from huggingface_hub import InferenceClient

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

GUIDE_PATH = Path(__file__).resolve().parent.parent / "CLEANFLOW_FEATURE_GUIDE.md"
STOPWORDS = {
    "about", "after", "all", "also", "and", "any", "are", "back", "because",
    "been", "before", "being", "between", "both", "build", "builder", "can",
    "could", "data", "does", "each", "for", "from", "have", "help", "here",
    "into", "its", "just", "like", "more", "most", "much", "need", "not",
    "now", "off", "one", "only", "our", "out", "over", "same", "show",
    "some", "that", "the", "their", "them", "then", "there", "these", "this",
    "through", "tool", "tools", "using", "very", "want", "what", "when",
    "where", "which", "with", "workflow", "workflows", "you", "your",
}

# Get HF API Key
# Try standard env vars for the API key in both prefixed and standard forms
HF_API_KEY = os.getenv("HF_API_KEY") or os.getenv("VITE_HF_API_KEY")

if not HF_API_KEY:
    logger.warning("HF_API_KEY not found in environment variables. Inference will fail.")

# Initialize the Hugging Face Inference Client
try:
    client = InferenceClient(api_key=HF_API_KEY)
except Exception as e:
    logger.error(f"Failed to initialize InferenceClient: {e}")
    client = None


# Initialize APIRouter
chat_router = APIRouter()

# Request Models
class Message(BaseModel):
    role: str
    content: str
    id: Optional[str] = None

class ChatRequest(BaseModel):
    messages: List[Message]
    model: str = "Qwen/Qwen2.5-72B-Instruct"


def _tokenize(text: str) -> List[str]:
    return [
        token
        for token in re.findall(r"[a-z0-9_]+", (text or "").lower())
        if len(token) > 2 and token not in STOPWORDS
    ]


def _split_markdown_sections(markdown: str) -> List[dict]:
    sections: List[dict] = []
    current = {"heading": "Overview", "level": 1, "content": []}

    for line in markdown.splitlines():
        if line.startswith("#"):
            if current["content"]:
                sections.append(
                    {
                        "heading": current["heading"],
                        "level": current["level"],
                        "content": "\n".join(current["content"]).strip(),
                    }
                )
            level = len(line) - len(line.lstrip("#"))
            current = {"heading": line[level:].strip(), "level": level, "content": []}
            continue

        current["content"].append(line)

    if current["content"]:
        sections.append(
            {
                "heading": current["heading"],
                "level": current["level"],
                "content": "\n".join(current["content"]).strip(),
            }
        )

    enriched_sections: List[dict] = []
    for section in sections:
        heading_tokens = _tokenize(section["heading"])
        content_tokens = _tokenize(section["content"])
        enriched_sections.append(
            {
                **section,
                "heading_tokens": heading_tokens,
                "token_counts": Counter(content_tokens + heading_tokens + heading_tokens),
            }
        )

    return enriched_sections


@lru_cache(maxsize=1)
def _load_feature_guide_sections() -> List[dict]:
    if not GUIDE_PATH.exists():
        logger.warning("Feature guide not found at %s", GUIDE_PATH)
        return []

    try:
        markdown = GUIDE_PATH.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        markdown = GUIDE_PATH.read_text(encoding="utf-8", errors="ignore")

    return _split_markdown_sections(markdown)


def _build_guide_context(messages: List[Message], max_sections: int = 4, max_chars: int = 6000) -> str:
    sections = _load_feature_guide_sections()
    if not sections:
        return ""

    user_queries = [msg.content for msg in messages if msg.role == "user" and msg.content.strip()]
    query_text = "\n".join(user_queries[-3:]).strip()
    query_tokens = Counter(_tokenize(query_text))

    scored_sections = []
    for index, section in enumerate(sections):
        score = 0
        if query_tokens:
            overlap = set(query_tokens) & set(section["token_counts"])
            score += sum(query_tokens[token] * section["token_counts"][token] for token in overlap)
            score += 3 * sum(query_tokens[token] for token in set(query_tokens) & set(section["heading_tokens"]))
            if section["heading"].lower() in query_text.lower():
                score += 8
        else:
            score = max(0, 10 - index)

        if section["heading"].lower() == "overview":
            score += 2

        scored_sections.append((score, index, section))

    scored_sections.sort(key=lambda item: (-item[0], item[1]))

    selected = []
    selected_headings = set()
    for _, _, section in scored_sections:
        if section["heading"] in selected_headings:
            continue
        selected.append(section)
        selected_headings.add(section["heading"])
        if len(selected) >= max_sections:
            break

    if not any(section["heading"].lower() == "overview" for section in selected):
        overview = next((section for section in sections if section["heading"].lower() == "overview"), None)
        if overview:
            selected.insert(0, overview)

    context_blocks: List[str] = []
    total_chars = 0
    for section in selected:
        block = f"## {section['heading']}\n{section['content']}".strip()
        if total_chars + len(block) > max_chars and context_blocks:
            break
        context_blocks.append(block)
        total_chars += len(block)

    return "\n\n".join(context_blocks)


def _build_system_prompt(messages: List[Message]) -> str:
    guide_context = _build_guide_context(messages)

    instructions = [
        "You are Gwen, the Cleanflow product assistant.",
        "Answer questions specifically about the Cleanflow application, its features, workflows, and current product scope.",
        "Use the provided Cleanflow feature guide context as your source of truth and do not invent features, endpoints, or completed functionality that are not described there.",
        "If a feature is partial, browser-managed, demo-only, or still in progress, say that clearly.",
        "If the user asks how to do something in Cleanflow, give practical step-by-step guidance using the relevant module names.",
        "If the answer is not fully covered by the guide, say what is confirmed versus what is uncertain.",
        "Keep responses helpful, concise, and product-focused.",
    ]

    if guide_context:
        instructions.append("Cleanflow feature guide context:\n" + guide_context)

    return "\n\n".join(instructions)

# API Endpoints
@chat_router.get("/api/health")
async def health_check():
    """Simple health check endpoint."""
    return {"status": "ok", "message": "Backend is running"}

@chat_router.post("/api/chat")
async def chat_completion(request: ChatRequest):
    """
    Handle chat completions by forwarding to Hugging Face Inference API.
    """
    if not client:
        raise HTTPException(status_code=500, detail="Hugging Face client is not initialized.")
    
    try:
        # Build messages for the API
        system_prompt = _build_system_prompt(request.messages)

        # Format conversation history
        api_messages = [{"role": "system", "content": system_prompt}]
        
        for msg in request.messages:
            # Hugging Face Chat API expects roles: 'system', 'user', or 'assistant'
            role = "assistant" if msg.role == "bot" else "user"
            content = msg.content.strip()
            
            if content: # don't send empty messages 
                api_messages.append({"role": role, "content": content})

        logger.info(f"Sending request to {request.model} with {len(api_messages)} messages.")

        # Let the inference client handle the chat flow
        response = client.chat_completion(
            model=request.model,
            messages=api_messages,
            max_tokens=700,
            temperature=0.4,
        )

        assistant_message = response.choices[0].message.content
        return {"response": assistant_message}

    except Exception as e:
        logger.error(f"Error during chat completion: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate response: {str(e)}")

# Add a simple root route for convenience
@chat_router.get("/")
def read_root():
    return {"message": "Welcome to Lumina AI Chat Router"}
