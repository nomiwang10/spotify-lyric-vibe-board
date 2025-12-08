import { useState, useEffect, useRef } from "react";
import {
  getCurrentTrack,
  parseGeniusLyrics,
  getTranslationVibe,
  getVibeImage,
} from "../api/vibeApi";

export default function VibeBoard() {
  const [track, setTrack] = useState(null);
  const [lyrics, setLyrics] = useState([]);
  
  // Analyzed Data (Translations)
  const [analyzedData, setAnalyzedData] = useState([]);
  
  // Current State
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const [imageHistory, setImageHistory] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  // Refs to prevent "Closure Stale State" issues in setInterval
  const lyricsRef = useRef([]);
  const analyzedRef = useRef([]);

  // --- 1. INITIAL CONNECT ---
  useEffect(() => {
    getCurrentTrack()
      .then((data) => {
        if (data && !data.error) {
          setIsConnected(true);
          setTrack(data);
        }
      })
      .catch((e) => console.log("Not connected yet"));
  }, []);

  // --- 2. SONG CHANGE DETECTOR & LYRIC PARSING ---
  useEffect(() => {
    if (!track?.song) return;
    if (track.song === "No Track Playing") return;

    // Only re-parse if it's actually a new song text
    // (Simple check: compare first line text if available)
    const newRawLyrics = track.lyrics;
    const currentFirstLine = lyrics.length > 0 ? lyrics[0].text : "";
    
    // We parse mostly to check if we have lyrics
    const parsed = parseGeniusLyrics(newRawLyrics);

    if (parsed.length > 0 && parsed[0].text !== currentFirstLine) {
      console.log("🎵 New Song Detected:", track.song);
      setLyrics(parsed);
      lyricsRef.current = parsed; // Sync Ref
      
      setAnalyzedData([]); // Reset analysis
      analyzedRef.current = []; // Sync Ref
      
      setImageHistory([]); 
      setCurrentLineIndex(-1);

      // Trigger Batch Analysis
      console.log("🧠 Starting AI Analysis...");
      getTranslationVibe(parsed, "English")
        .then((results) => {
          console.log("✅ Analysis Complete:", results);
          setAnalyzedData(results || []);
          analyzedRef.current = results || [];
        })
        .catch((err) => {
          console.error("❌ Analysis Failed:", err);
        });
    }
  }, [track?.song]);

  // --- 3. THE TIMER LOOP (Only handles Time & Index) ---
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(async () => {
      try {
        const trackData = await getCurrentTrack();
        
        if (trackData.error) {
          // Handle paused or error
          return;
        }

        // 1. Update Track info (progress, etc)
        setTrack(trackData);

        // 2. Calculate Index
        const newIndex = trackData.is_paused 
          ? currentLineIndex 
          : Math.floor(trackData.progress_ms / 5000);

        // 3. Update Index State ONLY if changed
        if (lyricsRef.current.length > 0 && newIndex < lyricsRef.current.length) {
          setCurrentLineIndex((prevIndex) => {
            if (newIndex !== prevIndex) {
              return newIndex; // This triggers the Effect below
            }
            return prevIndex;
          });
        }
      } catch (err) {
        console.error("Poll Error:", err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isConnected]); 

  // --- 4. THE IMAGE GENERATOR (Triggered by Index Change) ---
  useEffect(() => {
    if (currentLineIndex < 0) return;
    if (lyrics.length === 0) return;

    const currentLyricObj = lyrics[currentLineIndex];
    if (!currentLyricObj) return;

    console.log(`🎨 Line Changed to ${currentLineIndex}: "${currentLyricObj.text}"`);

    // Determine Vibe (Fallback to 'Abstract' if analysis isn't ready)
    const analysis = analyzedData[currentLineIndex];
    const vibeWord = analysis ? analysis.vibe : "Abstract";

    // GENERATE IMAGE
    getVibeImage(currentLyricObj.text, vibeWord)
      .then((img) => {
        if (img && img.imageUrl) {
          console.log("🖼️ Image Generated Successfully");
          setImageHistory((prev) => [
            { url: img.imageUrl, vibe: vibeWord }, 
            ...prev
          ].slice(0, 8));
        } else {
            console.warn("⚠️ Backend returned no image URL");
        }
      })
      .catch((err) => console.error("❌ Image Gen Error:", err));

  }, [currentLineIndex]); 

  // --- RENDER HELPERS ---
  
  // Safe access to current analysis
  const currentAnalysis = analyzedData[currentLineIndex];
  const backgroundColor = currentAnalysis?.color || "#111";

  function handleConnect() {
    window.location.href = "http://127.0.0.1:8000/auth/login";
  }

  // Reuse your ImageBox component
  const ImageBox = ({ data, opacity = 1 }) => {
    const imgUrl = data?.url;
    const vibeText = data?.vibe;

    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
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
      <div style={{ position: "absolute", top: 25, left: 25, zIndex: 10 }}>
        {track && track.song !== "No Track Playing" && (
          <div style={{ background: "rgba(0,0,0,0.6)", padding: "10px 20px", borderRadius: "30px", backdropFilter: "blur(5px)" }}>
            <h3 style={{ margin: 0, fontSize: "1.2rem" }}>{track.song}</h3>
            <p style={{ margin: 0, opacity: 0.8, fontSize: "0.9rem" }}>{track.artist}</p>
          </div>
        )}
      </div>

      {/* --- ADDED IMAGE SECTION --- */}
      <div style={{ position: "absolute", top: 25, right: 25, zIndex: 10 }}>
        {/* credits to Gemini nano banana pro for the image */}
        <img 
            src="/latentlyrics_icon_gemini.png" 
            alt="Latent Lyrics Icon" 
            style={{ 
                width: "100px", 
                height: "auto", 
                borderRadius: "20px", 
                boxShadow: "0 4px 15px rgba(0,0,0,0.5)" 
            }} 
        />
      </div>
      {/* --------------------------- */}

      <ImageBox data={imageHistory[0]} opacity={1} />   
      <ImageBox data={imageHistory[1]} opacity={0.9} /> 
      <ImageBox data={imageHistory[2]} opacity={0.8} /> 
      <ImageBox data={imageHistory[7]} opacity={0.4} /> 

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
          <button onClick={handleConnect} style={{ padding: "15px 40px", fontSize: "1.2rem", borderRadius: "50px", border: "none", background: "#1DB954", color: "white", fontWeight: "bold", cursor: "pointer" }}>
            Connect Spotify
          </button>
        ) : (lyrics[currentLineIndex]) ? (
          <>
            <p style={{ fontSize: "2.2rem", fontWeight: "700", marginBottom: "25px", lineHeight: "1.3", textShadow: "0 2px 10px rgba(0,0,0,0.8)" }}>
              {lyrics[currentLineIndex].text}
            </p>

            {/* Translation Logic */}
            <p style={{ fontSize: "1.4rem", color: "#FFD700", fontStyle: "italic", marginBottom: "35px", opacity: 0.9 }}>
              {currentAnalysis ? currentAnalysis.translated : "analyzing..."}
            </p>

            {/* Vibe Logic */}
            <div style={{ display: "flex", gap: "10px" }}>
                <span style={{ 
                    background: currentAnalysis ? currentAnalysis.color : "#333", 
                    padding: "8px 20px", 
                    borderRadius: "20px", 
                    fontWeight: "bold", 
                    color: "#fff",
                    textShadow: "1px 1px 2px rgba(0,0,0,0.5)",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.3)"
                  }}>
                  {currentAnalysis ? currentAnalysis.vibe : "..."}
                </span>
            </div>
          </>
        ) : (
          <p style={{ fontSize: "1.5rem", opacity: 0.7 }}>
            {track?.is_paused ? "Music Paused" : "Waiting for lyrics..."}
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