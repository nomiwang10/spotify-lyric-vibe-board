const API_BASE = "http://127.0.0.1:8000/api";

export async function getCurrentTrack() {
  try {
    const res = await fetch(`${API_BASE}/current-song`);
    return await res.json();
  } catch (err) {
    return { error: "Failed to connect to backend" };
  }
}

export function parseGeniusLyrics(rawLyrics) {
    if (!rawLyrics) return [];

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
  return data.results; 
}

// --- FIX IS HERE ---
// We now accept 'text' and 'vibe' specifically
export async function getVibeImage(text, vibe) {
  const payload = {
    lyric_lines: [text],   // Send the raw lyric line
    emotion: vibe,         // Send the REAL vibe (e.g. "Sad", "Energetic")
    themes: ["music", "abstract"],
    style: "digital art, abstract, vibe board",
  };

  const res = await fetch(`${API_BASE}/ai-image/generate-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  return { imageUrl: data.image_data_url };
}