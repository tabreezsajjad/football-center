// Keep provider images on the expected HTTPS asset hosts.
export function crestUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      ['crests.football-data.org', 'a.espncdn.com'].includes(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
