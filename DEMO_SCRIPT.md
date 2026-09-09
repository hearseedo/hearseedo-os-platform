# HSD OS — Demo Mode Script

`hsdos.ai/demo` — a scripted, no-login walkthrough for pitch videos and judges. Every line below is what Jona actually speaks in-app (real ElevenLabs voice via `/api/tts` — same endpoint the live Jona Coach uses). Nothing on this page calls a live AI model, so the run is identical every time.

Available in **English and Japanese** — toggle with the EN / 日本語 switch in the demo header (shares the platform's global language setting, so it stays consistent with the rest of HSD OS).

Learner: **Alex**, 19, university student, English level A2, confidence 43%, goal: job interview.

---

## 1. Start — `/demo`

**On screen:** Alex's profile card (level, confidence, goal).

**Jona (voice, EN):**
> "Hi, I'm Jona. Let me introduce you to Alex — nineteen, a university student, English level A2, and confidence sitting at just forty-three percent. Alex's goal is simple: walk into a job interview and speak with confidence. Let's follow that journey together."

**Jona (voice, JP):**
> 「こんにちは、Jonaです。Alexを紹介させてください — 19歳、大学生、英語レベルはA2、自信度はまだ43パーセントです。Alexの目標はシンプル：就職面接で自信を持って話すこと。一緒にその journey を追っていきましょう。」

---

## 2. Assessment — `/demo/assessment`

**On screen:** 3 quick placement questions (grammar, vocabulary, interview instinct), then a scored result.

**Jona (voice, on question 1, EN):**
> "First, Alex takes a short placement assessment. A few questions on grammar and vocabulary, and one on interview instinct. This tells me exactly where Alex is starting from."

**Jona (voice, on question 1, JP):**
> 「まず、Alexは短いプレースメントアセスメントを受けます。文法と語彙の質問がいくつかと、面接の感覚を見る質問が一つ。これでAlexの今の状態が正確にわかります。」

**Jona (voice, on result, EN):**
> "Here's the result. Alex is at CEFR A2, forty-three percent confidence. Good everyday vocabulary, but the gaps are exactly what you'd expect for interview prep — professional phrasing and speaking fluently under pressure."

**Jona (voice, on result, JP):**
> 「結果が出ました。AlexはCEFR A2、自信度は43パーセントです。日常語彙は良いですが、課題は面接対策でよくあるもの — ビジネス的な言い回しと、プレッシャー下で流暢に話すことです。」

---

## 3. Jona Decision — `/demo/jona`

**On screen:** Jona's reasoning bullets, then the recommendation reveals (Career Ready → Job Interview Coach).

**Jona (voice, EN):**
> "Now I make a decision. A2 level, plus a goal of job interview, plus a specific gap in speaking under pressure — that points to one place to start. Career Ready's Job Interview Coach, beginning with the single most common interview question: tell me about yourself."

**Jona (voice, JP):**
> 「では決定します。A2レベル、目標は就職面接、そしてプレッシャー下で話す力に課題がある — これが指し示す先は一つです。Career Readyの面接コーチ、最も一般的な面接質問「自己紹介をしてください」から始めます。」

---

## 4. Confidence-Building Apps — `/demo/apps`

**On screen:** Career Ready (primary), Speak Ready, Global Ready — Alex's specific toolkit, each with its role in building confidence.

**Jona (voice, EN):**
> "Career Ready isn't the only tool that helps here. Speak Ready builds spoken fluency with daily drills, and Global Ready keeps Alex comfortable in everyday conversation. Every app in HSD OS is aimed at the same outcome — confidence — just from a different angle."

**Jona (voice, JP):**
> 「Career Readyだけがすべてではありません。Speak Readyは毎日のドリルで話す流暢さを育て、Global ReadyはAlexが日常会話に慣れるのを助けます。HSD OSのすべてのアプリは同じゴール — 自信 — を、それぞれ違う角度から目指しています。」

**On screen (second beat):** "One decision engine — built for every learner" — Monkey Yoga Phonics (kids), Wondercamp (kids), HSD Family (families), Sip & Switch (adults/professionals), The Inner Key Blueprint (adults). Shown so the demo doesn't read as university-only — same matching logic, different audience.

**Jona (voice, EN):**
> "And this isn't just Alex. The same engine — level, goal, and confidence in, a matched path out — works for a seven-year-old starting phonics, a family learning together, or a professional building fluency for work. One decision engine, a different path for every learner."

**Jona (voice, JP):**
> 「そしてこれはAlexだけの話ではありません。同じエンジンが — レベル、目標、自信度を入力し、最適な学習パスを出力する — 7歳でフォニックスを始める子どもにも、一緒に学ぶ家族にも、仕事のために流暢さを身につけたい社会人にも機能します。ひとつの決定エンジンが、学習者ごとに違う道を用意します。」

---

## 5. Learning — `/demo/learning`

**On screen:** The actual lesson — "Tell me about yourself," a sample answer, then feedback + XP/confidence reward.

**Jona (voice, EN):**
> "Let's watch Alex practice. The question: tell me about yourself. I give feedback immediately — what worked, and one thing to try next time."

**Jona (voice, JP):**
> 「Alexの練習を見てみましょう。質問は「自己紹介をしてください」。私はすぐにフィードバックします — 何が良かったか、次に試すべきことは何か。」

---

## 6. Progress — `/demo/progress`

**On screen:** Before/after confidence rings (43% → 58%), streak, hours, weekly trend chart, milestones.

**Jona (voice, EN):**
> "Two weeks later, here's what changed. Confidence up from forty-three to fifty-eight percent. A twelve-day practice streak. Alex is closer to a B1 level, and closer to walking into that interview ready."

**Jona (voice, JP):**
> 「2週間後、変化はこうです。自信度は43パーセントから58パーセントへ。12日間の連続練習。AlexはB1レベルに近づき、面接に向けて着実に準備が整ってきています。」

---

## Notes for recording

- Mute/unmute Jona's voice from the top-right toggle in the demo header. Switch EN / 日本語 next to it for the Japanese run.
- Every step is deep-linkable and clickable from the step tracker — jump anywhere for retakes without replaying the whole flow.
- Voice requires `ELEVENLABS_API_KEY` set on the Netlify function environment (already wired for the live Jona Coach); without it, the text still displays and playback just silently no-ops.
- The shared TTS function currently uses `eleven_turbo_v2`, tuned for English — Japanese narration will still play but may not sound as natural as the English take until/unless that model is swapped to a multilingual one for this voice.
- "Restart the Demo" on the Progress screen loops back to Start for a clean take.
