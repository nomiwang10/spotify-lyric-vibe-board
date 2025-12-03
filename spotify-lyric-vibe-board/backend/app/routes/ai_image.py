from fastapi import APIRouter 
router = APIRouter(prefix="/api")

@router.get("/generate-image")
def generate_image_stub():
    return {"status": "Image module connected (waiting for Nomi's code)"}