// src/routes/painLogs.js
// Pain log entries — each log captures what the body map screen collects.
//
// GET    /api/pain-logs?child_id=X          — list logs for a child
// POST   /api/pain-logs                     — create a new pain log
// GET    /api/pain-logs/:id                 — get a single log (with zones)
// DELETE /api/pain-logs/:id                 — delete a log

import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// Valid zone names (must match ShowpainScreen.js zone IDs)
const VALID_ZONES = new Set([
  // Front
  "head", "neck", "chest", "abdomen", "hips",
  "left-arm", "right-arm", "left-forearm", "right-forearm",
  "left-hand", "right-hand", "left-thigh", "right-thigh",
  "left-shin", "right-shin", "left-foot", "right-foot",
  // Back
  "back-head", "back-neck", "upper-back", "lower-back", "glutes",
  "left-shoulder", "right-shoulder", "back-left-forearm", "back-right-forearm",
  "back-left-hand", "back-right-hand", "left-hamstring", "right-hamstring",
  "left-calf", "right-calf", "left-heel", "right-heel",
  "tummy", "left-hip", "right-hip", "left-glute", "right-glute",
  "left-upper-arm", "right-upper-arm", "left-knee", "right-knee",
  "left-back-knee", "right-back-knee", "left-ankle", "right-ankle",
]);

const VALID_PAIN_LEVELS = [0, 1, 2, 3, 4]; // maps to the 5 colour states
const VALID_PAIN_TYPES = new Set([
  "sharp",
  "burning",
  "throbbing",
  "tingling",
  "stabbing",
  "cramping",
  "aching",
  "other",
  "dull",
]);

function cleanText(value, max = 160) {
  const text = String(value || "").trim();
  return text.length > max ? text.slice(0, max) : text;
}

// ── List logs for a child ─────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const { child_id } = req.query;

  if (!child_id) {
    return res.status(400).json({ error: "child_id query param is required." });
  }

  // Verify the parent owns this child
  const { data: child } = await supabase
    .from("children")
    .select("id")
    .eq("id", child_id)
    .eq("parent_id", req.user.id)
    .single();

  if (!child) {
    return res.status(403).json({ error: "Child not found or not authorised." });
  }

  const { data, error } = await supabase
    .from("pain_logs")
    .select(`
      id,
      child_id,
      pain_type,
      when_did_it_start,
      pain_scale,
      notes,
      created_at,
      pain_zones ( zone_id, side, pain_level )
    `)
    .eq("child_id", child_id)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// ── Create ────────────────────────────────────────────────────────────────────
// Body:
// {
//   child_id: "uuid",
//   zones: [{ zone_id: "head", side: "front", pain_level: 2 }, ...],
//   pain_type: "sharp" | "burning" | "throbbing" | "tingling" | "stabbing" | "cramping" | "aching" | "other",
//   when_did_it_start: "after-play",   // app answer id or ISO string
//   pain_scale: 3,       // 1–10
//   notes: "optional free text"
// }
router.post("/", async (req, res) => {
  const { child_id, zones, pain_type, when_did_it_start, pain_scale, notes } = req.body;

  if (!child_id || !Array.isArray(zones)) {
    return res.status(400).json({ error: "child_id and zones array are required." });
  }

  // Validate ownership
  const { data: child } = await supabase
    .from("children")
    .select("id")
    .eq("id", child_id)
    .eq("parent_id", req.user.id)
    .single();

  if (!child) {
    return res.status(403).json({ error: "Child not found or not authorised." });
  }

  // Validate zones
  for (const z of zones) {
    if (!VALID_ZONES.has(z.zone_id)) {
      return res.status(400).json({ error: `Invalid zone_id: "${z.zone_id}"` });
    }
    if (!VALID_PAIN_LEVELS.includes(z.pain_level)) {
      return res.status(400).json({
        error: `pain_level must be 0–4, got ${z.pain_level} for zone "${z.zone_id}"`,
      });
    }
    if (!["front", "back"].includes(z.side)) {
      return res.status(400).json({ error: `side must be "front" or "back" for zone "${z.zone_id}"` });
    }
  }

  if (pain_scale !== undefined && (typeof pain_scale !== "number" || pain_scale < 0 || pain_scale > 10)) {
    return res.status(400).json({ error: "pain_scale must be a number between 0 and 10." });
  }

  const normalizedPainType = cleanText(pain_type, 40).toLowerCase();
  if (normalizedPainType && !VALID_PAIN_TYPES.has(normalizedPainType)) {
    return res.status(400).json({ error: `Invalid pain_type: "${pain_type}"` });
  }

  // Insert the log header
  const { data: log, error: logError } = await supabase
    .from("pain_logs")
    .insert({
      child_id,
      parent_id: req.user.id,
      pain_type: normalizedPainType || null,
      when_did_it_start: cleanText(when_did_it_start, 80) || null,
      pain_scale: pain_scale ?? null,
      notes: notes?.trim() ?? null,
    })
    .select()
    .single();

  if (logError) return res.status(500).json({ error: logError.message });

  // Insert zone rows
  const zoneRows = zones.map((z) => ({
    pain_log_id: log.id,
    zone_id: z.zone_id,
    side: z.side,
    pain_level: z.pain_level,
  }));

  if (!zoneRows.length) {
    return res.status(201).json({ ...log, pain_zones: [] });
  }

  const { error: zoneError } = await supabase.from("pain_zones").insert(zoneRows);

  if (zoneError) {
    // Roll back the log header
    await supabase.from("pain_logs").delete().eq("id", log.id);
    return res.status(500).json({ error: "Failed to save pain zones." });
  }

  return res.status(201).json({ ...log, pain_zones: zoneRows });
});

// ── Get one ───────────────────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("pain_logs")
    .select(`
      id, child_id, pain_type, when_did_it_start, pain_scale, notes, created_at,
      pain_zones ( zone_id, side, pain_level )
    `)
    .eq("id", req.params.id)
    .eq("parent_id", req.user.id)
    .single();

  if (error || !data) return res.status(404).json({ error: "Pain log not found." });
  return res.json(data);
});

// ── Delete ────────────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  // pain_zones are deleted via ON DELETE CASCADE in the migration
  const { error } = await supabase
    .from("pain_logs")
    .delete()
    .eq("id", req.params.id)
    .eq("parent_id", req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(204).send();
});

export default router;
