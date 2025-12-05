const API_BASE = "http://127.0.0.1:8000/api";

export async function getCurrentTrack() {
  const res = await fetch(`${API_BASE}/current-song`);
  return res.json();
}

// Helper to clean up Genius text
export function parseGeniusLyrics(rawText) {
  if (!rawText) return [];

  const lines = rawText
    .split("\n")
    .map(line => line.trim())
    .filter(line => 
      line.length > 0 && 
      !line.startsWith("[") && 
      !line.toLowerCase().includes("lyrics")
    );

  return lines.map((line, index) => {
    return {
      id: index,
      text: line,
      startMs: index * 5000,
      endMs: (index + 1) * 5000,
    };
  });
}

export async function getTranslationVibe(lines, targetLanguage = "English") {
  // We strip out the timestamps for the AI to save tokens, just sending ID and Text
  const cleanLines = lines.map(line => ({
    id: line.id,
    text: line.text
  }));

  const payload = {
    lines: cleanLines,
    targetLanguage: targetLanguage
  };

  const res = await fetch(`${API_BASE}/analyze-lyrics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  
  // Return the list of results
  return data.results; 
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
  return { imageUrl: data.image_data_url };
}