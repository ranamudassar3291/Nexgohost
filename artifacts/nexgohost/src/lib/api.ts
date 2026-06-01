/**
 * Shared API fetch utility.
 * Reads auth token from `token` (primary) or `noehost_token` (fallback).
 * On 401 Unauthorized → clears tokens and redirects to admin login.
 */

function getToken(): string {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("noehost_token") ||
    ""
  );
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

  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("noehost_token");
    const adminSlug = import.meta.env.VITE_ADMIN_SLUG || "noe";
    const currentPath = window.location.pathname;
    if (currentPath.startsWith("/admin")) {
      window.location.href = `/admin/${adminSlug}`;
    }
    throw new Error("Session expired. Please log in again.");
  }

  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.message || data.error || `Request failed (${res.status})`);
  return data;
}

export async function apiFetchAdmin(url: string, opts?: RequestInit): Promise<any> {
  return apiFetch(url, opts);
}
