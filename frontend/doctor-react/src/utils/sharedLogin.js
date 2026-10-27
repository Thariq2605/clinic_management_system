export function resolveSharedLoginUrl(configured, development) {
  if (configured) {
    try {
      const url = new URL(configured, window.location.origin);
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString();
    } catch { /* Use the environment fallback for malformed configuration. */ }
  }
  if (development) return 'http://127.0.0.1:5504/';
  return new URL('../login.html', window.location.href).toString();
}
