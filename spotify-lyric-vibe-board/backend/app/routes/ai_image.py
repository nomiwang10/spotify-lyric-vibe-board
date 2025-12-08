from __future__ import annotations

import os
import base64
from io import BytesIO
from PIL import Image
import textwrap
from typing import List, Optional
from app.routes.ai_client import get_openai_client

from fastapi import APIRouter, HTTPException, status
from openai import OpenAI
from pydantic import BaseModel, Field, validator


#client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# This router is registered in app/main.py
# as: app.include_router(ai_image.router)
router = APIRouter(prefix="/api/ai-image", tags=["ai-image"])


class GenerateImageRequest(BaseModel):
    lyric_lines: List[str] = Field(
        ...,
        description="Lyric lines that capture the vibe",
    )
    emotion: Optional[str] = Field(
        None,
        description="Primary emotion inferred from the current lyric section",
    )
    themes: Optional[List[str]] = Field(
        None,
        description="List of themes extracted from the lyrics",
    )
    style: Optional[str] = Field(
        None,
        description=(
            "Optional style direction (e.g., 'watercolor', 'cyberpunk', 'vintage film'). "
            "If not provided, a mixed collage vibe-board style is used."
        ),
    )

    @validator("lyric_lines")
    def lyric_lines_must_not_be_empty(cls, value: List[str]) -> List[str]:  # noqa: N805
        cleaned = [line.strip() for line in value if line.strip()]
        if not cleaned:
            raise ValueError("At least one non-empty lyric line is required")
        return cleaned


class GenerateImageResponse(BaseModel):
    prompt: str
    image_data_url: str


def _build_prompt(payload: GenerateImageRequest) -> str:
    """
    Build a concise text prompt from the lyric context suitable for
    a *mixed aesthetic collage vibe board* (option C).
    """
    lyric_section = " / ".join(payload.lyric_lines)

    # Default style if user doesn't specify one
    base_style = (
        "a mixed aesthetic collage vibe board, combining stylized illustrations, "
        "abstract textures, soft lighting, and layered typography"
    )
    style = payload.style or base_style

    themes_text = ", ".join(payload.themes) if payload.themes else ""
    emotion_text = payload.emotion or ""

    # Natural-language prompt for the image model
    prompt = f"""
    Create {base_style}.
    The collage should visually express these song lyrics: "{lyric_section}".

    Overall emotion: {emotion_text or "use the emotional tone inferred from the lyrics"}.
    Important themes: {themes_text or "infer key themes from the lyrics"}.

    Design details:
    - Use harmonious colors that match the mood.
    - Include subtle text snippets or handwritten-style words inspired by key lyrics.
    - Blend abstract shapes, light leaks, and textures for depth.
    - Keep the design clean enough to work as a modern digital vibe board.
    Style: {style}.
    """

    # Keep it to a reasonable length for the API
    prompt = textwrap.dedent(prompt).strip()
    return textwrap.shorten(prompt, width=800, placeholder=" …")


def _generate_image_data_url(prompt: str) -> str:
    """
    Generate large image first, then compress + downscale to a small JPEG.
    """
    try:
        client = get_openai_client()
        response = client.images.generate(
            model="gpt-image-1",
            prompt=prompt,
            size="auto"  # Let model choose, then we compress ourselves
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

    # Decode original PNG
    png_b64 = response.data[0].b64_json
    png_bytes = base64.b64decode(png_b64)

    # Open with Pillow
    img = Image.open(BytesIO(png_bytes)).convert("RGB")

    # Resize smaller for frontend performance
    max_dim = 512  # Target resolution — tweakable
    img.thumbnail((max_dim, max_dim), Image.LANCZOS)

    # Convert to tiny JPEG
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=65, optimize=True)
    jpeg_bytes = buf.getvalue()

    # Convert back to base64
    jpeg_b64 = base64.b64encode(jpeg_bytes).decode("utf-8")
    return f"data:image/jpeg;base64,{jpeg_b64}"






@router.post(
    "/generate-image",
    response_model=GenerateImageResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate a vibe board image for the current lyrics",
)
def generate_image(payload: GenerateImageRequest) -> GenerateImageResponse:
    """
    Real AI image endpoint.

    Takes lyric context (lines, emotion, themes, style), builds a collage-style
    vibe-board prompt, and calls OpenAI's image generation API. Returns:

    - `prompt`: the exact text sent to the image model
    - `image_data_url`: a `data:image/png;base64,...` URL that the frontend can display
    """
    prompt = _build_prompt(payload)
    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to build prompt from provided lyric context.",
        )

    data_url = _generate_image_data_url(prompt)
    return GenerateImageResponse(prompt=prompt, image_data_url=data_url)
