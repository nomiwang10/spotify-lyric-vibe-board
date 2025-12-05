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
    print(f"--- STARTED AI ANALYSIS ---")
    print(f"Received {len(request.lines)} lines to analyze.")

    try:
        # 1. Truncate to save money/time (First 15 lines only)
        truncated_lines = request.lines[:15] 
        input_data = [line.dict() for line in truncated_lines]
        
        # 2. Convert to string safely
        json_input = json.dumps(input_data)

        prompt = f"""
        I have a list of song lyric lines.
        Target Language: {request.targetLanguage}
        
        For EACH line, provide:
        1. Translated text
        2. A short 'vibe' keyword
        3. A hex color code.

        Input Data:
        {json_input}

        Return ONLY a JSON object with a key "results" containing the list.
        """

        print("Sending request to OpenAI...")
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        
        raw_content = response.choices[0].message.content
        print(f"OpenAI Responded! Length: {len(raw_content)}")
        
        parsed = json.loads(raw_content)
        return parsed

    except Exception as e:
        # --- THIS IS THE IMPORTANT PART ---
        print("\n!!!!!!!!!!!!!! AI ERROR !!!!!!!!!!!!!!")
        print(f"ERROR TYPE: {type(e).__name__}")
        print(f"ERROR MESSAGE: {str(e)}")
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n")
        
        # Return empty list so frontend doesn't crash, but log the error above
        return {"results": []}