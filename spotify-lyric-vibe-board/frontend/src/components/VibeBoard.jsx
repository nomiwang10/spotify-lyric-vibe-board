import { useState, useEffect } from "react";
import {
  getCurrentTrack,
  parseGeniusLyrics,
  getTranslationVibe,
  getVibeImage,
} from "../api/vibeApi";

export default function VibeBoard() {
  const [track, setTrack] = useState(null);
  const [lyrics, setLyrics] = useState([]);
  const [currentLine, setCurrentLine] = useState(null);
  const [translation, setTranslation] = useState(null);
  const [backgroundImage, setBackgroundImage] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("English");
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  // Poll Spotify every second for current track progress
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

        // --- NEW LOGIC START ---
        
        const currentTimeMs = trackData.progress_ms; 

        // 1. MATH MAGIC: Calculate exactly which line index we should be on.
        // If we are at 12 seconds, 12000 / 5000 = 2.4 -> Index 2.
        const lyricIndex = Math.floor(currentTimeMs / 5000);

        // 2. SAFETY: Make sure that index actually exists in our lyrics list
        if (lyrics.length > 0 && lyricIndex < lyrics.length) {
          const activeLine = lyrics[lyricIndex];

          // 3. UPDATE: Only fetch AI if the line has changed
          if (activeLine && activeLine.id !== currentLine?.id) {
            setCurrentLine(activeLine);

            // Get translation + vibe
            const vibeData = await getTranslationVibe(
              activeLine.id,
              activeLine.text,
              targetLanguage
            );
            setTranslation(vibeData);

            // Get background image
            const imageData = await getVibeImage(
              vibeData.id,
              vibeData.colors,
              vibeData.imagePrompt
            );
            setBackgroundImage(imageData.imageUrl);
          }
        }

      } catch (err) {
        console.error(err);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isConnected, lyrics, currentLine, targetLanguage]);

  // Update lyrics whenever the track changes
  useEffect(() => {
    if (!track?.lyrics) return;

    // Use our new helper to chop up the Genius text
    const processedLyrics = parseGeniusLyrics(track.lyrics);
    setLyrics(processedLyrics);
  }, [track?.lyrics]);

  function handleConnect() {
    // Redirect to Spotify auth (Using 127.0.0.1 to match backend)
    window.location.href = "http://127.0.0.1:8000/auth/login";
  }

  // Check if already authenticated on load
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

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : "none",
        backgroundColor: "#1a1a2e",
        backgroundSize: "cover",
        backgroundPosition: "center",
        transition: "background-image 0.5s ease-in-out",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
        padding: "20px",
      }}
    >
      {/* Language selector */}
      <div style={{ position: "absolute", top: 20, right: 20 }}>
        <select
          value={targetLanguage}
          onChange={(e) => setTargetLanguage(e.target.value)}
          style={{ padding: "8px", fontSize: "1rem" }}
        >
          <option value="English">English</option>
          <option value="Spanish">Spanish</option>
          <option value="French">French</option>
          <option value="German">German</option>
          <option value="Japanese">Japanese</option>
          <option value="Korean">Korean</option>
          <option value="Chinese">Chinese</option>
          <option value="Turkish">Turkish</option>
          <option value="Hindi">Hindi</option>
        </select>
      </div>

      {/* Header - song info */}
      <header style={{ position: "absolute", top: 20, left: 20 }}>
        {track ? (
          <>
            {/* --- FIX 2: Use 'track.song' (matches Python backend) --- */}
            <h2>{track.song}</h2>
            <p>{track.artist}</p>
          </>
        ) : (
          <h2>No track playing</h2>
        )}
      </header>

      {/* Main content */}
      <main style={{ textAlign: "center", maxWidth: "800px" }}>
        {!isConnected ? (
          <button
            onClick={handleConnect}
            style={{
              fontSize: "1.5rem",
              padding: "15px 30px",
              cursor: "pointer",
              background: "#1DB954",
              color: "white",
              border: "none",
              borderRadius: "30px",
            }}
          >
            Connect Spotify
          </button>
        ) : error ? (
          <p style={{ fontSize: "1.5rem" }}>{error}</p>
        ) : currentLine ? (
          <>
            <p style={{ fontSize: "2.5rem", marginBottom: "20px" }}>
              {currentLine.text}
            </p>
            <p style={{ fontSize: "1.5rem", opacity: 0.9 }}>
              {translation?.translated || "Translating..."}
            </p>

            {translation && (
              <div style={{ marginTop: "30px" }}>
                <span
                  style={{
                    background: "rgba(255,255,255,0.2)",
                    padding: "8px 16px",
                    borderRadius: "20px",
                    marginRight: "10px",
                  }}
                >
                  {translation.emotion}
                </span>
                {translation.themes?.map((theme) => (
                  <span
                    key={theme}
                    style={{
                      background: "rgba(255,255,255,0.1)",
                      padding: "5px 12px",
                      borderRadius: "15px",
                      marginRight: "8px",
                      fontSize: "0.9rem",
                    }}
                  >
                    {theme}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <p style={{ fontSize: "1.5rem" }}>
            {/* If we are here, lyrics exist but we are between lines */}
            {lyrics.length > 0 ? "Wait for lyrics..." : "Play a song on Spotify!"}
          </p>
        )}
      </main>
    </div>
  );
}