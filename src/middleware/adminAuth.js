// src/middleware/adminAuth.js
// Protects the backend manager endpoints with one shared owner token.
// This is intentionally separate from user auth: the manager is for the Nana team,
// not for parents or doctors using the public app.

const { ADMIN_MANAGER_TOKEN } = process.env;

export function requireAdmin(req, res, next) {
  if (!ADMIN_MANAGER_TOKEN) {
    return res.status(503).json({ error: "Admin manager is not configured." });
  }

  const rawHeader = req.headers.authorization || req.headers["x-admin-token"] || "";
  const token = String(rawHeader).startsWith("Bearer ")
    ? String(rawHeader).slice(7)
    : String(rawHeader);

  if (token !== ADMIN_MANAGER_TOKEN) {
    return res.status(401).json({ error: "Invalid admin manager token." });
  }

  next();
}
