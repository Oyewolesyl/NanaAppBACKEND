// src/api.js — Nana App Frontend API Client
// Drop this file into your front-end src/ folder.
// Usage: import { api } from "./api.js";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

// ── Token helpers ─────────────────────────────────────────────────────────────
export const auth = {
  getToken: ()  => localStorage.getItem("nana_access_token"),
  setToken: (t) => localStorage.setItem("nana_access_token", t),
  clear:    ()  => { localStorage.removeItem("nana_access_token"); localStorage.removeItem("nana_refresh_token"); },
};

// ── Core fetch wrapper ────────────────────────────────────────────────────────
async function request(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  const token = auth.getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Request failed: ${res.status}`);
  return json;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const api = {
  auth: {
    async register({ email, password, role, full_name }) {
      return request("POST", "/api/auth/register", { email, password, role, full_name });
    },
    async login({ email, password }) {
      const data = await request("POST", "/api/auth/login", { email, password });
      auth.setToken(data.access_token);
      localStorage.setItem("nana_refresh_token", data.refresh_token);
      return data;
    },
    async logout() {
      auth.clear();
    },
    async me() {
      return request("GET", "/api/auth/me");
    },
  },

  // ── Children ────────────────────────────────────────────────────────────────
  children: {
    list()                  { return request("GET", "/api/children"); },
    get(id)                 { return request("GET", `/api/children/${id}`); },
    create({ name, age, photo_url }) {
      return request("POST", "/api/children", { name, age, photo_url });
    },
    update(id, fields)      { return request("PATCH", `/api/children/${id}`, fields); },
    remove(id)              { return request("DELETE", `/api/children/${id}`); },
  },

  // ── Pain logs ───────────────────────────────────────────────────────────────
  painLogs: {
    list(child_id)          { return request("GET", `/api/pain-logs?child_id=${child_id}`); },
    get(id)                 { return request("GET", `/api/pain-logs/${id}`); },
    create(payload)         { return request("POST", "/api/pain-logs", payload); },
    remove(id)              { return request("DELETE", `/api/pain-logs/${id}`); },
  },

  // ── Uploads ─────────────────────────────────────────────────────────────────
  uploads: {
    // Pass a File object from <input type="file">
    async childPhoto(file) {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      return request("POST", "/api/uploads/child-photo", { data_url: dataUrl });
    },
  },
};
