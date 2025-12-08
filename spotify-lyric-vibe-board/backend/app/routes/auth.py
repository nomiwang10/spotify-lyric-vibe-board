import os
from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse
from spotipy.oauth2 import SpotifyOAuth
from dotenv import load_dotenv

load_dotenv()
router = APIRouter(prefix="/auth")


def get_oauth():
    redirect = os.getenv("SPOTIPY_REDIRECT_URI")

    print("Loaded Redirect URI:", redirect)  # DEBUG

    return SpotifyOAuth(
        client_id=os.getenv("SPOTIPY_CLIENT_ID"),
        client_secret=os.getenv("SPOTIPY_CLIENT_SECRET"),
        redirect_uri=redirect,
        scope="user-read-currently-playing",
        cache_path=os.getenv("SPOTIPY_CACHE_PATH", ".spotify_cache"),
        open_browser=False
    )


@router.get("/login")
def login():
    oauth = get_oauth()
    url = oauth.get_authorize_url()
    return RedirectResponse(url)


@router.get("/callback")
def callback(request: Request):
    code = request.query_params.get("code")

    if not code:
        print("❌ No code returned from Spotify")
        return RedirectResponse("http://localhost/?error=no_code", status_code=302)

    oauth = get_oauth()
    token_info = oauth.get_access_token(code)

    if token_info and token_info.get("access_token"):
        print("✅ Spotify Token acquired and cached successfully.")
    else:
        print("❌ Spotify Token acquisition failed!")
        return RedirectResponse("http://localhost/?error=auth_failed", status_code=302)

    return RedirectResponse("http://localhost:5173/", status_code=302)
