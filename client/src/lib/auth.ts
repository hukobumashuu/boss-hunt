const STORAGE_KEY = "boss-tracker-token";

export function bootstrapToken(): string | null {
  const url = new URL(window.location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const fromUrl = fragment.get("token");

  if (fromUrl) {
    localStorage.setItem(STORAGE_KEY, fromUrl);
    url.hash = "";
    window.history.replaceState({}, "", url.toString());
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
