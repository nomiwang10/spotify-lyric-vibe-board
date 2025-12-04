import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables (API Keys)
load_dotenv()

router = APIRouter(prefix="/api")
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class LyricChunk(BaseModel):
    text: str
    target_language: str = "English"
    

@router.post("/analyze-lyrics")
def analyze_lyrics(request: LyricChunk):
    """
    Real AI Endpoint: Takes lyrics, translates them, and extracts vibe.
    """
    try:
        # We give the AI a strict persona so it returns exactly what we want
        prompt = f"""
        Translate the following song lyrics into {request.target_language}.
        Then, identify the emotional 'vibe' of these lyrics (e.g., sad, energetic, romantic).
        Finally, suggest 2 hex color codes that match this vibe.
        
        Lyrics: "{request.text}"
        
        Return ONLY a JSON format like this:
        {{
            "translation": "translated text here",
            "vibe_keywords": "keyword1, keyword2",
            "colors": ["#Hex1", "#Hex2"]
        }}
        """

        response = client.chat.completions.create(
            model="gpt-4o-mini", # or gpt-3.5-turbo (cheaper)
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"} # Ensures valid JSON back
        )
        
        # Parse the string answer into a real Python Dictionary
        import json
        ai_content = json.loads(response.choices[0].message.content)
        
        return ai_content

    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail="AI processing failed")