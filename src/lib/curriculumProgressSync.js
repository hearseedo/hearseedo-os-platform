// HSD OS AI — pure curriculum-progress sync/retry logic (correction, 2026-09-10).
//
// No Firebase import, deliberately — same reasoning as curriculumRouting.js:
// this is the one place that decides how a progress event gets retried, and
// it needs to be directly unit-testable without Firebase's import.meta.env
// coupling. src/family/curriculumProgress.js (which has the actual
// fetch()/idToken plumbing) imports this.
//
// Design: record-curriculum-progress.js's own error classification (see
// that file) already tells the caller, honestly, whether a failure is
// retryable. This module's only job is to act on that signal correctly:
// - Retry ONLY when the server said `retryable: true`, or the request
//   never reached the server at all (a thrown network error).
// - Never regenerate/alter the payload between attempts — the exact same
//   object (and therefore the exact same eventId) is resent every time.
//   The caller decides what a "genuinely new attempt" is (see
//   hsd-monkey-yoga-phonics-v2/src/screens/Lesson.tsx); this layer only
//   ever retries a TRANSPORT failure of one already-decided attempt.
// - Stop immediately on a non-retryable failure — retrying a validation,
//   auth, or permission error can't succeed and would just burn attempts
//   and delay telling the caller the truth.
// - Never report success unless the server actually confirmed one
//   (`body.success === true`), whether that's a fresh write or a
//   confirmed duplicate.

export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_BASE_DELAY_MS = 500;

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sends one progress event via `postFn`, retrying a retryable failure up to
 * `maxAttempts` times with exponential backoff. `postFn(payload)` must
 * resolve to `{ ok, status, body }` (never throw for an HTTP-level
 * failure — only for a genuine network/transport failure) or reject/throw
 * for a transport failure.
 *
 * Returns one of:
 *   { ok: true, duplicate }              — server confirmed the write (or that it was already done)
 *   { ok: false, recoverable: false }    — a real, non-retryable failure (validation/auth/permission/server bug)
 *   { ok: false, recoverable: true }     — every retry was exhausted; the SAME payload can be retried again later
 *
 * `recoverable: true` is the caller's signal to keep the attempt around
 * (never discard it) and offer/attempt a further retry — never a reason to
 * report success.
 */
export async function sendCurriculumProgressWithRetry(postFn, payload, options = {}) {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const sleep = options.sleep ?? defaultSleep;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let result;
    try {
      // The exact same `payload` reference is sent on every attempt —
      // nothing here ever mutates it or swaps in a new eventId.
      result = await postFn(payload);
    } catch {
      // Transport-level failure (offline, DNS, connection reset) — the
      // request never reached the server, so this is unconditionally
      // retryable up to the attempt limit.
      if (attempt < maxAttempts) await sleep(baseDelayMs * 2 ** (attempt - 1));
      continue;
    }

    if (result?.ok && result.body?.success) {
      return { ok: true, duplicate: !!result.body.duplicate };
    }

    if (!result?.body?.retryable) {
      // The server classified this as non-retryable (or the response was
      // unparseable) — stop now rather than retry something that cannot
      // succeed, and never claim the progress was saved.
      return { ok: false, recoverable: false };
    }

    if (attempt < maxAttempts) await sleep(baseDelayMs * 2 ** (attempt - 1));
  }

  // Every attempt was retryable but none succeeded — a genuine, recoverable
  // sync failure. The payload (and its eventId) is still valid for a later
  // retry; nothing about the learner's attempt is lost or fabricated.
  return { ok: false, recoverable: true };
}
