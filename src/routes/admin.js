/*
  handover: private admin manager routes
  - these routes are intentionally cross-user so the project owner can manage testers, profiles, children, and reports.
  - access is protected by ADMIN_MANAGER_TOKEN, not by normal user login. never expose this token in frontend app code.
  - child/profile linking is handled carefully to avoid Supabase schema-cache relationship errors between children and profiles.
*/
// src/routes/admin.js
// Small owner-only API used by the Nana backend manager dashboard.
// Keep these routes token-gated: they use the service-role Supabase client and
// can read across users for support, QA, and final submission checks.

import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAdmin } from "../middleware/adminAuth.js";

const router = Router();
router.use(requireAdmin);

const PROFILE_SELECT = "id, role, full_name, created_at";
const CHILD_SELECT = "id, parent_id, name, age, photo_url, created_at";
const PAIN_LOG_SELECT = `
  id,
  child_id,
  parent_id,
  pain_type,
  when_did_it_start,
  pain_scale,
  notes,
  created_at,
  children ( id, name, age, photo_url ),
  pain_zones ( zone_id, side, pain_level )
`;

function errorPayload(error) {
  return {
    message: error.message || "Unknown backend error.",
    code: error.code,
    details: error.details,
    hint: error.hint,
  };
}

function cleanText(value, max = 160) {
  const text = String(value || "").trim();
  return text.length > max ? text.slice(0, max) : text;
}

function cleanRole(value) {
  const role = cleanText(value, 40).toLowerCase();
  if (role === "doctor" || role === "professional") return "doctor";
  return "parent";
}

async function countRows(table) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });

  if (error) throw error;
  return count || 0;
}

async function safeCountRows(table) {
  try {
    return { value: await countRows(table), error: null };
  } catch (error) {
    return { value: 0, error: errorPayload(error) };
  }
}

async function attachParentProfiles(children = []) {
  const parentIds = [...new Set(children.map((child) => child.parent_id).filter(Boolean))];
  if (!parentIds.length) return children;

  const { data: parentProfiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .in("id", parentIds);

  if (error) throw error;

  const parentsById = new Map((parentProfiles || []).map((profile) => [profile.id, profile]));
  return children.map((child) => ({
    ...child,
    parent_profile: parentsById.get(child.parent_id) || null,
  }));
}

router.get("/summary", async (_req, res) => {
  try {
    const [profiles, children, painLogs, highPainResult] = await Promise.all([
      safeCountRows("profiles"),
      safeCountRows("children"),
      safeCountRows("pain_logs"),
      supabase
        .from("pain_logs")
        .select("id", { count: "exact", head: true })
        .gte("pain_scale", 7)
        .then(({ count, error }) => ({
          value: count || 0,
          error: error ? errorPayload(error) : null,
        }))
        .catch((error) => ({ value: 0, error: errorPayload(error) })),
    ]);

    const diagnostics = {
      profiles: profiles.error,
      children: children.error,
      painLogs: painLogs.error,
      highPainLogs: highPainResult.error,
    };

    res.json({
      profiles: profiles.value,
      children: children.value,
      painLogs: painLogs.value,
      highPainLogs: highPainResult.value,
      checkedAt: new Date().toISOString(),
      diagnostics,
    });
  } catch (error) {
    res.status(500).json({ error: error.message, diagnostics: errorPayload(error) });
  }
});

router.get("/profiles", async (req, res) => {
  try {
    const search = cleanText(req.query.search, 80).toLowerCase();
    let query = supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .order("created_at", { ascending: false });

    if (search) query = query.ilike("full_name", `%${search}%`);

    const { data, error } = await query.limit(200);
    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message, diagnostics: errorPayload(error) });
  }
});

router.patch("/profiles/:id", async (req, res) => {
  try {
    const updates = {};

    if (req.body.full_name !== undefined) {
      updates.full_name = cleanText(req.body.full_name, 120) || null;
    }

    if (req.body.role !== undefined) {
      updates.role = cleanRole(req.body.role);
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: "No valid profile fields were provided." });
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", req.params.id)
      .select(PROFILE_SELECT)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message, diagnostics: errorPayload(error) });
  }
});

