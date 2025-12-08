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
  const currentIndexRef = useRef(-1);
  
  // 💡 NEW: Ref for Auto-Scroll
  const listRef = useRef(null); 

  // --- NEW: Sync currentLineIndex to a ref ---
useEffect(() => {
  currentIndexRef.current = currentLineIndex;
}, [currentLineIndex]);

  // --- 1. INITIAL CONNECT ---
  useEffect(() => {
    getCurrentTrack()
      .then((data) => {
        if (data && !data.error) {
          setIsConnected(true);
          setTrack(data);
        }
      })
      .catch((error) => console.error("Initial connection failed:",error));
  }, []);

  // --- 2. SONG CHANGE DETECTOR & LYRIC PARSING ---
  useEffect(() => {
    if (!track?.song) return;
    if (track.song === "No Track Playing") return;

    const newRawLyrics = track.lyrics;
    const currentFirstLine = lyrics.length > 0 ? lyrics[0].text : "";
    
    // We parse mostly to check if we have lyrics
    const parsed = parseGeniusLyrics(newRawLyrics);

    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }, [track?.song,lyrics,track?.lyrics]);

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

        // 2. Calculate Index: Still using 5-second chunks
        const newIndex = trackData.is_paused 
          ? currentIndexRef.current
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

  // 💡 NEW EFFECT: Auto-Scroll Logic (Triggered by Index Change)
  useEffect(() => {
    if (currentLineIndex < 0 || !listRef.current) return;
    
    // Find the current line element
    const currentLineElement = listRef.current.querySelector(
        `#lyric-line-${currentLineIndex}`
    );
    
    if (currentLineElement) {
        // Scroll the current line into the middle of the container
        currentLineElement.scrollIntoView({
            behavior: "smooth",
            block: "center", // Scrolls the element to the center of the visible area
        });
    }
  }, [currentLineIndex]);


  // --- 4. THE IMAGE GENERATOR (Triggered by Index Change, adjusted for chunks) ---
  useEffect(() => {
    if (currentLineIndex < 0) return;
    if (lyrics.length === 0) return;

    // 💡 NEW LOGIC: Only generate a new image at the start of every 5th line (index 0, 5, 10, ...)
    const CHUNK_SIZE = 5; // Define your desired chunk size
    const isNewChunk = currentLineIndex % CHUNK_SIZE === 0;

    // Check if we already have an image for this line's chunk in history
    const isImageAlreadyGenerated = imageHistory.some(
        (img) => img.startIndex === currentLineIndex 
    );

    if (!isNewChunk || isImageAlreadyGenerated) return; // Skip if not the start of a new chunk or already done
    
    // Grab the next N lines for the prompt
    const chunkLyricLines = lyrics
        .slice(currentLineIndex, currentLineIndex + CHUNK_SIZE)
        .map(line => line.text);

    // If the chunk is empty or too short, skip
    if (chunkLyricLines.length === 0) return;

    // Determine Vibe (using the vibe from the FIRST line of the chunk)
    const analysis = analyzedData[currentLineIndex];
    const vibeWord = analysis ? analysis.vibe : "Abstract";

    // GENERATE IMAGE
    // Send the whole chunk of lyrics for a better prompt!
    getVibeImage(chunkLyricLines.join(" / "), vibeWord) 
      .then((img) => {
          if (img && img.imageUrl) {
              console.log(`🖼️ Image Generated for Chunk starting at ${currentLineIndex}`);
              setImageHistory((prev) => [
                  { url: img.imageUrl, vibe: vibeWord, startIndex: currentLineIndex }, // 💡 Save the index
                  ...prev,
              ].slice(0, 8));
          } else {
              console.warn("⚠️ Backend returned no image URL");
          }
      })
      .catch((err) => console.error("❌ Image Gen Error:", err));

  }, [currentLineIndex, lyrics, analyzedData, imageHistory]); 

  // --- RENDER HELPERS ---
  
  // Safe access to current analysis
  const currentAnalysis = analyzedData[currentLineIndex];
  // Determine the background color based on the current line's analysis
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

      {/* --- ICON --- */}
      <div style={{ position: "absolute", top: 25, right: 25, zIndex: 10 }}>
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

      {/* BACKGROUND IMAGE GRID (Positioning relative to the main grid) */}
      <ImageBox data={imageHistory[0]} opacity={1} /> 
      <ImageBox data={imageHistory[1]} opacity={0.9} /> 
      <ImageBox data={imageHistory[2]} opacity={0.8} /> 
      <ImageBox data={imageHistory[7]} opacity={0.4} /> 

      <main
        // 💡 ADD styles for scroll management
        style={{
          gridColumn: "2 / 3",
          gridRow: "2 / 3",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          background: "rgba(0, 0, 0, 0.4)", 
          borderRadius: "24px",
          padding: "40px",
          backdropFilter: "blur(20px)", 
          boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.5)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          zIndex: 5,
          maxHeight: "500px", // Limits the main box height
          overflowY: "auto", // Enables vertical scrolling
        }}
      >
        {!isConnected ? (
          <button onClick={handleConnect} style={{ padding: "15px 40px", fontSize: "1.2rem", borderRadius: "50px", border: "none", background: "#1DB954", color: "white", fontWeight: "bold", cursor: "pointer" }}>
            Connect Spotify
          </button>
        ) : lyrics.length > 0 ? (
          // 💡 NEW: List view for all lyrics
          <div 
            ref={listRef} // Attach the ref for scrolling
            style={{ width: "100%", padding: "20px 0" }}
          >
            {lyrics.map((line, index) => {
                const lineAnalysis = analyzedData[index];
                const isActive = index === currentLineIndex;

                // Use the color from the current line's analysis for the highlight background
                const highlightColor = lineAnalysis?.color || "#333"; 

                return (
                    <div 
                        key={line.id} 
                        id={`lyric-line-${index}`} // ID for scroll target
                        style={{
                            margin: "15px 0",
                            padding: "10px 20px",
                            transition: "all 0.4s ease",
                            transform: isActive ? "scale(1.05)" : "scale(1)",
                            // Conditional background color with alpha (40 is opacity)
                            background: isActive ? `${highlightColor}40` : "transparent", 
                            borderRadius: "15px",
                            cursor: 'default', // Stop the mouse from selecting the text
                        }}
                    >
                        {/* Original Lyric */}
                        <p style={{
                            fontSize: isActive ? "1.8rem" : "1.2rem",
                            fontWeight: isActive ? "900" : "500",
                            marginBottom: "5px",
                            lineHeight: "1.2",
                            opacity: isActive ? 1 : 0.6,
                            transition: "all 0.4s ease",
                            textShadow: "0 2px 5px rgba(0,0,0,0.6)"
                        }}>
                            {line.text}
                        </p>

                        {/* Translated/Vibe Lyric */}
                        {lineAnalysis && (
                            <p style={{ 
                                fontSize: isActive ? "1.1rem" : "0.9rem", 
                                color: "#FFD700", 
                                fontStyle: "italic",
                                opacity: isActive ? 1 : 0.4,
                                transition: "all 0.4s ease",
                            }}>
                                {lineAnalysis.translated} ({lineAnalysis.vibe})
                            </p>
                        )}
                    </div>
                );
            })}
          </div>
        ) : (
          <p style={{ fontSize: "1.5rem", opacity: 0.7 }}>
            {track?.is_paused ? "Music Paused" : "Waiting for lyrics..."}
          </p>
        )}
      </main>

      {/* BACKGROUND IMAGE GRID */}
      <ImageBox data={imageHistory[3]} opacity={0.7} /> 
      <ImageBox data={imageHistory[6]} opacity={0.5} /> 
      <ImageBox data={imageHistory[5]} opacity={0.6} /> 
      <ImageBox data={imageHistory[4]} opacity={0.7} /> 
    </div>
  );
}