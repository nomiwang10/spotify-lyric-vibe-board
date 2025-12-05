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
        # We process 20 lines at a time to prevent AI timeouts if the song is huge
        # But for simplicity, let's try sending the whole batch first.
        
        prompt = f"""
        I have a list of song lyric lines.
        Target Language: {request.targetLanguage}
        
        For EACH line in the input, provide:
        1. Translated text
        2. A short 'vibe' keyword (e.g. 'Sad', 'Energetic')
        3. A hex color code that matches that specific line.

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
        # --- THIS IS THE IMPORTANT PART ---
        print("\n!!!!!!!!!!!!!! AI ERROR !!!!!!!!!!!!!!")
        print(f"ERROR TYPE: {type(e).__name__}")
        print(f"ERROR MESSAGE: {str(e)}")
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n")
        
        # Return empty list so frontend doesn't crash, but log the error above
        return {"results": []}