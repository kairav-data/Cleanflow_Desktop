import os
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException

from pydantic import BaseModel
from huggingface_hub import InferenceClient

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
        system_prompt = "You are a helpful, friendly website assistant. Keep responses concise and professional. Use markdown for formatting when appropriate."
        
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
            max_tokens=500,
            temperature=0.7,
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
