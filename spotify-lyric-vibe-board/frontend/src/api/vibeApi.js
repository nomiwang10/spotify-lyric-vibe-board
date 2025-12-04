// --- 1. THE PORT FIX ---
// We must use 8888 because that is what Aspyn's Spotify Redirect URI uses.
const API_BASE = "http://localhost:8888/api";

// --- 2. CONNECT TO ASPYN (Spotify) ---
export async function getCurrentTrack() {
  // Aspyn's endpoint is "/current-song", not "/current-track"
  const res = await fetch(`${API_BASE}/current-song`);
  return res.json();
}

// --- 3. MOCK LYRICS (Until Aspyn finishes Genius API) ---
// Elif's frontend crashes if it doesn't get a list of timestamped lines.
// Since Aspyn currently only returns a string, we FAKE the timestamps here
// so you can test your translation and Vibe Board immediately.
export async function getLyrics(trackId) {
  // This is hardcoded for testing. 
  // Later, you will replace this with a real fetch call.
  return [
    { id: 1, text: "Wait for the song to start...", startMs: 0, endMs: 5000 },
    { id: 2, text: "Hello from the other side", startMs: 5000, endMs: 10000 },
    { id: 3, text: "I must have called a thousand times", startMs: 10000, endMs: 15000 },
    { id: 4, text: "To tell you I'm sorry", startMs: 15000, endMs: 20000 },
    { id: 5, text: "For everything that I've done", startMs: 20000, endMs: 25000 },
    { id: 6, text: "But when I call you never seem to be home", startMs: 25000, endMs: 30000 },
  ];
}

// --- 4. CONNECT TO EVA (AI Text) ---
export async function getTranslationVibe(id, text, targetLanguage = "English") {
  // PROBLEM: Elif sends 1 line. Your Python API wants a LIST of lines.
  // FIX: We wrap her single line into a list before sending.
  const payload = {
    lines: [
      { timestamp_ms: 0, text: text } 
    ],
    targetLanguage: targetLanguage // Matches your Python Pydantic model
  };

  const res = await fetch(`${API_BASE}/analyze-lyrics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  // PROBLEM: Your API returns { translated_lines, vibe_keywords, ... }
  // Elif expects { translated, emotion, themes ... }
  // FIX: We map your response back to what she expects.
  return {
    id: id,
    translated: data.translated_lines[0].text, 
    emotion: data.vibe_keywords[0] || "neutral",
    themes: data.vibe_keywords,
    colors: data.colors,
    imagePrompt: `A ${data.vibe_keywords.join(", ")} scene representing: ${text}`
  };
}

// --- 5. CONNECT TO NOMI (AI Image) ---
export async function getVibeImage(id, colors, imagePrompt) {
  // Nomi's API expects specific fields like "lyric_lines" and "emotion"
  const payload = {
    lyric_lines: [imagePrompt], 
    emotion: "artistic", 
    themes: ["music", "vibe"],
    style: "digital art"
  };

  const res = await fetch(`${API_BASE}/ai-image/generate-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  // Return the base64 URL that Nomi generates
  return {
    imageUrl: data.image_data_url
  };
}