// MUST match your backend URL exactly
const API_BASE = "http://127.0.0.1:8000/api";

export async function getCurrentTrack() {
  const res = await fetch(`${API_BASE}/current-song`);
  return res.json();
}

export function parseGeniusLyrics(rawLyrics) {
    if (!rawLyrics) return [];

    const lines = rawLyrics.split('\n');
    let lyricId = 0;

    const processed = lines
        .map(line => {
            // Regex to find the timestamp format [MM:SS:ms]
            const match = line.match(/^\[(\d{2}):(\d{2}):(\d{2})\]\s*(.*)$/);

            if (match) {
                const [, mm, ss, ms, text] = match;
                // Calculate total milliseconds
                const timestamp_ms = 
                    (parseInt(mm, 10) * 60 * 1000) + 
                    (parseInt(ss, 10) * 1000) + 
                    (parseInt(ms, 10) * 10);
                
                return {
                    id: lyricId++,
                    timestamp_ms: timestamp_ms,
                    text: text.trim(),
                    raw: line,
                };
            }
            return null; // Ignore lines that don't match the timestamp format
        })
        .filter(line => {
            // 🛑 CORE FILTERING LOGIC
            if (!line) return false;
            
            const text = line.text;
            const lowerText = text.toLowerCase();

            // 1. Filter lines that are clearly metadata or section headers
            if (
                lowerText.includes('contributor') ||
                lowerText.includes('producer') ||
                lowerText.includes('written by') ||
                lowerText.includes('lyrics') ||
                lowerText.startsWith('[') && lowerText.endsWith(']') || // [Chorus], [Verse 1]
                text.length < 3 // Too short to be a meaningful lyric
            ) {
                return false;
            }
            // 2. Keep only valid, clean lines
            return true;
        });

    return processed;
}

// *** CHANGE 1: Update function to accept and send the entire lyrics list ***
export async function getTranslationVibe(lyricsList, targetLanguage = "English") {
  
    // The payload now contains the entire list of lines
    const payload = {
        lines: lyricsList, 
        targetLanguage: targetLanguage,
    };

    console.log(`Sending ${lyricsList.length} lines to AI for translation...`);

    const res = await fetch(`${API_BASE}/analyze-lyrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    const data = await res.json();
    
    // *** CHANGE 2: The backend returns the full translated list + vibe/colors
    // We restructure the returned data to include the full list.
    return {
        translatedLines: data.translated_lines, // The FULL translated list
        emotion: data.vibe_keywords[0] || "neutral",
        themes: data.vibe_keywords,
        colors: data.colors,
        // Create an image prompt based on the overall vibe of the whole song/section
        imagePrompt: `A ${data.vibe_keywords.join(", ")} scene representing the mood of the song's lyrics.`,
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