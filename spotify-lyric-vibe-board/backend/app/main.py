# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# CHANGE 1: Import your teammates' files too
from app.routes import ai_text, spotify, genius, ai_image 

app = FastAPI()

# --- 1. CORS Middleware Setup ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. Route Inclusion (Registering Endpoints) ---
# This is the "Traffic Controller". It tells the app where to look for different features.

app.include_router(ai_text.router) 
app.include_router(spotify.router)   
app.include_router(ai_image.router)  

# --- 3. Health Check Endpoint ---
@app.get("/health")
def health():
    return {"status": "ok"}