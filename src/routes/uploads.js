// src/routes/uploads.js
// POST /api/uploads/child-photo
// Accepts a base64-encoded image and stores it in the "child-photos" Supabase Storage bucket.
// Returns the public URL which can then be saved on the child record.
//
// Why base64 instead of multipart/form-data?
// The vanilla-JS frontend can convert a <input type="file"> to base64 easily
// without any extra dependencies.

import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const BUCKET = "child-photos";
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// POST /api/uploads/child-photo
// Body: { data_url: "data:image/jpeg;base64,..." }
router.post("/child-photo", async (req, res) => {
  const { data_url } = req.body;

  if (!data_url || typeof data_url !== "string") {
    return res.status(400).json({ error: "data_url is required." });
  }

  // Parse the data URL
  const match = data_url.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9+\-.]+);base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ error: "Invalid data_url format." });
  }

  const [, mimeType, base64Data] = match;

  if (!ALLOWED_TYPES.includes(mimeType)) {
    return res.status(400).json({ error: `Unsupported file type: ${mimeType}` });
  }

  const buffer = Buffer.from(base64Data, "base64");

  if (buffer.byteLength > MAX_SIZE_BYTES) {
    return res.status(400).json({ error: "Image must be under 5 MB." });
  }

  const ext = mimeType.split("/")[1].replace("jpeg", "jpg");
  const filename = `${req.user.id}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filename, buffer, { contentType: mimeType, upsert: false });

  if (uploadError) {
    return res.status(500).json({ error: uploadError.message });
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filename);

  return res.status(201).json({ url: urlData.publicUrl });
});

export default router;
