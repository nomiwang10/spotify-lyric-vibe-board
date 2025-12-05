import os
import requests
from dotenv import load_dotenv
from bs4 import BeautifulSoup

load_dotenv()

GENIUS_TOKEN = os.getenv("GENIUS_ACCESS_TOKEN")
BASE_URL = "https://api.genius.com"


def get_lyrics_from_genius(song_title: str, artist_name: str):
    headers = {"Authorization": f"Bearer {GENIUS_TOKEN}"}

    # Search for the song
    search_url = f"{BASE_URL}/search"
    params = {"q": f"{song_title} {artist_name}"}
    response = requests.get(search_url, params=params, headers=headers).json()

    try:
        # Get the top hit
        song_path = response["response"]["hits"][0]["result"]["path"]
        lyrics_page_url = "https://genius.com" + song_path

        # Scrape lyrics
        page = requests.get(lyrics_page_url)
        soup = BeautifulSoup(page.text, "html.parser")

        # All lyrics are inside <div data-lyrics-container="true">
        lyrics_divs = soup.find_all("div", {"data-lyrics-container": "true"})
        lyrics = "\n".join([div.get_text(separator="\n") for div in lyrics_divs])

        return lyrics.strip()

    except Exception as e:
        print("Genius Error:", e)
        return None
