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
    timestamp_ms: int 
    text: str

class LyricBatch(BaseModel):
    lines: List[LyricLine]
    # --- CHANGE 1: Renamed to match Frontend camelCase ---
    targetLanguage: str = "English" 

@router.post("/analyze-lyrics")
def analyze_lyrics(request: LyricBatch):
    """
    Takes a LIST of lyric lines with timestamps.
    Returns: Translated lines (preserves time) + Vibe + Colors.
    """
    try:
        # Convert list of objects to a clean string format for the AI
        input_data = [
            {"time": line.timestamp_ms, "text": line.text} 
            for line in request.lines
        ]

        prompt = f"""
        I have a list of song lyrics with timestamps (in milliseconds). 
        
        # --- CHANGE 2: Updated variable reference ---
        Task 1: Translate the text of each line into {request.targetLanguage}.
        Task 2: Analyze the overall emotional 'vibe' of this section.
        Task 3: Pick 2 hex color codes that match this vibe.

        Input Data: {json.dumps(input_data)}

        Return ONLY a JSON object in this format:
        {{
            "translated_lines": [
                {{"time": 1234, "text": "translated text here"}}
            ],
            "vibe_keywords": ["keyword1", "keyword2"],
            "colors": ["#Hex1", "#Hex2"]
        }}
        """

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        
        # Parse the result
        ai_content = json.loads(response.choices[0].message.content)
        
        return ai_content

    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=f"AI processing failed: {e}")