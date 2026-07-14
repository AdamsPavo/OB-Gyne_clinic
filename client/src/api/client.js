// The local Express server is used by both Vite and the Electron renderer.
// Override only for a deployed API by setting VITE_API_URL.
const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api";

export async function api(path, options = {}) {
  const token = localStorage.getItem("obgyn_token");
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
    ...options,
  });
  const contentType = response.headers.get("content-type") || "";
  const data = response.status === 204 ? null : contentType.includes("application/json") ? await response.json() : null;
  if (!contentType.includes("application/json") && response.status !== 204) {
    throw new Error("The clinic API is unavailable. Start the server on port 5000, then refresh this page.");
  }
  if (!response.ok) throw new Error(data?.message || "Something went wrong.");
  return data;
}
