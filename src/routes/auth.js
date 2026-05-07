// src/routes/auth.js
// POST /api/auth/register  — create a new account (parent or doctor)
// POST /api/auth/login     — sign in, returns session tokens
// POST /api/auth/logout    — invalidate refresh token
// GET  /api/auth/me        — return current user's profile

import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// ── Register ──────────────────────────────────────────────────────────────────
// Body: { email, password, role: "parent" | "doctor", full_name }
router.post("/register", async (req, res) => {
  const { email, password, role, full_name } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ error: "email, password, and role are required." });
  }

  const validRoles = ["parent", "doctor"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${validRoles.join(", ")}` });
  }

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,          // skip email confirmation in dev
    user_metadata: { role, full_name: full_name ?? "" },
  });

  if (authError) {
    return res.status(400).json({ error: authError.message });
  }

  const userId = authData.user.id;

  // Insert into public.profiles (created by the Supabase migration)
  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ id: userId, role, full_name: full_name ?? "" });

  if (profileError) {
    // Roll back the auth user so the DB stays consistent
    await supabase.auth.admin.deleteUser(userId);
    return res.status(500).json({ error: "Failed to create user profile." });
  }

  return res.status(201).json({
    message: "Account created successfully.",
    user: { id: userId, email, role },
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────
// Body: { email, password }
// Returns: { access_token, refresh_token, user }
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required." });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return res.status(401).json({ error: error.message });
  }

  return res.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    user: {
      id: data.user.id,
      email: data.user.email,
      role: data.user.user_metadata?.role ?? null,
      full_name: data.user.user_metadata?.full_name ?? "",
    },
  });
});

// ── Logout ────────────────────────────────────────────────────────────────────
// Body: { refresh_token }
router.post("/logout", async (req, res) => {
  // Supabase tokens are JWTs; just tell the client to discard them.
  // Optionally we could revoke sessions via the admin API if needed.
  return res.json({ message: "Logged out." });
});

// ── Me ────────────────────────────────────────────────────────────────────────
// Returns the signed-in user's profile row
router.get("/me", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, created_at")
    .eq("id", req.user.id)
    .single();

  if (error) {
    return res.status(404).json({ error: "Profile not found." });
  }

  return res.json({ ...data, email: req.user.email });
});

export default router;
