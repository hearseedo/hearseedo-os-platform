const { Resend } = require("resend");

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method not allowed" };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: CORS, body: "Bad request" }; }

  const { email, name, streak = 0, daysAway = 0 } = body;
  if (!email) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "email required" }) };

  const firstName = (name ?? "").split(" ")[0] || "there";
  const hasStreak = streak > 0;

  const subject = hasStreak
    ? `🔥 ${streak}-day streak waiting / ${streak}日連続が待っています`
    : `Your English practice is waiting 🎯 / 英語の練習が待っています`;

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${subject}</title>
<style>
  body  { margin:0; padding:0; background:#0a0a0a; font-family:system-ui,-apple-system,"Hiragino Sans","Yu Gothic",sans-serif; color:#e0e0e0; }
  .wrap { max-width:560px; margin:0 auto; padding:40px 24px; }
  .logo { font-size:12px; font-weight:700; letter-spacing:3px; color:#e01010; text-transform:uppercase; margin-bottom:32px; }
  .divider { border:none; border-top:1px solid #1e1e1e; margin:32px 0; }
  .lang-label { font-size:10px; font-weight:700; letter-spacing:2px; color:#444; text-transform:uppercase; margin-bottom:14px; }
  h1  { font-size:24px; font-weight:800; color:#ffffff; line-height:1.35; margin:0 0 14px; }
  p   { font-size:14px; color:#a0a0a0; line-height:1.75; margin:0 0 18px; }
  .streak { display:inline-block; padding:9px 18px; background:rgba(224,16,16,0.12); border:1px solid rgba(224,16,16,0.3); border-radius:10px; font-size:20px; font-weight:800; color:#e01010; margin-bottom:20px; }
  .cta { display:block; max-width:280px; margin:20px 0; padding:15px 0; background:#e01010; border-radius:10px; color:#fff !important; font-size:15px; font-weight:700; text-align:center; text-decoration:none; }
  .offer { padding:18px 20px; background:rgba(201,168,76,0.07); border:1px solid rgba(201,168,76,0.3); border-radius:12px; margin-top:8px; }
  .offer-title { font-size:12px; font-weight:700; color:#C9A84C; letter-spacing:1px; text-transform:uppercase; margin-bottom:8px; }
  .offer-body  { font-size:13px; color:#a0a0a0; line-height:1.65; margin:0; }
  .footer { margin-top:40px; font-size:11px; color:#444; line-height:1.7; border-top:1px solid #1e1e1e; padding-top:20px; }
  a { color:#e01010; text-decoration:none; }
  strong { color:#fff; }
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">HSD OS AI</div>

  <!-- ── ENGLISH ── -->
  <div class="lang-label">English</div>

  <h1>Hey ${firstName}, your English practice is waiting.</h1>

  <p>
    ${daysAway > 1 ? `It's been ${daysAway} days since you last opened the platform.` : "We noticed you haven't been back in a few days."}
    ${hasStreak
      ? ` Your <strong>${streak}-day streak</strong> is still alive — but only if you come back today.`
      : " Even a few minutes a day builds real momentum."}
  </p>

  ${hasStreak ? `<div class="streak">🔥 ${streak} day streak</div>` : ""}

  <p>
    We've added a new <strong>Today's Mission</strong> section to your dashboard —
    it shows exactly what to do each day to keep improving.
  </p>

  <a class="cta" href="https://app.hsdos.ai">Jump back in →</a>

  <div class="offer">
    <div class="offer-title">⭐ Founding Member — Still Available</div>
    <p class="offer-body">
      The first 200 paying members lock in their plan price forever. No increases, ever.
      Spots are limited. <a href="https://app.hsdos.ai/plans">See plans →</a>
    </p>
  </div>

  <hr class="divider"/>

  <!-- ── JAPANESE ── -->
  <div class="lang-label">日本語</div>

  <h1>${firstName}さん、英語の練習が待っています。</h1>

  <p>
    ${daysAway > 1 ? `最後にプラットフォームを開いてから${daysAway}日が経ちました。` : "しばらくログインしていませんね。"}
    ${hasStreak
      ? `あなたの<strong>${streak}日連続</strong>はまだ続いています — でも、今日戻らないと途切れてしまいます。`
      : "毎日少しずつ続けることが、大きな進歩につながります。"}
  </p>

  ${hasStreak ? `<div class="streak">🔥 ${streak}日連続</div>` : ""}

  <p>
    ダッシュボードに新しい「<strong>今日のミッション</strong>」セクションを追加しました —
    毎日やるべきことが一目でわかります。
  </p>

  <a class="cta" href="https://app.hsdos.ai">アプリに戻る →</a>

  <div class="offer">
    <div class="offer-title">⭐ ファウンディングメンバー — まだ受付中</div>
    <p class="offer-body">
      最初の200名の有料メンバーは、プラン料金が<strong>永久に固定</strong>されます。値上げなし、永遠に。
      枠は限られています。<a href="https://app.hsdos.ai/plans">プランを見る →</a>
    </p>
  </div>

  <div class="footer">
    このメールは app.hsdos.ai にご登録いただいたためお送りしています。<br/>
    You're receiving this because you signed up at app.hsdos.ai.<br/><br/>
    Jonathan Waltho · Hear See Do Empire · <a href="https://hearseedo.jp">hearseedo.jp</a>
  </div>
</div>
</body>
</html>`;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from:    "Jonathan at HSD OS <hello@hsdos.ai>",
      to:      email,
      subject,
      html,
    });
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, id: result.data?.id }) };
  } catch (err) {
    console.error("Resend error:", err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
