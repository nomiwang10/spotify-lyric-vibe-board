# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import ai_text, spotify, ai_image, genius
from app.routes import auth
import os 
from dotenv import load_dotenv

load_dotenv() # Pass the specific path to the function



app = FastAPI()

app.include_router(auth.router)

# --- 1. CORS Middleware Setup ---
app.add_middleware(
    CORSMiddleware,
    # We add 127.0.0.1 to the list so it matches your new setup
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173", 
        "http://localhost:3000"
    ],
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