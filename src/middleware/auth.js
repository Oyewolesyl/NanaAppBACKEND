// src/middleware/auth.js
// Verifies the Supabase JWT sent in the Authorization header.
// Attaches req.user = { id, email, role } on success.

import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header." });
  }

  const token = authHeader.slice(7);

  // Use anon key + user JWT to verify — Supabase validates the token
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: { user }, error } = await client.auth.getUser();

  if (error || !user) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }

  req.user = {
    id: user.id,
    email: user.email,
    role: user.user_metadata?.role ?? null,
  };

  next();
}
