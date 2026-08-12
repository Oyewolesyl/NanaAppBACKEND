/*
  handover: backend entry point
  - this express app is the single public API for Nana.
  - normal app requests come from the Vercel frontend and use user auth tokens.
  - private manager requests come from the backend manager and use ADMIN_MANAGER_TOKEN.
  - Supabase credentials stay server-side. if browser requests fail, first check CORS env vars: FRONTEND_URL and MANAGER_URL.
*/
// src/index.js - Nana App Backend
import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import childrenRoutes from "./routes/children.js";
import painLogsRoutes from "./routes/painLogs.js";
import uploadsRoutes from "./routes/uploads.js";
import adminRoutes from "./routes/admin.js";
import assistantRoutes from "./routes/assistant.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

// Allow the Vercel frontend, the private manager, and localhost during development.
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.MANAGER_URL,
  "https://nanabackendmanager.vercel.app",
  "https://nana-app-frontend.vercel.app",
  "https://nana-app-frontend-i28e.vercel.app",
  "http://localhost:5173",
  "http://localhost:4173",
].filter(Boolean);

const allowedOriginPatterns = [
  /^https:\/\/nanabackendmanager(?:-[a-z0-9-]+)?\.vercel\.app$/i,
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin === "null") return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (allowedOriginPatterns.some((pattern) => pattern.test(origin))) {
        return callback(null, true);
      }
      callback(new Error(`CORS: Origin "${origin}" not allowed.`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/children", childrenRoutes);
app.use("/api/pain-logs", painLogsRoutes);
app.use("/api/uploads", uploadsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", assistantRoutes);

app.use((_req, res) => res.status(404).json({ error: "Not found." }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message ?? "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`Nana backend running on http://localhost:${PORT}`);
});
