import { useState, useEffect, useRef } from "react";
import {
  getCurrentTrack,
  getLyrics,
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

        // Find which lyric line matches current time
        const currentTimeMs = trackData.progressMs;
        const activeLine = lyrics.find(
          (line) => currentTimeMs >= line.startMs && currentTimeMs < line.endMs
        );

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
      } catch (err) {
        console.error(err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isConnected, lyrics, currentLine, targetLanguage]);

  // Load lyrics when track changes
  useEffect(() => {
    if (!track?.id) return;

    getLyrics(track.id).then(setLyrics).catch(console.error);
  }, [track?.id]);

  function handleConnect() {
    // Redirect to Spotify authorization
    window.location.href = "http://localhost:8000/auth/login";
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
            <h2>{track.name}</h2>
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
          <p style={{ fontSize: "1.5rem" }}>Play a song on Spotify!</p>
        )}
      </main>
    </div>
  );
}