router.get("/children", async (req, res) => {
  try {
    const search = cleanText(req.query.search, 80).toLowerCase();
    let query = supabase
      .from("children")
      .select(CHILD_SELECT)
      .order("created_at", { ascending: false });

    if (search) query = query.ilike("name", `%${search}%`);

    const { data, error } = await query.limit(200);
    if (error) throw error;

    res.json(await attachParentProfiles(data || []));
  } catch (error) {
    res.status(500).json({ error: error.message, diagnostics: errorPayload(error) });
  }
});

router.post("/children", async (req, res) => {
  try {
    const parentId = cleanText(req.body.parent_id, 80);
    const name = cleanText(req.body.name, 80);
    const age = Number(req.body.age);
    const photoUrl = cleanText(req.body.photo_url, 500) || null;

    if (!parentId) return res.status(400).json({ error: "Choose a parent profile first." });
    if (!name) return res.status(400).json({ error: "Child name cannot be empty." });
    if (!Number.isInteger(age) || age < 1 || age > 18) {
      return res.status(400).json({ error: "Age must be a whole number from 1 to 18." });
    }

    const { data, error } = await supabase
      .from("children")
      .insert({ parent_id: parentId, name, age, photo_url: photoUrl })
      .select(CHILD_SELECT)
      .single();

    if (error) throw error;
    const [child] = await attachParentProfiles([data]);
    res.status(201).json(child);
  } catch (error) {
    res.status(500).json({ error: error.message, diagnostics: errorPayload(error) });
  }
});

router.patch("/children/:id", async (req, res) => {
  try {
    const updates = {};

    if (req.body.name !== undefined) {
      const name = cleanText(req.body.name, 80);
      if (!name) return res.status(400).json({ error: "Child name cannot be empty." });
      updates.name = name;
    }

    if (req.body.age !== undefined) {
      const age = Number(req.body.age);
      if (!Number.isInteger(age) || age < 1 || age > 18) {
        return res.status(400).json({ error: "Age must be a whole number from 1 to 18." });
      }
      updates.age = age;
    }

    if (req.body.photo_url !== undefined) {
      updates.photo_url = cleanText(req.body.photo_url, 500) || null;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: "No valid child fields were provided." });
    }

    const { data, error } = await supabase
      .from("children")
      .update(updates)
      .eq("id", req.params.id)
      .select(CHILD_SELECT)
      .single();

    if (error) throw error;
    const [child] = await attachParentProfiles([data]);
    res.json(child);
  } catch (error) {
    res.status(500).json({ error: error.message, diagnostics: errorPayload(error) });
  }
});

router.delete("/children/:id", async (req, res) => {
  try {
    const { error } = await supabase.from("children").delete().eq("id", req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message, diagnostics: errorPayload(error) });
  }
});

router.get("/pain-logs", async (req, res) => {
  try {
    const search = cleanText(req.query.search, 80).toLowerCase();
    const severity = cleanText(req.query.severity, 20);

    let query = supabase
      .from("pain_logs")
      .select(PAIN_LOG_SELECT)
      .order("created_at", { ascending: false })
      .limit(200);

    if (severity === "high") query = query.gte("pain_scale", 7);
    if (severity === "medium") query = query.gte("pain_scale", 4).lte("pain_scale", 6);
    if (severity === "low") query = query.lte("pain_scale", 3);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []).filter((row) => {
      if (!search) return true;
      const haystack = [
        row.children?.name,
        row.pain_type,
        row.notes,
        row.pain_zones?.map((zone) => zone.zone_id).join(" "),
      ].join(" ").toLowerCase();
      return haystack.includes(search);
    });

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message, diagnostics: errorPayload(error) });
  }
});

router.delete("/pain-logs/:id", async (req, res) => {
  try {
    const { error } = await supabase.from("pain_logs").delete().eq("id", req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message, diagnostics: errorPayload(error) });
  }
});

export default router;
