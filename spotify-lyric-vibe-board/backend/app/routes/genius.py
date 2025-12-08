import os
from dotenv import load_dotenv
from lyricsgenius import Genius

load_dotenv()

token = os.getenv("GENIUS_ACCESS_TOKEN")

# Initialize Genius with settings to remove "junk" data
genius = Genius(token)
genius.verbose = False # Turn off status messages in console
genius.remove_section_headers = True # Removes [Chorus], [Verse 1], etc.
genius.skip_non_songs = True
genius.excluded_terms = ["(Remix)", "(Live)"]

def get_lyrics_from_genius(song_title: str, artist_name: str):
    try:
        print(f"Searching Genius for: {song_title} by {artist_name}...")
        
        # 1. Search for the song
        song = genius.search_song(song_title, artist_name)
        
        if song:
            # 2. Get the lyrics
            lyrics = song.lyrics
            
            # 3. CLEANING: Remove the first line if it's just the song title + "Lyrics"
            # Genius often returns "Song Name Lyrics" as the first line.
            lines = lyrics.split('\n')
            if len(lines) > 0 and "Lyrics" in lines[0]:
                lines = lines[1:]
                
            # 4. Remove the "Embed" text that often appears at the very end
            if len(lines) > 0 and "Embed" in lines[-1]:
                lines = lines[:-1]

            cleaned_lyrics = "\n".join(lines)
            return cleaned_lyrics
        else:
            print("Song not found on Genius.")
            return None

    except Exception as e:
        print(f"Genius Error: {e}")
        return None