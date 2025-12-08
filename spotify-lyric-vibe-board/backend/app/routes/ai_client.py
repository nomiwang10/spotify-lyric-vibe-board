# backend/app/routes/ai_client.py

import os
from openai import OpenAI
from openai import OpenAIError
from fastapi import HTTPException, status

# 🛑 DO NOT INSTANTIATE THE CLIENT AT THE TOP LEVEL YET

def get_openai_client() -> OpenAI:
    """Safely retrieves or instantiates the OpenAI client."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OPENAI_API_KEY is not set in the environment."
        )
    
    # Initialize the client ONLY when this function is called
    try:
        return OpenAI(api_key=api_key)
    except OpenAIError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize OpenAI client: {e}"
        )