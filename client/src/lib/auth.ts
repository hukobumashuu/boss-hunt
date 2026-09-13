const STORAGE_KEY = 'boss-tracker-token';

/**
 * Runs once on app load. If the URL has ?token=, that's a fresh bookmark
 * link - save it and clean the URL so the token doesn't linger in the
 * address bar (someone screenshotting the tab, or the browser's own
 * history, shouldn't casually expose it). Otherwise fall back to
 * whatever's already saved from a previous visit.
 */
export function bootstrapToken(): string | null {
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get('token');

  if (fromUrl) {
    localStorage.setItem(STORAGE_KEY, fromUrl);
    url.searchParams.delete('token');
    window.history.replaceState({}, '', url.toString());
    return fromUrl;
  }

  return localStorage.getItem(STORAGE_KEY);
}

export function clearToken(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getToken(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}
