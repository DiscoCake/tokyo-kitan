// Fetches scene-matched photos from Pexels via the server proxy (/api/image).
// Server appends "japan" to every query for relevance and caches results in memory.
// Returns null on any error; ui.js shows a dark gradient fallback in that case.
export async function pickImage(query) {
  try {
    const q = (query || 'tokyo cityscape').trim();
    const res = await fetch(`/api/image?q=${encodeURIComponent(q)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.url || null;
  } catch {
    return null;
  }
}
