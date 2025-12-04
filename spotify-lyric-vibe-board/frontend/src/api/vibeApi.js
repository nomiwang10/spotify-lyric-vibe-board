const API_BASE = "http://localhost:8000";

export async function getCurrentTrack() {
  const res = await fetch(`${API_BASE}/api/current-track`);
  return res.json();
}

export async function getLyrics(trackId) {
  const res = await fetch(`${API_BASE}/api/lyrics/${trackId}`);
  return res.json();
}

export async function getTranslationVibe(id, text, targetLanguage = "English") {
  const res = await fetch(`${API_BASE}/api/translate-vibe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, text, targetLanguage }),
  });
  return res.json();
}

export async function getVibeImage(id, colors, imagePrompt) {
  const res = await fetch(`${API_BASE}/api/vibe-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, colors, imagePrompt }),
  });
  return res.json();
}