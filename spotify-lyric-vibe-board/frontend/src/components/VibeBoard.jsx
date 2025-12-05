import { useState, useEffect } from "react";
import {
  getCurrentTrack,
  parseGeniusLyrics,
  getTranslationVibe,
  getVibeImage,
} from "../api/vibeApi";

export default function VibeBoard() {
  const [track, setTrack] = useState(null);
  
  // Raw Lyrics (from Genius)
  const [lyrics, setLyrics] = useState([]);
  
  // AI Analyzed Data (Batch Fetched)
  const [analyzedData, setAnalyzedData] = useState([]); 
  
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const [backgroundImage, setBackgroundImage] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("English");
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  // --- 1. CONNECT & POLL SPOTIFY ---
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(async () => {
      try {
        const trackData = await getCurrentTrack();
        if (trackData.error) {
          setError(trackData.error);
          return;
        }
        setTrack(trackData);
        setError(null);

        // --- SYNC LOGIC ---
        // Calculate which line index we are on (5 seconds per line)
        const newIndex = Math.floor(trackData.progress_ms / 5000);
        
        // Safety: Ensure we don't go past the end of the song
        if (lyrics.length > 0 && newIndex < lyrics.length) {
            
            // Only update if the line actually changed
            if (newIndex !== currentLineIndex) {
                setCurrentLineIndex(newIndex);
                
                // --- IMAGE LOGIC (Safe Mode) ---
                // We check if 'analyzedData' exists AND has an entry for this index.
                // If AI failed or is loading, this block is skipped (no crash).
                if (analyzedData && analyzedData[newIndex]) {
                    const data = analyzedData[newIndex];
                    
                    // Construct a prompt based on the PRE-FETCHED vibe
                    const prompt = `A ${data.vibe} scene representing: ${lyrics[newIndex].text}`;
                    
                    // Fire and forget image generation
                    getVibeImage(newIndex, [data.color], prompt)
                        .then(img => {
                            if (img && img.imageUrl) {
                                setBackgroundImage(img.imageUrl);
                            }
                        })
                        .catch(err => console.error("Image Gen Error:", err));
                }
            }
        }

      } catch (err) {
        console.error(err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isConnected, currentLineIndex, analyzedData, lyrics]);

  // --- 2. LOAD LYRICS & BATCH ANALYZE ---
  // This runs ONCE when the song changes
  useEffect(() => {
    if (!track?.lyrics) return;

    // 1. Process Genius Text
    const processedLyrics = parseGeniusLyrics(track.lyrics);
    
    // Only run if it's a NEW song or lyrics changed
    if (processedLyrics.length > 0 && (lyrics.length === 0 || lyrics[0].text !== processedLyrics[0].text)) {
       setLyrics(processedLyrics);
       setAnalyzedData([]); // Clear old AI data (Show "Analyzing..." text)
       setCurrentLineIndex(-1); // Reset index
       
       console.log("Fetching Batch AI Analysis...");
       
       // 2. Call AI for the WHOLE song
       getTranslationVibe(processedLyrics, targetLanguage)
         .then(results => {
            console.log("AI Analysis Complete!", results);
            // If results is null/undefined (due to error), set empty array
            setAnalyzedData(results || []);
         })
         .catch(err => {
             console.error("AI Batch Error:", err);
             setAnalyzedData([]); // Ensure it's not undefined
         });
    }
  }, [track?.lyrics, targetLanguage]); 

  function handleConnect() {
    window.location.href = "http://127.0.0.1:8000/auth/login";
  }

  useEffect(() => {
    getCurrentTrack()
      .then((data) => {
        if (!data.error) {
          setIsConnected(true);
          setTrack(data);
        }
      })
      .catch(() => {});
  }, []);

  // Helper to safely get current data
  // We use optional chaining (?.) in the render to be extra safe
  const currentLyric = lyrics[currentLineIndex];
  const currentVibe = analyzedData[currentLineIndex];

  return (
    <div
      style={{
        minHeight: "100vh",
        // Use the AI color as backup if image is loading, or dark blue if AI failed
        backgroundColor: currentVibe?.color || "#1a1a2e",
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : "none",
        backgroundSize: "cover",
        backgroundPosition: "center",
        transition: "background 0.5s ease-in-out",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
        padding: "20px",
      }}
    >
      <div style={{ position: "absolute", top: 20, right: 20 }}>
        <select
          value={targetLanguage}
          onChange={(e) => setTargetLanguage(e.target.value)}
          style={{ padding: "8px", fontSize: "1rem", color: "black" }}
        >
          <option value="English">English</option>
          <option value="Spanish">Spanish</option>
          <option value="French">French</option>
          <option value="Hindi">Hindi</option>
        </select>
      </div>

      <header style={{ position: "absolute", top: 20, left: 20 }}>
        {track ? (
          <>
            <h2>{track.song}</h2>
            <p>{track.artist}</p>
          </>
        ) : (
          <h2>No track playing</h2>
        )}
      </header>

      <main style={{ textAlign: "center", maxWidth: "800px" }}>
        {!isConnected ? (
          <button onClick={handleConnect} style={{ padding: "15px", fontSize: "1.5rem", borderRadius:"30px" }}>
            Connect Spotify
          </button>
        ) : currentLyric ? (
          <>
            {/* ORIGINAL LYRIC */}
            <p style={{ fontSize: "2.5rem", marginBottom: "20px" }}>
              {currentLyric.text}
            </p>
            
            {/* TRANSLATION (From Batch Data) */}
            <p style={{ fontSize: "1.5rem", opacity: 0.9, color: "#ffcc00" }}>
              {currentVibe ? currentVibe.translated : "Analyzing song..."}
            </p>

            {/* VIBE TAGS (From Batch Data) */}
            {currentVibe && (
              <div style={{ marginTop: "30px" }}>
                <span style={{ background: "rgba(255,255,255,0.2)", padding: "8px 16px", borderRadius: "20px" }}>
                  {currentVibe.vibe}
                </span>
              </div>
            )}
          </>
        ) : (
          <p style={{ fontSize: "1.5rem" }}>
             {lyrics.length > 0 ? "Wait for lyrics..." : "Loading Song..."}
          </p>
        )}
      </main>
    </div>
  );
}