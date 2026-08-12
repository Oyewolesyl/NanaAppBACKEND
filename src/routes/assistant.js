/*
  handover: nana assistant routes
  - this route turns report data into caregiver-friendly decision support: summary, follow-up checks, watch items, and handoff text.
  - it must not diagnose. keep the language framed as support for caregiver/professional conversations.
  - if a true LLM provider is added later, keep this same safety boundary and keep deterministic fallback text for outages.
*/
// src/routes/assistant.js
// Server-side Nana Assistant endpoint used by the app chat UI.
// It gives structured, safety-aware guidance from the report payload without
// exposing database secrets or making medical diagnoses.

import { Router } from "express";

const router = Router();

const RED_FLAGS = [
  "fever",
  "vomiting",
  "dizzy",
  "dizziness",
  "breathing",
  "chest pain",
  "faint",
  "unusual tiredness",
  "severe",
];

function text(value) {
  return String(value || "").trim();
}

function childName(report = {}) {
  return text(report.childName || report.child_name || report.children?.name) || "the child";
}

function painScore(report = {}) {
  const score = Number(report.intensity ?? report.pain_scale ?? report.score ?? 0);
  return Number.isFinite(score) ? score : 0;
}

function painType(report = {}) {
  return text(report.painType || report.pain_type || report.type) || "pain";
}

function areas(report = {}) {
  const raw = report.zones || report.areas || report.pain_zones || [];
  const items = Array.isArray(raw)
    ? raw.map((zone) => text(zone.label || zone.zone_id || zone.id || zone)).filter(Boolean)
    : [];

  return items.length ? items.join(", ") : "no exact spot selected";
}

function started(report = {}) {
  return text(report.started || report.when_did_it_start || report.startTime) || "not recorded";
}

function notes(report = {}) {
  return text(report.notes || report.note);
}

function hasRedFlags(report = {}, question = "") {
  const haystack = `${notes(report)} ${question}`.toLowerCase();
  return RED_FLAGS.some((flag) => haystack.includes(flag));
}

function urgency(report = {}, question = "") {
  if (hasRedFlags(report, question)) return "urgent";
  if (painScore(report) >= 7) return "high";
  if (painScore(report) >= 4) return "watch";
  return "routine";
}

function handoff(report = {}) {
  const note = notes(report);
  return `${childName(report)} reported ${painType(report)} around ${areas(report)}. pain score: ${painScore(report) || "not recorded"}/10. started: ${started(report)}.${note ? ` caregiver note: ${note}.` : " no extra caregiver note was added."}`;
}

function compareHistory(report = {}, history = []) {
  const previous = Array.isArray(history) ? history.filter((item) => item && item !== report) : [];
  if (!previous.length) return "there is not enough previous history yet to compare a trend. save another report after a short follow-up so nana can compare score, location, and timing.";

  const current = painScore(report);
  const last = painScore(previous[0]);
  if (!current || !last) return "history exists, but the scores are not complete enough for a clear comparison yet.";
  if (current > last) return `this report is higher than the previous score (${current}/10 now, ${last}/10 before). keep the child comfortable and consider getting trusted adult or professional help if this feels unusual.`;
  if (current < last) return `this report is lower than the previous score (${current}/10 now, ${last}/10 before). continue observing and record another report if it changes.`;
  return `this report matches the previous score (${current}/10). watch whether the same area stays painful or spreads.`;
}

function replyFor(question = "", report = {}, assessment = {}, history = []) {
  const q = question.toLowerCase();
  const level = urgency(report, question);

  if (q.includes("handoff") || q.includes("doctor") || q.includes("share")) {
    return `handoff note: ${handoff(report)} this is decision support only, not a diagnosis.`;
  }

  if (q.includes("watch") || q.includes("look out") || q.includes("red flag")) {
    if (level === "urgent") return "watch closely for fever, vomiting, dizziness, breathing trouble, chest pain, fainting, or unusual tiredness. if any are present or the child seems very unwell, contact local medical help urgently.";
    if (level === "high") return "because the pain score is high, keep the child comfortable, confirm the same spot again, and ask a trusted adult or health professional if the pain is unusual, severe, spreading, or not settling.";
    return "watch whether the pain changes location, increases, affects walking/play/sleep, or comes with fever, vomiting, dizziness, or unusual tiredness.";
  }

  if (q.includes("compare") || q.includes("history") || q.includes("trend")) {
    return compareHistory(report, history);
  }

  if (q.includes("what do") || q.includes("next") || q.includes("plan")) {
    if (level === "urgent") return "next step: do not wait on the app if red flag symptoms are present. contact local medical help or a trusted health professional now.";
    if (level === "high") return "next step: keep the child comfortable, avoid pressure on the painful area, record a follow-up in 30-60 minutes, and prepare the handoff note if speaking to another caregiver or professional.";
    return "next step: reassure the child, note what they were doing when it started, and save another report if the pain changes or continues.";
  }

  return `${childName(report)}'s report says ${painType(report)} around ${areas(report)} with a score of ${painScore(report) || "not recorded"}/10. ${assessment.summary || "nana can explain the report, list what to watch, prepare a handoff, or compare history."}`;
}

router.post("/nana-assistant", (req, res) => {
  const { question = "", report = {}, assessment = {}, history = [] } = req.body || {};
  const reply = replyFor(text(question), report, assessment, history);

  res.json({
    reply,
    urgency: urgency(report, question),
    handoff: handoff(report),
    disclaimer: "nana supports care decisions. it does not diagnose or replace medical help.",
  });
});

export default router;
