// frontend/src/components/VibeBoard.jsx

import { useState, useEffect, useRef } from "react"; 
import {
    getCurrentTrack,
    parseGeniusLyrics,
    getTranslationVibe, 
    getVibeImage,      
} from "../api/vibeApi";

export default function VibeBoard() {
    // ... (State and Refs remain the same as previous fix)
    const [track, setTrack] = useState(null);
    const [lyrics, setLyrics] = useState([]); 
    const [translationData, setTranslationData] = useState(null); 
    const [currentLine, setCurrentLine] = useState(null); 
    const [backgroundImage, setBackgroundImage] = useState("");
    const [targetLanguage, setTargetLanguage] = useState("English");
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState(null);
    const lyricsRef = useRef(lyrics);
    const scrollRef = useRef(null); // 💡 NEW: Ref for the scrolling container

    // ... (EFFECT 0, FUNCTION 1, EFFECT 1, EFFECT 2, EFFECT 3 remain the same)
    
    useEffect(() => {
        lyricsRef.current = lyrics;
    }, [lyrics]); 

    function handleConnect() {
        window.location.href = "http://127.0.0.1:8000/auth/login";
    }

    // --- EFFECT 1: Poll Spotify (Timing/Sync Logic) ---
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
                const currentTimeMs = trackData.progress_ms; 
                
                const currentLyrics = lyricsRef.current;
                let activeLine = null;

                for (let i = currentLyrics.length - 1; i >= 0; i--) {
                    const line = currentLyrics[i];
                    if (line.timestamp_ms <= currentTimeMs) {
                        activeLine = line;
                        break;
                    }
                }

                if (activeLine && activeLine.id !== currentLine?.id) {
                    setCurrentLine(activeLine);
                }
            } catch (err) {
                console.error(err);
            }
        }, 1000);
        return () => clearInterval(interval); 
    }, [isConnected, currentLine]); 

    // --- EFFECT 2: Fetch AI Data (Lyrics, Vibe, Image) ---
    useEffect(() => {
        const currentLyrics = track?.lyrics;
        const currentTrackId = track?.track_id; 

        if (!currentLyrics || !currentTrackId) return;

        const processedLyrics = parseGeniusLyrics(currentLyrics);
        
        if (processedLyrics.length > 0) {
            setLyrics(processedLyrics); 
            setCurrentLine(null); 
        } else {
            setLyrics([]);
            setTranslationData(null);
            setCurrentLine(null);
            setBackgroundImage("");
            return;
        }

        const fetchVibeData = async () => {
            try {
                const vibeData = await getTranslationVibe(
                    processedLyrics, 
                    targetLanguage
                );
                
                setTranslationData(vibeData); 

                const imageData = await getVibeImage(
                    currentTrackId, 
                    vibeData.colors,
                    vibeData.imagePrompt
                );
                setBackgroundImage(imageData.imageUrl);
            } catch (e) {
                console.error("AI Fetch Error:", e);
            }
        };

        fetchVibeData();
        
    }, [track?.lyrics, track?.track_id, targetLanguage]); 

    // --- EFFECT 4: Scroll the active line into view (NEW) ---
    useEffect(() => {
        if (currentLine && scrollRef.current) {
            const activeElement = document.getElementById(`lyric-${currentLine.id}`);
            if (activeElement) {
                activeElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center', // Centers the line in the view
                });
            }
        }
    }, [currentLine]);

    // --- HELPER FUNCTION: Find the translated line for display ---
    const getTranslatedLine = (lineId) => {
        return translationData?.translatedLines?.[lineId]?.text || '...';
    }

    // --- RETURN JSX (Display Logic) ---
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
            // Spotify-like layout wrapper
            position: 'relative',
        }}
        >
            {/* Header, Language selector, and Vibe/Color Display remain the same, 
                but we'll adjust the vibe display to be centered below the lyrics. */}

            <header style={{ position: "absolute", top: 20, left: 20 }}>
                {track ? (
                    <>
                        <h2 style={{margin: 0}}>{track.song}</h2>
                        <p style={{margin: 0, opacity: 0.7}}>{track.artist}</p>
                    </>
                ) : (
                    <h2>No track playing</h2>
                )}
            </header>
            
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
            
            <main style={{ 
                display: "flex", 
                width: "80%", 
                height: "70vh", 
                marginTop: "100px",
                maxWidth: "1200px",
                background: "rgba(0,0,0,0.2)",
                borderRadius: "10px",
                overflow: "hidden", // Hide scrollbars initially
            }}>
                
                {!isConnected ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                    </div>
                ) : error ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <p style={{ fontSize: "1.5rem" }}>{error}</p>
                    </div>
                ) : (
                    <>
                        <div 
                            ref={scrollRef} // 💡 Attach ref for auto-scrolling
                            style={{ 
                                flex: 1, 
                                overflowY: 'auto', 
                                padding: '20px', 
                                height: '100%',
                                scrollbarWidth: 'none', // Hide scrollbar in Firefox
                                msOverflowStyle: 'none', // Hide scrollbar in IE/Edge
                            }}
                        >
                            {/* Original Lyrics Panel */}
                            <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.3)', paddingBottom: '10px' }}>Original Lyrics</h3>
                            {lyrics.length > 0 ? lyrics.map((line) => {
                                const isHighlighted = currentLine?.id === line.id;
                                const isEmptyLine = !line.text.trim();
                                return (
                                    <p
                                        key={line.id}
                                        id={`lyric-${line.id}`} // Used for scrolling
                                        style={{
                                            fontSize: "1.8rem",
                                            marginBottom: "25px",
                                            fontWeight: isHighlighted ? "bold" : "normal",
                                            opacity: isHighlighted ? 1 : 0.4,
                                            transition: 'opacity 0.5s ease, font-weight 0.5s ease',
                                            minHeight: isEmptyLine ? '0.5rem' : 'auto', // Keep empty lines small
                                        }}
                                    >
                                        {line.text || (isEmptyLine ? '🎶' : '')}
                                    </p>
                                );
                            }) : <p style={{ fontSize: "1.5rem" }}>Play a song on Spotify!</p>}
                        </div>

                        <div style={{ 
                            flex: 1, 
                            overflowY: 'auto', 
                            padding: '20px', 
                            height: '100%', 
                            borderLeft: '1px solid rgba(255,255,255,0.3)',
                            scrollbarWidth: 'none', 
                            msOverflowStyle: 'none',
                        }}>
                            {/* Translated Lyrics Panel */}
                            <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.3)', paddingBottom: '10px' }}>{targetLanguage} Translation</h3>
                            {lyrics.length > 0 ? lyrics.map((line) => {
                                const isHighlighted = currentLine?.id === line.id;
                                const translatedText = getTranslatedLine(line.id);
                                const isEmptyLine = !line.text.trim();
                                return (
                                    <p
                                        key={`trans-${line.id}`}
                                        style={{
                                            fontSize: "1.8rem",
                                            marginBottom: "25px",
                                            fontWeight: isHighlighted ? "bold" : "normal",
                                            opacity: isHighlighted ? 1 : 0.4,
                                            transition: 'opacity 0.5s ease, font-weight 0.5s ease',
                                            minHeight: isEmptyLine ? '0.5rem' : 'auto',
                                            color: translationData ? 'white' : 'rgba(255, 255, 255, 0.6)'
                                        }}
                                    >
                                        {/* Display translation or a loading message */}
                                        {translationData 
                                            ? (translatedText !== '...' ? translatedText : (isEmptyLine ? '🎶' : ''))
                                            : (line.text.trim() ? "Translating..." : (isEmptyLine ? '🎶' : ''))
                                        }
                                    </p>
                                );
                            }) : <p style={{ fontSize: "1.5rem" }}>Waiting for translation...</p>}
                        </div>
                    </>
                )}
            </main>

            {/* Display Vibe/Color BELOW the lyrics panels */}
            {translationData && (
                <div style={{ marginTop: "30px", textAlign: 'center' }}>
                    <span
                        style={{
                            background: "rgba(255,255,255,0.2)",
                            padding: "8px 16px",
                            borderRadius: "20px",
                            marginRight: "10px",
                        }}
                    >
                        {translationData.emotion}
                    </span>
                    {translationData.themes?.map((theme) => (
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
        </div>
    );
}