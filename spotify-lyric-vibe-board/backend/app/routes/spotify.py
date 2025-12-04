import os
import json
from fastapi import APIRouter, HTTPException
from spotipy import Spotify
from spotipy.oauth2 import SpotifyOAuth
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api")

# Setup Spotify Authentication
# This will open a browser window the first time you run it to log you in.
sp = Spotify(auth_manager=SpotifyOAuth(
    client_id=os.getenv("80462b9869744fc69a827483fdcb0ff5"),
    client_secret=os.getenv("4aaa32c39eda42f49be5889e58b40593"),
    redirect_uri="http://127.0.0.1:8888/callback",
    scope="user-read-currently-playing"
))

# Load our local demo lyrics just in case (optional backup)
# This assumes demo_lyrics.json is in backend/app/data/
try:
    with open("app/data/demo_lyrics.json", "r") as f:
        DEMO_LYRICS = json.load(f)
except:
    DEMO_LYRICS = {}

@router.get("/current-song")
def get_current_song():
    """
    Fetches the currently playing song from Spotify.
    """
    try:
        current_track = sp.current_user_playing_track()
        
        if not current_track or not current_track['is_playing']:
            return {"status": "paused", "message": "No music playing right now."}
        
        item = current_track['item']
        song_name = item['name']
        artist_name = item['artists'][0]['name']
        track_id = item['id']
        progress_ms = current_track['progress_ms']
        
        # --- LYRIC FETCHING STRATEGY ---
        # 1. Check if we have lyrics for this song in our demo file
        # 2. If not, return a placeholder (since Spotify API doesn't give lyrics)
        lyrics = "Lyrics not available in API."
        
        # Simple check if the song name exists in our demo file
        # (You can make this smarter later!)
        if song_name in DEMO_LYRICS:
            lyrics = DEMO_LYRICS[song_name]
        
        return {
            "status": "playing",
            "track_id": track_id,
            "song": song_name,
            "artist": artist_name,
            "progress_ms": progress_ms,
            "lyrics": lyrics,
            "cover_art": item['album']['images'][0]['url']
        }

    except Exception as e:
        print(f"Spotify Error: {e}")
        raise HTTPException(status_code=500, detail="Could not fetch song from Spotify")