// The local Express server is used by both Vite and the Electron renderer.
// Override only for a deployed API by setting VITE_API_URL.
const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api";

export async function api(path, options = {}) {
  const token = localStorage.getItem("obgyn_token");

  const {
    headers: customHeaders = {},
    body,
    ...requestOptions
  } = options;

  const headers = {
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...customHeaders,
  };

  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...requestOptions,
      headers,
      body,
    });
  } catch (error) {
    throw new Error(
      "The clinic API is unavailable. Make sure the server is running on port 5000, then refresh the page."
    );
  }

  const contentType = response.headers.get("content-type") || "";

  let data = null;

  if (response.status !== 204) {
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();

      throw new Error(
        text ||
          "The server returned an invalid response. Check the backend terminal for errors."
      );
    }
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Request failed with status ${response.status}.`
    );
  }

  return data;
}