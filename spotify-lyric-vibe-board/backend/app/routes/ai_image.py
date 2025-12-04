from __future__ import annotations

import base64
import textwrap
from typing import List, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, validator

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
        description="Optional style direction (e.g., 'watercolor', 'cyberpunk', 'vintage film')",
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
    """Build a concise text prompt from the lyric context."""
    lyric_section = " / ".join(payload.lyric_lines)

    parts = [
        f"Lyrics: {lyric_section}",
        f"Emotion: {payload.emotion}" if payload.emotion else None,
        f"Themes: {', '.join(payload.themes)}" if payload.themes else None,
        f"Style: {payload.style}" if payload.style else None,
    ]

    joined = ", ".join(p for p in parts if p)
    # Keep the prompt a manageable length
    return textwrap.shorten(joined, width=300, placeholder=" …")


def _encode_placeholder_image(prompt: str) -> str:
    """Encode the prompt as a fake 'image' data URL (placeholder)."""
    encoded_prompt = base64.b64encode(prompt.encode("utf-8")).decode("utf-8")
    # Frontend can treat this as a data URL for now
    return f"data:text/plain;base64,{encoded_prompt}"


@router.post(
    "/generate-image",
    response_model=GenerateImageResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate a vibe board image for the current lyrics",
)
def generate_image(payload: GenerateImageRequest) -> GenerateImageResponse:
    """
    Placeholder AI image endpoint.

    Simulates image generation by returning a base64-encoded data URL derived from
    the prompt. This can later be swapped out for a real image-generation API.
    """
    prompt = _build_prompt(payload)
    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to build prompt from provided lyric context.",
        )

    data_url = _encode_placeholder_image(prompt)
    return GenerateImageResponse(prompt=prompt, image_data_url=data_url)
