// Shared eco-demo funnel-event helper, used by every pathway module.
// Fire-and-forget, never blocks or throws into the caller. `meta` must only
// ever contain the small primitive allowlist netlify/functions/
// track-demo-event.js itself enforces server-side (booleans/short ids/
// counts) — NEVER typed answer text or any conversation content. This is
// enforced twice: the server strips any non-allowlisted key regardless of
// what's sent, and every call site here is expected to only pass allowlisted
// fields (reviewed 2026-09-26, requirement #4).
export function trackDemoEvent(event, pathwayId, meta) {
  fetch("/.netlify/functions/track-demo-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, pathwayId, meta: meta ?? {} }),
  }).catch(() => {});
}
