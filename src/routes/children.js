// src/routes/children.js
// Full CRUD for a parent's children.
//
// GET    /api/children          — list all children for the signed-in parent
// POST   /api/children          — add a child
// GET    /api/children/:id      — get one child
// PATCH  /api/children/:id      — update a child
// DELETE /api/children/:id      — remove a child

import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// All routes require authentication
router.use(requireAuth);

// ── List ──────────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("children")
    .select("id, name, age, photo_url, created_at")
    .eq("parent_id", req.user.id)
    .order("created_at", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// ── Create ────────────────────────────────────────────────────────────────────
// Body: { name, age, photo_url? }
router.post("/", async (req, res) => {
  const { name, age, photo_url } = req.body;

  if (!name || age == null) {
    return res.status(400).json({ error: "name and age are required." });
  }

  if (typeof age !== "number" || age < 1 || age > 18) {
    return res.status(400).json({ error: "age must be a number between 1 and 18." });
  }

  const { data, error } = await supabase
    .from("children")
    .insert({
      parent_id: req.user.id,
      name: name.trim(),
      age,
      photo_url: photo_url ?? null,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
});

// ── Get one ───────────────────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("children")
    .select("id, name, age, photo_url, created_at")
    .eq("id", req.params.id)
    .eq("parent_id", req.user.id)   // ownership check
    .single();

  if (error || !data) return res.status(404).json({ error: "Child not found." });
  return res.json(data);
});

// ── Update ────────────────────────────────────────────────────────────────────
// Body: { name?, age?, photo_url? }
router.patch("/:id", async (req, res) => {
  const { name, age, photo_url } = req.body;

  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (age !== undefined) {
    if (typeof age !== "number" || age < 1 || age > 18) {
      return res.status(400).json({ error: "age must be a number between 1 and 18." });
    }
    updates.age = age;
  }
  if (photo_url !== undefined) updates.photo_url = photo_url;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No valid fields to update." });
  }

  const { data, error } = await supabase
    .from("children")
    .update(updates)
    .eq("id", req.params.id)
    .eq("parent_id", req.user.id)
    .select()
    .single();

  if (error || !data) return res.status(404).json({ error: "Child not found or not authorised." });
  return res.json(data);
});

// ── Delete ────────────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  const { error } = await supabase
    .from("children")
    .delete()
    .eq("id", req.params.id)
    .eq("parent_id", req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(204).send();
});

export default router;
