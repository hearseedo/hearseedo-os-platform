// Shared PEM-normalization helper (credential-rotation hardening,
// 2026-09-11). Handles three real shapes a private-key env var can arrive
// in, observed while rotating FIREBASE_SA_PRIVATE_KEY:
//   1. Real newlines already present (pasted from a plain-text editor
//      that preserved them) — used as-is.
//   2. Literal two-character `\n` escape sequences (copied verbatim out
//      of a JSON file's quoted string value) — unescaped to real newlines.
//   3. ALL newlines stripped entirely — observed in production: Netlify's
//      environment-variable field collapsed a genuinely multi-line paste
//      into one continuous line with no separators at all. Detected by
//      the complete absence of any newline character despite the correct
//      BEGIN/END markers being present, and repaired by reinserting a
//      newline right after the BEGIN marker and right before the END
//      marker — sufficient for Node's crypto module (backed by OpenSSL)
//      to parse, even though the base64 body itself is not re-wrapped to
//      the conventional 64-char line length.
function normalizePem(raw) {
  if (!raw) return raw;
  let pem = raw;
  if (pem.includes("\\n")) pem = pem.replace(/\\n/g, "\n");
  if (!pem.includes("\n") && pem.includes("-----BEGIN") && pem.includes("-----END")) {
    pem = pem
      .replace(/-----BEGIN ([A-Z ]+)-----/, "-----BEGIN $1-----\n")
      .replace(/-----END ([A-Z ]+)-----/, "\n-----END $1-----");
  }
  return pem;
}

module.exports = { normalizePem };
