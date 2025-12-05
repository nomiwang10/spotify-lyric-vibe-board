from __future__ import annotations

import os
import base64
from io import BytesIO
from typing import List

from PIL import Image
import textwrap

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, status
from openai import OpenAI
from pydantic import BaseModel, Field, validator

# Load environment variables (same pattern as ai_text.py)
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# This router is registered in app/main.py
# as: app.include_router(ai_image.router)
router = APIRouter(prefix="/api/ai-image", tags=["ai-image"])


# -------------------------------------------------------------------
# Request / Response Models
# -------------------------------------------------------------------


class GenerateImageRequest(BaseModel):
    """
    Input shape is designed to match the output from /api/analyze-lyrics
    so the frontend can pass it directly.
    """
    translation: str = Field(
        ...,
        description="Translated lyric line(s) from /api/analyze-lyrics",
    )
    vibe_keywords: str = Field(
        ...,
        description="Comma-separated vibe keywords (e.g., 'reflective, contemplative')",
    )
    colors: List[str] = Field(
        ...,
        description="Hex color codes suggested by /api/analyze-lyrics",
        min_items=1,
    )

    @validator("translation")
    def translation_must_not_be_empty(cls, value: str) -> str:  # noqa: N805
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("translation must not be empty")
        return cleaned

    @validator("colors")
    def colors_must_not_be_empty(cls, value: List[str]) -> List[str]:  # noqa: N805
        cleaned = [c.strip() for c in value if c.strip()]
        if not cleaned:
            raise ValueError("At least one color is required")
        return cleaned


class GenerateImageResponse(BaseModel):
    prompt: str
    image_data_url: str


# -------------------------------------------------------------------
# Helper functions
# -------------------------------------------------------------------


def _build_prompt(payload: GenerateImageRequest) -> str:
    """
    Build a concise text prompt from the ai-text output suitable for
    a mixed aesthetic collage vibe board, with strict SFW constraints.
    """
    lyric_text = payload.translation

    # Split "reflective, contemplative" -> ["reflective", "contemplative"]
    keywords = [k.strip() for k in payload.vibe_keywords.split(",") if k.strip()]
    emotion = keywords[0] if keywords else ""
    themes_text = ", ".join(keywords) if keywords else "infer key themes from the lyrics and vibe"

    color_palette = ", ".join(payload.colors)

    safety_clause = (
        "The artwork MUST be completely safe for work: "
        "no nudity or partial nudity, no sexual content, no fetish content, "
        "no graphic violence or gore, no depiction of self-harm or suicide, "
        "no illegal activity, no drugs or alcohol focus, and no hateful or extremist symbols."
    )

    prompt = f"""
    Create a mixed aesthetic collage vibe board, combining stylized illustrations,
    abstract textures, soft lighting, and layered typography.

    Song meaning / translation:
    "{lyric_text}"

    Dominant emotion / vibe: {emotion or "use the emotional tone suggested by the vibe keywords"}.
    Themes: {themes_text}.
    Color palette: {color_palette}.

    {safety_clause}

    Design details:
    - Use the provided colors prominently to reflect the mood.
    - Include subtle text snippets or handwritten-style words inspired by key lyrics.
    - Blend abstract shapes, light leaks, and textures for depth.
    - Keep the design clean enough to work as a modern digital vibe board.
    """

    prompt = textwrap.dedent(prompt).strip()
    return textwrap.shorten(prompt, width=800, placeholder=" …")



def _generate_image_data_url(prompt: str) -> str:
    """
    Call OpenAI's image generation API, then compress + downscale
    the image to a small JPEG for faster loading in the frontend.
    """
    try:
        response = client.images.generate(
            model="gpt-image-1",
            prompt=prompt,
            size="auto",  # Let the model pick, we compress afterwards
        )
    except Exception as e:
        print(f"[ai-image] OpenAI image generation error: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OpenAI image error: {type(e).__name__}: {e}",
        )

    if not response.data or not response.data[0].b64_json:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI image service returned an empty result.",
        )

    # Decode original PNG from OpenAI
    png_b64 = response.data[0].b64_json
    png_bytes = base64.b64decode(png_b64)

    # Open with Pillow and convert to RGB
    img = Image.open(BytesIO(png_bytes)).convert("RGB")

    # Resize smaller for frontend performance
    max_dim = 512  # tweakable (both width & height max)
    img.thumbnail((max_dim, max_dim), Image.LANCZOS)

    # Save as compressed JPEG in memory
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=65, optimize=True)
    jpeg_bytes = buf.getvalue()

    # Convert back to base64 data URL
    jpeg_b64 = base64.b64encode(jpeg_bytes).decode("utf-8")
    return f"data:image/jpeg;base64,{jpeg_b64}"


# -------------------------------------------------------------------
# Route
# -------------------------------------------------------------------


@router.post(
    "/generate-image",
    response_model=GenerateImageResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate a vibe board image for the current lyrics",
)
def generate_image(payload: GenerateImageRequest) -> GenerateImageResponse:
    """
    Real AI image endpoint.

    Expects the JSON produced by /api/analyze-lyrics:
    {
      "translation": "...",
      "vibe_keywords": "kw1, kw2",
      "colors": ["#Hex1", "#Hex2"]
    }

    Returns:
    - prompt: the exact text sent to the image model
    - image_data_url: a data:image/jpeg;base64,... URL that the frontend can display
    """
    prompt = _build_prompt(payload)
    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to build prompt from provided lyric context.",
        )

    data_url = _generate_image_data_url(prompt)
    return GenerateImageResponse(prompt=prompt, image_data_url=data_url)

