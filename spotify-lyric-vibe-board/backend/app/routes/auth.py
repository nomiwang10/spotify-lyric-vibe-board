import os
from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse
from spotipy.oauth2 import SpotifyOAuth

router = APIRouter(prefix="/auth")

def get_oauth():
    redirect = os.getenv("SPOTIPY_REDIRECT_URI")

    print("Loaded Redirect URI:", redirect)  # DEBUG

    return SpotifyOAuth(
        client_id=os.getenv("SPOTIPY_CLIENT_ID"),
        client_secret=os.getenv("SPOTIPY_CLIENT_SECRET"),
        redirect_uri=redirect,
        scope="user-read-currently-playing",
        cache_path=".spotify_cache",
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
    oauth = get_oauth()
    token_info = oauth.get_access_token(code)
    
    return RedirectResponse("http://127.0.0.1:5173")
