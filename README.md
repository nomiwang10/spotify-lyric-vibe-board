# Real-Time Spotify Lyric Translator + Song Vibe Board

GAIT Fall 2025 – Final Project  
Team: **Aspyn, Eva, Nomi, Elif**

---

## 1. Overview

Music is universal, but language barriers often block listeners from fully understanding songs in other languages. This project builds a web app that:

- Translates Spotify lyrics in (near) real time into a target language.
- Analyzes each lyric line for **emotion** and **themes**.
- Generates an AI-created **“vibe board”** background image that visually matches the song’s mood.

The app combines:

- **Spotify Web API** (track + playback data)
- **OpenAI text models** (translation + emotion/theme extraction)
- **OpenAI image models** (abstract vibe images)
- A simple **React front‑end** for synchronized display.

---

## 2. Features

- Real‑time Spotify track detection (current playing song).
- Per‑line lyric translation into a user‑selected language.
- Emotion and theme tagging for each lyric segment.
- AI‑generated abstract background images (“vibe board”) that update as the song progresses.
- Front‑end display that shows:
  - Original lyric line
  - Translated lyric line
  - Current emotion & themes
  - Dynamic background image with smooth transitions

---

## 3. Tech Stack

**Backend**

- Python
- FastAPI
- OpenAI API (text + images)
- Spotify Web API
- httpx / requests
- Pydantic

**Front‑end**

- React (Vite or Create React App)
- TypeScript or JavaScript
- Fetch / Axios

---

## 4. Repository Structure

```text
spotify-lyric-vibe-board/
  backend/          # FastAPI backend (Spotify, OpenAI, APIs)
    app/
      main.py       # FastAPI entrypoint
      routes/       # spotify.py, ai_text.py, ai_image.py
      data/         # demo_lyrics.json etc.
      models/       # Pydantic models (optional)
    .env            # backend secrets (NOT committed)
  frontend/         # React front‑end (UI)
    src/
    .env            # front‑end env (NOT committed)
  docs/
    api_contract.md # JSON schemas and API docs
  README.md
