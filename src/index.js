// src/index.js — Nana App Backend
import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import childrenRoutes from "./routes/children.js";
import painLogsRoutes from "./routes/painLogs.js";
import uploadsRoutes from "./routes/uploads.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allow the Vercel frontend + localhost during development
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:4173",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. Postman, curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: Origin "${origin}" not allowed.`));
    },
    credentials: true,
  })
);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" })); // 10 MB for base64 photo uploads

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/children", childrenRoutes);
app.use("/api/pain-logs", painLogsRoutes);
app.use("/api/uploads", uploadsRoutes);

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: "Not found." }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message ?? "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`Nana backend running on http://localhost:${PORT}`);
});
