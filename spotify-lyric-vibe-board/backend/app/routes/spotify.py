from fastapi import APIRouter

router = APIRouter(prefix="/api")

@router.get("/current-song")
def get_current_song():
    return {"status": "Spotify module connected (waiting for Aspyn's code)"}