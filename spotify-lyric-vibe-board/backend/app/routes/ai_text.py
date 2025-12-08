# backend/api/ai_text.py

import os
import json
from typing import List, Optional
from fastapi import APIRouter, HTTPException
# 💡 We need BaseModel for all request/response models
from pydantic import BaseModel, Field
from openai import OpenAI
from app.routes.ai_image import _build_prompt, _generate_image_data_url # 💡 NEW: Import image helpers
from app.routes.ai_image import GenerateImageRequest
from app.routes.ai_client import get_openai_client

router = APIRouter(prefix="/api")


# --- Pydantic Models for REQUEST (Input from Frontend) ---

class LyricLine(BaseModel):
    id: int
    text: str

class LyricBatch(BaseModel):
    lines: List[LyricLine]
    targetLanguage: str = "English" 

@router.post("/analyze-lyrics")
def analyze_lyrics(request: LyricBatch):
    """
    Takes the FULL song lyrics.
    Returns: A list of analyzed objects (Translation + Vibe) for every line.
    """
    try:
        # --- HARDCODED ENGLISH FORCE ---
        # We ignore request.targetLanguage and force English
        forced_language = "English"

        prompt = f"""
        I have a list of song lyric lines.
        Target Language: {forced_language} (STRICTLY ENFORCE THIS)
        
        For EACH line in the input:
        1. "translated": Translate the text to {forced_language}. If it is already in English, return it exactly as is.
        2. "vibe": A short mood keyword (e.g. 'Sad', 'Energetic', 'Romantic')
        3. "color": A hex color code that matches the mood.

        Input Data: {json.dumps([line.dict() for line in request.lines])}

        Return ONLY a JSON object with a single key "results" containing a list of objects.
        The list MUST be in the exact same order as the input.
        
        Format:
        {{
            "results": [
                {{ "id": 0, "translated": "...", "vibe": "...", "color": "#..." }},
                {{ "id": 1, "translated": "...", "vibe": "...", "color": "#..." }}
            ]
        }}
        """

        response = client.chat.completions.create(
            model="gpt-4o", 
            # ... (messages and response_format) ...
        )
        
        ai_content = json.loads(response.choices[0].message.content)
        return ai_content

    except Exception as e:
        print("\n!!!!!!!!!!!!!! AI ERROR !!!!!!!!!!!!!!")
        print(f"ERROR TYPE: {type(e).__name__}")
        print(f"ERROR MESSAGE: {str(e)}")
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n")
        
        return {"results": []}