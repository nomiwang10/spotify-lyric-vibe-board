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
  const [analyzedData, setAnalyzedData] = useState([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  
  // HISTORY STATE: Stores objects now -> { url: "...", vibe: "Sad" }
  const [imageHistory, setImageHistory] = useState([]);
  
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  // Get current vibe for the main background color
  // Fallback to dark color if analysis isn't ready
  const currentVibeData = analyzedData[currentLineIndex];
  const backgroundColor = currentVibeData?.color || "#111";

  // --- 1. SYNC WITH SPOTIFY & GENERATE IMAGES ---
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(async () => {
      try {
        const trackData = await getCurrentTrack();
        
        if (trackData.error) {
          if (trackData.is_paused) {
             setTrack(trackData);
          } else {
             setError(trackData.error);
          }
          return;
        }

        setTrack(trackData);
        setError(null);

        const newIndex = trackData.is_paused 
          ? currentLineIndex 
          : Math.floor(trackData.progress_ms / 5000);

        // If line has changed...
        if (lyrics.length > 0 && newIndex < lyrics.length) {
          if (newIndex !== currentLineIndex) {
            setCurrentLineIndex(newIndex);
            
            // --- ROBUST DATA FETCHING ---
            const lyricText = lyrics[newIndex].text;
            
            // Fallback: If AI hasn't analyzed this line yet, guess "Abstract"
            // This ensures images ALWAYS generate, even if analysis is slow.
            const vibeWord = (analyzedData && analyzedData[newIndex]) 
              ? analyzedData[newIndex].vibe 
              : "Abstract";

            // Call API with text + vibe
            getVibeImage(lyricText, vibeWord)
              .then((img) => {
                if (img && img.imageUrl) {
                  // Add Image AND Vibe Word to history
                  setImageHistory((prev) => [
                    { url: img.imageUrl, vibe: vibeWord }, 
                    ...prev
                  ].slice(0, 8));
                }
              })
              .catch((err) => console.error("Image Gen Error:", err));
          }
        }
      } catch (err) {
        console.error(err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isConnected, currentLineIndex, analyzedData, lyrics]);

  // --- 2. LOAD LYRICS & ANALYZE ---
  useEffect(() => {
    if (!track?.song) return;

    const processedLyrics = parseGeniusLyrics(track.lyrics);

    if (
      processedLyrics.length > 0 &&
      (lyrics.length === 0 || lyrics[0].text !== processedLyrics[0].text)
    ) {
      setLyrics(processedLyrics);
      setAnalyzedData([]);
      setImageHistory([]); 
      setCurrentLineIndex(-1);

      getTranslationVibe(processedLyrics, "English")
        .then((results) => {
          setAnalyzedData(results || []);
        })
        .catch((err) => {
          console.error("AI Batch Error:", err);
          setAnalyzedData([]);
        });
    }
  }, [track?.song]);

  // --- 3. AUTO CONNECT ---
  useEffect(() => {
    getCurrentTrack()
      .then((data) => {
        if (data && !data.error) {
          setIsConnected(true);
          setTrack(data);
        }
      })
      .catch(() => {});
  }, []);

  function handleConnect() {
    window.location.href = "http://127.0.0.1:8000/auth/login";
  }

  const currentLyric = lyrics[currentLineIndex];

  // --- NEW COMPONENT: IMAGE BOX WITH TEXT OVERLAY ---
  const ImageBox = ({ data, opacity = 1 }) => {
    // data is { url: "...", vibe: "Sad" } or undefined
    const imgUrl = data?.url;
    const vibeText = data?.vibe;

    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative", // Needed for absolute positioning of text
          backgroundImage: imgUrl ? `url(${imgUrl})` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          borderRadius: "16px",
          boxShadow: imgUrl ? "0 4px 15px rgba(0,0,0,0.5)" : "none",
          transition: "all 0.8s ease",
          opacity: opacity,
          overflow: "hidden"
        }}
      >
        {/* The Vibe Word Overlay */}
        {vibeText && imgUrl && (
          <div style={{
            position: "absolute",
            bottom: "10px",
            left: "10px",
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            padding: "4px 12px",
            borderRadius: "12px",
            color: "white",
            fontSize: "0.8rem",
            fontWeight: "bold",
            textTransform: "uppercase",
            letterSpacing: "1px"
          }}>
            {vibeText}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        height: "100vh",
        backgroundColor: backgroundColor,
        transition: "background-color 1s ease",
        display: "grid",
        gridTemplateColumns: "1fr minmax(320px, 600px) 1fr",
        gridTemplateRows: "1fr minmax(300px, 500px) 1fr",
        gap: "20px",
        padding: "20px",
        boxSizing: "border-box",
        color: "white",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ position: "absolute", top: 25, left: 25, zIndex: 10 }}>
        {track && track.song !== "No Track Playing" && (
          <div style={{ background: "rgba(0,0,0,0.6)", padding: "10px 20px", borderRadius: "30px", backdropFilter: "blur(5px)" }}>
            <h3 style={{ margin: 0, fontSize: "1.2rem" }}>{track.song}</h3>
            <p style={{ margin: 0, opacity: 0.8, fontSize: "0.9rem" }}>{track.artist}</p>
          </div>
        )}
      </div>

      {/* --- GRID (Using the new ImageBox) --- */}
      <ImageBox data={imageHistory[0]} opacity={1} />   
      <ImageBox data={imageHistory[1]} opacity={0.9} /> 
      <ImageBox data={imageHistory[2]} opacity={0.8} /> 
      
      <ImageBox data={imageHistory[7]} opacity={0.4} /> 

      {/* --- CENTER STAGE --- */}
      <main
        style={{
          gridColumn: "2 / 3",
          gridRow: "2 / 3",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          background: "rgba(0, 0, 0, 0.4)", 
          borderRadius: "24px",
          padding: "40px",
          backdropFilter: "blur(20px)", 
          boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.5)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          zIndex: 5,
        }}
      >
        {!isConnected ? (
          <button
            onClick={handleConnect}
            style={{
              padding: "15px 40px",
              fontSize: "1.2rem",
              borderRadius: "50px",
              border: "none",
              background: "#1DB954",
              color: "white",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Connect Spotify
          </button>
        ) : currentLyric ? (
          <>
            <p style={{ fontSize: "2.2rem", fontWeight: "700", marginBottom: "25px", lineHeight: "1.3", textShadow: "0 2px 10px rgba(0,0,0,0.8)" }}>
              {currentLyric.text}
            </p>

            <p style={{ fontSize: "1.4rem", color: "#FFD700", fontStyle: "italic", marginBottom: "35px", opacity: 0.9 }}>
              {currentVibeData ? currentVibeData.translated : "..."}
            </p>

            {currentVibeData && (
              <div style={{ display: "flex", gap: "10px" }}>
                <span style={{ 
                    background: currentVibeData.color, 
                    padding: "8px 20px", 
                    borderRadius: "20px", 
                    fontWeight: "bold", 
                    color: "#fff",
                    textShadow: "1px 1px 2px rgba(0,0,0,0.5)",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.3)"
                  }}>
                  {currentVibeData.vibe}
                </span>
              </div>
            )}
          </>
        ) : (
          <p style={{ fontSize: "1.5rem", opacity: 0.7 }}>
            {track?.is_paused ? "Music Paused" : "Listening..."}
          </p>
        )}
      </main>

      <ImageBox data={imageHistory[3]} opacity={0.7} /> 
      
      <ImageBox data={imageHistory[6]} opacity={0.5} /> 
      <ImageBox data={imageHistory[5]} opacity={0.6} /> 
      <ImageBox data={imageHistory[4]} opacity={0.7} /> 
    </div>
  );
}