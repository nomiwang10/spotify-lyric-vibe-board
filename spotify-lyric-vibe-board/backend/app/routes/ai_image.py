from __future__ import annotations

import os
import base64
import textwrap
from io import BytesIO
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, status
from openai import OpenAI, BadRequestError
from pydantic import BaseModel, Field, validator
from PIL import Image

# Load environment variables (same pattern as ai_text.py)
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# This router is registered in app/main.py
# as: app.include_router(ai_image.router)
router = APIRouter(prefix="/api/ai-image", tags=["ai-image"])


# ---------- Pydantic Models ----------

class GenerateImageRequest(BaseModel):
    """
    Input shape is designed to match the output of ai_text.py.
    Example:
    {
        "translation": "I don't want to do anything",
        "vibe_keywords": "apathetic, tired",
        "colors": ["#A9A9A9", "#696969"]
    }
    """
    translation: str = Field(
        ...,
        description="Translated lyric text or short summary of the current section.",
    )
    vibe_keywords: Optional[str] = Field(
        None,
        description="Comma-separated emotional vibe keywords (e.g. 'sad, nostalgic').",
    )
    colors: Optional[List[str]] = Field(
        None,
        description="List of hex color strings chosen for this section.",
    )

    @validator("translation")
    def translation_not_empty(cls, value: str) -> str:  # noqa: N805
        if not value.strip():
            raise ValueError("translation must not be empty.")
        return value.strip()

    @validator("colors", always=True)
    def normalize_colors(cls, value: Optional[List[str]]) -> Optional[List[str]]:  # noqa: N805
        if not value:
            return None
        cleaned: List[str] = []
        for c in value:
            c = c.strip()
            if not c:
                continue
            if not c.startswith("#"):
                c = "#" + c
            cleaned.append(c)
        return cleaned or None


class GenerateImageResponse(BaseModel):
    prompt: str
    image_data_url: str


# ---------- Prompt Building & Safety ----------

def _build_safe_vibe_text(vibe_keywords: Optional[str]) -> str:
    """
    Map potentially problematic emotional words to safe artistic moods,
    so we don't trip the safety system as easily.
    """
    unsafe_to_safe = {
        "depressed": "soft nostalgic calm",
        "sad": "gentle melancholy pastel",
        "angry": "bold graphic dramatic",
        "furious": "bold graphic dramatic",
        "apathetic": "muted quiet minimalist",
        "tired": "dreamy evening low-contrast",
        "anxious": "soft soothing harmony",
        "lonely": "warm reflective cinematic",
        "horny": "romantic abstract glow",
        "sexy": "romantic abstract glow",
        "violent": "intense abstract motion",
    }

    if not vibe_keywords:
        return "calm emotional atmosphere"

    safe_vibes: List[str] = []
    for raw in vibe_keywords.split(","):
        k = raw.strip()
        if not k:
            continue
        lower = k.lower()
        safe_vibes.append(unsafe_to_safe.get(lower, k))

    return ", ".join(safe_vibes) if safe_vibes else "calm emotional atmosphere"


def _build_prompt(payload: GenerateImageRequest) -> str:
    """
    Build a concise, *safe* text prompt from the lyric context,
    suitable for a mixed aesthetic collage vibe board.
    """
    vibe_text = _build_safe_vibe_text(payload.vibe_keywords)
    colors_text = ", ".join(payload.colors) if payload.colors else "soft harmonious colors"

    prompt = f"""
    Create a PG-rated, safe-for-all-ages abstract collage vibe board.
    Do not depict realistic people, faces, bodies, weapons, drugs, or any explicit or suggestive content.
    Focus only on shapes, light, color, and subtle symbolic elements.

    It should be inspired by the feeling of this lyric meaning: "{payload.translation}".

    Mood: {vibe_text}.
    Color palette: {colors_text}.

    Design guidelines:
    - Use abstract, non-figurative shapes and soft textures.
    - No text, logos, or readable words.
    - No graphic or disturbing imagery.
    - The final result should feel like a modern digital poster or wallpaper that reflects the song's vibe.
    """

    prompt = textwrap.dedent(prompt).strip()
    return textwrap.shorten(prompt, width=800, placeholder=" …")


# ---------- Low-level Image Helpers ----------

def _call_image_api(prompt: str) -> str:
    """
    Call OpenAI's image API with the given prompt and return the base64 PNG string.
    """
    response = client.images.generate(
        model="gpt-image-1",
        prompt=prompt,
        size="auto",  # let the model pick; we'll compress ourselves
    )

    if not response.data or not getattr(response.data[0], "b64_json", None):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI image service returned an empty result.",
        )

    return response.data[0].b64_json


def _compress_b64_png_to_small_jpeg(png_b64: str) -> str:
    """
    Take a base64 PNG, downscale + compress to a smaller JPEG,
    and return a data URL (data:image/jpeg;base64,...).
    """
    png_bytes = base64.b64decode(png_b64)
    img = Image.open(BytesIO(png_bytes)).convert("RGB")

    # Resize smaller for frontend performance
    max_dim = 512
    img.thumbnail((max_dim, max_dim), Image.LANCZOS)

    buf = BytesIO()
    img.save(buf, format="JPEG", quality=65, optimize=True)
    jpeg_bytes = buf.getvalue()

    jpeg_b64 = base64.b64encode(jpeg_bytes).decode("utf-8")
    return f"data:image/jpeg;base64,{jpeg_b64}"


def _generate_image_data_url(prompt: str) -> str:
    """
    Generate an image data URL from a prompt, with a safety-aware fallback:
      - If the main prompt is blocked by moderation, retry once with
        a generic, super-safe abstract art prompt.
    """
    try:
        png_b64 = _call_image_api(prompt)
    except BadRequestError as e:
        msg = str(e)

        # If OpenAI's safety system blocks the request,
        # fall back to a very safe, abstract prompt.
        if "moderation_blocked" in msg or "safety_violations" in msg:
            print("[ai-image] Prompt blocked by safety system, falling back to generic safe prompt.")

            safe_prompt = (
                "Create a PG-rated, abstract wallpaper made only of soft gradients and "
                "geometric shapes in a calm, pleasant color palette. "
                "No people, text, logos, or objects — just soothing abstract art."
            )

            png_b64 = _call_image_api(safe_prompt)
        else:
            print(f"[ai-image] OpenAI image generation error: {type(e).__name__}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"OpenAI image error: {type(e).__name__}: {e}",
            )
    except Exception as e:
        print(f"[ai-image] Unexpected image generation error: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OpenAI image error: {type(e).__name__}: {e}",
        )

    return _compress_b64_png_to_small_jpeg(png_b64)


# ---------- FastAPI Route ----------

@router.post(
    "/generate-image",
    response_model=GenerateImageResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate a vibe board image for the current lyrics",
)
def generate_image(payload: GenerateImageRequest) -> GenerateImageResponse:
    """
    Real AI image endpoint.

    Takes lyric context (translation, vibe keywords, colors),
    builds a safe collage-style vibe-board prompt,
    and calls OpenAI's image generation API.

    Returns:
      - `prompt`: the exact text sent to the image model
      - `image_data_url`: a `data:image/jpeg;base64,...` URL that the frontend can display
    """
    prompt = _build_prompt(payload)
    if not prompt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to build prompt from provided lyric context.",
        )

    data_url = _generate_image_data_url(prompt)
    return GenerateImageResponse(prompt=prompt, image_data_url=data_url)
