const { firestoreFetch, toFirestoreFields } = require("./_firebaseAdmin");
const { Resend } = require("resend");

const MODEL    = "gemini-2.5-flash";
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ISO week key in JST — e.g. "2026-W29"
function isoWeekJST(date = new Date()) {
  const jst = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const d   = new Date(Date.UTC(jst.getFullYear(), jst.getMonth(), jst.getDate()));
  const day = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function cefrLabel(score) {
  if (score < 30) return "A1";
  if (score < 50) return "A2";
  if (score < 70) return "B1";
  return "B2+";
}

const GOAL_LABELS = {
  speak: "Speaking confidently", eiken: "Passing EIKEN", travel: "Travel English",
  abroad: "Studying abroad", career: "Career English", business: "Business English",
  presentations: "Presentations", conversation: "Everyday conversation", other: "English fluency",
};

// ── Email template ─────────────────────────────────────────────────────────

function buildEmail({ firstName, week, stats, narrative }) {
  const weekNum = week.split("W")[1];
  const cefr    = cefrLabel(stats.confidenceScore ?? 50);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Week ${weekNum} Progress Report</title>
<style>
  body  { margin:0; padding:0; background:#0a0a0a; font-family:system-ui,-apple-system,"Hiragino Sans","Yu Gothic",sans-serif; color:#e0e0e0; }
  .wrap { max-width:560px; margin:0 auto; padding:40px 24px; }
  .logo { font-size:12px; font-weight:700; letter-spacing:3px; color:#e01010; text-transform:uppercase; margin-bottom:32px; }
  .divider { border:none; border-top:1px solid #1e1e1e; margin:28px 0; }
  .lang-label { font-size:10px; font-weight:700; letter-spacing:2px; color:#444; text-transform:uppercase; margin-bottom:14px; }
  h1  { font-size:22px; font-weight:800; color:#fff; line-height:1.35; margin:0 0 10px; }
  p   { font-size:14px; color:#a0a0a0; line-height:1.75; margin:0 0 16px; }
  .stats { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:20px 0; }
  .stat { background:#111; border:1px solid #2a2a2a; border-radius:10px; padding:14px 12px; text-align:center; }
  .stat-icon { font-size:20px; display:block; margin-bottom:6px; }
  .stat-val  { font-size:18px; font-weight:800; color:#e01010; display:block; margin-bottom:2px; }
  .stat-lbl  { font-size:11px; color:#555; display:block; }
  .chip { display:inline-block; padding:6px 14px; background:rgba(201,168,76,0.1); border:1px solid rgba(201,168,76,0.3); border-radius:8px; font-size:12px; font-weight:700; color:#C9A84C; margin-bottom:16px; }
  .rec { padding:16px 18px; background:rgba(224,16,16,0.06); border:1px solid rgba(224,16,16,0.2); border-radius:12px; margin-bottom:20px; }
  .rec-label { font-size:10px; font-weight:700; color:#e01010; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:8px; }
  .rec-body  { font-size:14px; color:#a0a0a0; line-height:1.65; margin:0; }
  .cta { display:block; max-width:260px; margin:20px 0; padding:14px 0; background:#e01010; border-radius:10px; color:#fff !important; font-size:14px; font-weight:700; text-align:center; text-decoration:none; }
  .footer { margin-top:40px; font-size:11px; color:#444; line-height:1.7; border-top:1px solid #1e1e1e; padding-top:20px; }
  a { color:#e01010; }
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">HSD OS AI</div>

  <!-- ── ENGLISH ── -->
  <div class="lang-label">English</div>
  <h1>Week ${weekNum} Progress Report</h1>
  <p>${narrative.summary}</p>

  <div class="stats">
    <div class="stat"><span class="stat-icon">📈</span><span class="stat-val">${stats.confidenceScore ?? 0}%</span><span class="stat-lbl">Confidence (${cefr})</span></div>
    <div class="stat"><span class="stat-icon">🔥</span><span class="stat-val">${stats.streak ?? 0}</span><span class="stat-lbl">Day streak</span></div>
    <div class="stat"><span class="stat-icon">⭐</span><span class="stat-val">${(stats.xpEarned ?? 0).toLocaleString()}</span><span class="stat-lbl">Total XP</span></div>
    <div class="stat"><span class="stat-icon">✅</span><span class="stat-val">${stats.lessonsCompleted ?? 0}</span><span class="stat-lbl">Lessons done</span></div>
  </div>

  <div class="chip">🏆 ${narrative.strength}</div>
  <p>${narrative.strengthReason}</p>

  <div class="rec">
    <div class="rec-label">Next week's focus</div>
    <p class="rec-body">${narrative.recommendation}</p>
  </div>

  <a class="cta" href="https://app.hsdos.ai">Open HSD OS →</a>

  <hr class="divider"/>

  <!-- ── JAPANESE ── -->
  <div class="lang-label">日本語</div>
  <h1>第${weekNum}週 進捗レポート</h1>
  <p>${narrative.summary_jp}</p>

  <div class="chip">🏆 ${narrative.strength_jp}</div>
  <p>${narrative.strengthReason_jp}</p>

  <div class="rec">
    <div class="rec-label">来週のフォーカス</div>
    <p class="rec-body">${narrative.recommendation_jp}</p>
  </div>

  <a class="cta" href="https://app.hsdos.ai">HSD OSを開く →</a>

  <div class="footer">
    このメールは app.hsdos.ai にご登録いただいたためお送りしています。<br/>
    You're receiving this because you signed up at app.hsdos.ai.<br/><br/>
    Jonathan Waltho · Hear See Do Empire · <a href="https://hearseedo.jp">hearseedo.jp</a>
  </div>
</div>
</body>
</html>`;
}

// ── Handler ────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers: CORS, body: "Method not allowed" };

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Bad request" }) }; }

  const { uid, week: weekParam, stats = {}, email, name } = body;
  if (!uid) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "uid required" }) };

  const week      = weekParam || isoWeekJST();
  const weekNum   = week.split("W")[1];
  const firstName = (name || "").split(" ")[0] || "there";

  // Idempotency: bail early if report already generated for this week
  try {
    const existing = await firestoreFetch(`/users/${uid}/weeklyReports/${week}`);
    if (existing.ok) {
      const doc = await existing.json().catch(() => null);
      if (doc?.fields) return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, existing: true }) };
    }
  } catch { /* Firestore error — continue to generate */ }

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: "Not configured" }) };

  const {
    confidenceScore = 50,
    streak          = 0,
    xpEarned        = 0,
    lessonsCompleted = 0,
    goal            = "speak",
    role            = "professional",
    plan            = "free",
  } = stats;

  const cefr      = cefrLabel(confidenceScore);
  const goalLabel = GOAL_LABELS[goal] || "English fluency";

  const prompt = `You are Jona — the AI coach inside HSD OS AI, built for Japanese learners of English.

Write a warm, intelligent weekly progress report for ${firstName}.

Learner data:
- Goal: ${goalLabel}
- Role: ${role}
- English level: ${cefr} (confidence score: ${confidenceScore}%)
- Current streak: ${streak} days
- Total XP: ${xpEarned.toLocaleString()}
- Total lessons completed: ${lessonsCompleted}
- Plan: ${plan}
- Report week: ${week}

Rules:
- If confidence < 40: be especially encouraging. If > 70: push harder.
- Address them as "you" in English, use warm ですます調 in Japanese.
- Be specific — reference the actual numbers. Do not be generic.
- Sound like a real coach who has been following their journey.

Return ONLY this JSON (no other text):
{
  "summary":           "2-3 English sentences: their week at a glance. Warm, personal, data-grounded.",
  "summary_jp":        "同じ内容を自然な日本語で2-3文。",
  "strength":          "Their single biggest win. Max 5 English words. (e.g. 'Daily practice habit', 'Pushing through doubt')",
  "strength_jp":       "同じ強みを日本語で（最大12文字）",
  "strengthReason":    "One English sentence — why this is their win, referencing their data.",
  "strengthReason_jp": "同じ理由を日本語で1文。",
  "recommendation":    "One concrete English recommendation for next week. Specific to their goal (${goalLabel}) and level (${cefr}). Max 2 sentences.",
  "recommendation_jp": "来週の具体的な推薦を日本語で最大2文。"
}`;

  // ── Gemini call ──────────────────────────────────────────────────────────

  let narrative;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 1024 },
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    const data     = await res.json();
    const parts    = data.candidates?.[0]?.content?.parts ?? [];
    const rawText  = (parts.find(p => !p.thought) ?? parts[0])?.text ?? "";
    const raw      = rawText.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const match    = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in Gemini response");
    narrative = JSON.parse(match[0]);
  } catch (err) {
    console.error("weekly-report Gemini error:", err.message);
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: "Report generation failed" }) };
  }

  const report = {
    week,
    generatedAt: new Date().toISOString(),
    stats: { confidenceScore, streak, xpEarned, lessonsCompleted, goal, cefr },
    ...narrative,
  };

  // ── Save report to Firestore ─────────────────────────────────────────────

  try {
    await firestoreFetch(`/users/${uid}/weeklyReports/${week}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: toFirestoreFields(report) }),
    });
  } catch (e) {
    console.error("weekly-report: Firestore report write error:", e.message);
  }

  // ── Write inbox notification ─────────────────────────────────────────────

  try {
    await firestoreFetch(`/users/${uid}/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: toFirestoreFields({
          key:       `weekly_report_${week}`,
          category:  "weekly",
          title:     `Week ${weekNum} Report is ready`,
          message:   narrative.summary.length > 120 ? narrative.summary.slice(0, 117) + "…" : narrative.summary,
          read:      false,
          action:    { type: "open_report", label: "Read my report", week },
          createdAt: new Date().toISOString(),
        }),
      }),
    });
  } catch (e) {
    console.error("weekly-report: notification write error:", e.message);
  }

  // ── Send email ───────────────────────────────────────────────────────────

  if (email) {
    try {
      const resend  = new Resend(process.env.RESEND_API_KEY);
      const subject = `📊 Week ${weekNum} English Progress Report / 第${weekNum}週英語進捗レポート`;
      await resend.emails.send({
        from: "Jonathan at HSD OS <hello@hsdos.ai>",
        to:   email,
        subject,
        html: buildEmail({ firstName, week, stats: report.stats, narrative }),
      });
    } catch (e) {
      console.error("weekly-report email error:", e.message);
    }
  }

  return {
    statusCode: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true, week }),
  };
};
