import os
import json
from typing import List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api")
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

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
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        
        ai_content = json.loads(response.choices[0].message.content)
        return ai_content

    except Exception as e:
        print("\n!!!!!!!!!!!!!! AI ERROR !!!!!!!!!!!!!!")
        print(f"ERROR TYPE: {type(e).__name__}")
        print(f"ERROR MESSAGE: {str(e)}")
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n")
        
        return {"results": []}