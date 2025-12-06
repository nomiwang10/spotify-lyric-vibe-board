import os
import json
from fastapi import APIRouter, HTTPException
from spotipy import Spotify
from spotipy.oauth2 import SpotifyOAuth
from dotenv import load_dotenv
from app.routes.genius import get_lyrics_from_genius

load_dotenv()

router = APIRouter(prefix="/api")

# Load demo lyrics
try:
    with open("app/data/demo_lyrics.json", "r") as f:
        DEMO_LYRICS = json.load(f)
except:
    DEMO_LYRICS = {}

def get_spotify_client():
    return Spotify(
        auth_manager=SpotifyOAuth(
            client_id=os.getenv("SPOTIPY_CLIENT_ID"),
            client_secret=os.getenv("SPOTIPY_CLIENT_SECRET"),
            redirect_uri=os.getenv("SPOTIPY_REDIRECT_URI"),
            scope="user-read-currently-playing",
            open_browser=False,
            cache_path=".spotify_cache"
        )
    )

@router.get("/current-song")
def get_current_song():
    try:
        oauth = SpotifyOAuth(
            client_id=os.getenv("SPOTIPY_CLIENT_ID"),
            client_secret=os.getenv("SPOTIPY_CLIENT_SECRET"),
            redirect_uri=os.getenv("SPOTIPY_REDIRECT_URI"),
            scope="user-read-currently-playing",
            open_browser=False,
            cache_path=".spotify_cache"
        )

        if not oauth.get_cached_token():
            return {"error": "not_authenticated"}


        sp = Spotify(auth_manager=oauth)
        current_track = sp.current_user_playing_track()

        if not current_track or not current_track.get("is_playing"):
            return {"status": "paused", "message": "No music playing right now."}

        item = current_track["item"]
        song_name = item["name"]
        artist_name = item["artists"][0]["name"]
        track_id = item["id"]
        progress_ms = current_track.get("progress_ms", 0)

        # --- LYRIC LOGIC ---
        # 1. Default Message
        lyrics = "Lyrics could not be found."

        # 2. Check Local Demo File First (Fastest)
        if song_name in DEMO_LYRICS:
            print(f"Using Demo Lyrics for: {song_name}")
            lyrics = DEMO_LYRICS[song_name]
        
        # 3. If not in demo, ask Genius (The New Part!)
        else:
            print(f"Fetching from Genius for: {song_name} by {artist_name}")
            fetched_lyrics = get_lyrics_from_genius(song_name, artist_name)
            if fetched_lyrics:
                lyrics = fetched_lyrics
            else:
                lyrics = "Lyrics not found on Genius."

        return {
            "status": "playing",
            "track_id": track_id,
            "song": song_name,
            "artist": artist_name,
            "progress_ms": progress_ms,
            "lyrics": lyrics,
            "cover_art": item["album"]["images"][0]["url"],
            "duration_ms": item.get("duration_ms", 0)
        }

    except Exception as e:
        print(f"Spotify Error: {e}")
        return {"status": "error", "message": str(e)}