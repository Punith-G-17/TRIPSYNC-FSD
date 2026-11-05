export const getToken = () => localStorage.getItem('token');

export async function api(path, method = 'GET', body) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

// Downloads a file from a protected route (the JWT can't be sent by a plain <a href>)
export async function download(path, fallbackName) {
  const res = await fetch('/api' + path, { headers: { Authorization: 'Bearer ' + getToken() } });
  if (!res.ok) throw new Error('Download failed');
  const name = (res.headers.get('Content-Disposition') || '').match(/filename="(.+)"/)?.[1] || fallbackName;
  const url = URL.createObjectURL(await res.blob());
  Object.assign(document.createElement('a'), { href: url, download: name }).click();
  URL.revokeObjectURL(url);
}

// "5 minutes ago" from a SQLite UTC timestamp
export function timeAgo(sqlTime) {
  const s = Math.max(0, (Date.now() - new Date(sqlTime.replace(' ', 'T') + 'Z')) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  return Math.floor(s / 86400) + ' d ago';
}
