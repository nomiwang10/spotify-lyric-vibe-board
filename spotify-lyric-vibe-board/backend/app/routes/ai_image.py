from __future__ import annotations

import os
import base64
from io import BytesIO
from PIL import Image
import textwrap
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, status
from openai import OpenAI
from pydantic import BaseModel, Field, validator

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

router = APIRouter(prefix="/api/ai-image", tags=["ai-image"])


class GenerateImageRequest(BaseModel):
    lyric_lines: List[str] = Field(..., description="Lyric lines")
    emotion: Optional[str] = Field(None, description="Primary emotion from the frontend analysis")
    themes: Optional[List[str]] = Field(None, description="List of themes")
    style: Optional[str] = Field(None, description="Optional style direction")

    @validator("lyric_lines")
    def lyric_lines_must_not_be_empty(cls, value: List[str]) -> List[str]:
        cleaned = [line.strip() for line in value if line.strip()]
        if not cleaned:
            raise ValueError("At least one non-empty lyric line is required")
        return cleaned


class GenerateImageResponse(BaseModel):
    prompt: str
    image_data_url: str


def _build_smart_prompt(payload: GenerateImageRequest) -> str:
    """
    STEP 1: ASK CHATGPT TO DESCRIBE THE IMAGE.
    Instead of just pasting lyrics, we ask GPT-4o-mini to visualize them.
    """
    lyrics_text = " / ".join(payload.lyric_lines)
    vibe = payload.emotion or "abstract"
    
    # This is the "Brain" of the image generator
    gpt_prompt = f"""
    I need a prompt for an AI Image Generator (DALL-E).
    
    Context:
    - Song Lyrics: "{lyrics_text}"
    - Vibe/Mood: {vibe}
    - Goal: Create an abstract, artistic background image. NO TEXT.
    
    Task:
    Write a short, vivid, visual description of an image that captures this feeling. 
    Focus on colors, lighting, and textures. 
    Do not mention specific people or detailed scenes. Keep it abstract and dreamy.
    Max 40 words.
    """

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": gpt_prompt}],
            max_tokens=60
        )
        smart_prompt = completion.choices[0].message.content.strip()
        print(f"[ai-image] Smart Prompt generated: {smart_prompt}")
        return smart_prompt
    except Exception as e:
        print(f"[ai-image] GPT Prompting Error: {e}")
        # Fallback if GPT fails
        return f"Abstract art representing {vibe}, colorful, dreamy, digital art"


def _generate_image_data_url(prompt: str) -> str:
    """
    STEP 2: ASK DALL-E TO DRAW IT.
    """
    try:
        # Use DALL-E 2 for speed and cost, 512x512 for the grid
        response = client.images.generate(
            model="dall-e-2",
            prompt=prompt,
            n=1,
            size="512x512",
            response_format="b64_json"
        )
    except Exception as e:
        print(f"[ai-image] DALL-E Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OpenAI image error: {str(e)}",
        )

    if not response.data:
        raise HTTPException(status_code=502, detail="Empty response from OpenAI")

    # Get the raw base64 string
    png_b64 = response.data[0].b64_json
    
    # Compress to JPEG
    try:
        png_bytes = base64.b64decode(png_b64)
        img = Image.open(BytesIO(png_bytes)).convert("RGB")
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=70, optimize=True)
        jpeg_bytes = buf.getvalue()
        jpeg_b64 = base64.b64encode(jpeg_bytes).decode("utf-8")
        return f"data:image/jpeg;base64,{jpeg_b64}"
    except Exception as e:
         print(f"[ai-image] Compression Error: {e}")
         return f"data:image/png;base64,{png_b64}"


@router.post("/generate-image", response_model=GenerateImageResponse)
def generate_image(payload: GenerateImageRequest) -> GenerateImageResponse:
    # 1. Get the smart description from GPT
    smart_prompt = _build_smart_prompt(payload)
    
    # 2. Generate the image from DALL-E
    data_url = _generate_image_data_url(smart_prompt)
    
    return GenerateImageResponse(prompt=smart_prompt, image_data_url=data_url)