import os
import json
from fastapi import APIRouter
from spotipy import Spotify
from spotipy.oauth2 import SpotifyOAuth
from dotenv import load_dotenv

# Try importing Genius helper, handle if missing
try:
    from app.routes.genius import get_lyrics_from_genius
except ImportError:
    def get_lyrics_from_genius(song, artist): return None

load_dotenv()

router = APIRouter(prefix="/api")

# Load demo lyrics
try:
    with open("app/data/demo_lyrics.json", "r") as f:
        DEMO_LYRICS = json.load(f)
except:
    DEMO_LYRICS = {}

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

        token_info = oauth.get_cached_token()
        if not token_info:
            # Error: User actually needs to log in
            return {"error": "Not logged in. Please connect Spotify."}

        sp = Spotify(auth=token_info['access_token'])
        current_track = sp.current_user_playing_track()

        # --- PAUSED LOGIC ---
        # If nothing is playing, we return valid data (not an error)
        # so the frontend stays connected.
        if not current_track or not current_track.get("item"):
            return {
                "song": "No Track Playing",
                "artist": "Paused",
                "progress_ms": 0,
                "lyrics": "",
                "cover_image": "", 
                "is_paused": True 
            }

        # --- PLAYING LOGIC ---
        item = current_track["item"]
        song_name = item["name"]
        artist_name = item["artists"][0]["name"]
        
        # --- LYRIC LOGIC (THE TWEAK) ---
        lyrics = "Lyrics not found." 

        # 1. Check Demo Lyrics
        if song_name in DEMO_LYRICS:
            print(f"Using Demo Lyrics for: {song_name}")
            lyrics = DEMO_LYRICS[song_name]
        
        # 2. Check Genius (Only if we have a real song name)
        elif song_name and song_name != "No Track Playing":
            fetched_lyrics = get_lyrics_from_genius(song_name, artist_name)
            if fetched_lyrics:
                lyrics = fetched_lyrics

        return {
            "song": song_name,
            "artist": artist_name,
            "progress_ms": current_track.get("progress_ms", 0),
            "lyrics": lyrics,
            "cover_image": item["album"]["images"][0]["url"],
            "duration_ms": item.get("duration_ms", 0)
        }

    except Exception as e:
        print(f"Spotify Error: {e}")
        return {"error": str(e)}