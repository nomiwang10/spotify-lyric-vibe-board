// MUST match your backend URL exactly
const API_BASE = "http://127.0.0.1:8000/api";

export async function getCurrentTrack() {
  const res = await fetch(`${API_BASE}/current-song`);
  return res.json();
}

export function parseGeniusLyrics(rawText) {
  if (!rawText) return [];

  // Split text, remove empty lines, and remove "Junk" headers
  const lines = rawText
    .split("\n")
    .map(line => line.trim())
    .filter(line => 
      line.length > 0 &&                 // No empty lines
      !line.startsWith("[") &&           // No [Chorus], [Verse]
      !line.toLowerCase().includes("lyrics") // No "Song Name Lyrics" headers
    );

  // Assign each line a 5-second duration
  return lines.map((line, index) => {
    return {
      id: index,
      text: line,
      timestamp_ms: index * 5000
    };
  });
}

export async function getTranslationVibe(id, text, targetLanguage = "English") {
  const payload = {
    lines: [{ timestamp_ms: 0, text: text }],
    targetLanguage: targetLanguage,
  };

  const res = await fetch(`${API_BASE}/analyze-lyrics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  return {
    id: id,
    translated: data.translated_lines[0].text,
    emotion: data.vibe_keywords[0] || "neutral",
    themes: data.vibe_keywords,
    colors: data.colors,
    imagePrompt: `A ${data.vibe_keywords.join(", ")} scene representing: ${text}`,
  };
}

export async function getVibeImage(id, colors, imagePrompt) {
  const payload = {
    lyric_lines: [imagePrompt],
    emotion: "artistic",
    themes: ["music", "vibe"],
    style: "digital art",
  };

  const res = await fetch(`${API_BASE}/ai-image/generate-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  return {
    imageUrl: data.image_data_url,
  };
}