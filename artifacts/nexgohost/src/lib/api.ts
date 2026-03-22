/**
 * Shared API fetch utility.
 * Always returns JSON. Guards against "Unexpected token '<'" errors when
 * the server returns an HTML error page instead of JSON.
 */

function getToken(): string {
  return localStorage.getItem("token") || "";
}

async function safeJson(res: Response): Promise<any> {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    throw new Error(
      res.ok
        ? `Unexpected response format from server`
        : `Server error (${res.status})${text ? `: ${text.slice(0, 120)}` : ""}`
    );
  }
  return res.json();
}

export async function apiFetch(url: string, opts?: RequestInit): Promise<any> {
  const token = getToken();
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts?.headers,
    },
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.message || data.error || `Request failed (${res.status})`);
  return data;
}

export async function apiFetchAdmin(url: string, opts?: RequestInit): Promise<any> {
  return apiFetch(url, opts);
}
