// All content on this page is scripted and static — nothing here is computed
// from an API call or random input. That's the point of Demo Mode: the same
// walkthrough, every time, with no risk of an AI response going off-script.
//
// Japanese copy lives alongside English as `*Jp` fields (same convention as
// speakReady/data.js) — shares the platform's global lang state (useLang()),
// so switching to Japanese anywhere in HSD OS carries into Demo Mode too.

export const ALEX_PROFILE = {
  name: "Alex",
  age: 19,
  role: "University student",
  roleJp: "大学生",
  level: "A2",
  levelName: "Elementary",
  levelNameJp: "初級",
  confidenceScore: 43,
  goal: "Job interview",
  goalJp: "就職面接",
  avatar: "🎓",
};

export const DEMO_ASSESSMENT = {
  questions: [
    {
      prompt: "Choose the correct sentence:",
      promptJp: "正しい文を選んでください：",
      options: [
        "She go to university every day.",
        "She goes to university every day.",
        "She going to university every day.",
      ],
      optionsJp: [
        "She go to university every day.",
        "She goes to university every day.",
        "She going to university every day.",
      ],
      correctIndex: 1,
    },
    {
      prompt: "\"I ___ studying English for two years.\"",
      promptJp: "「I ___ studying English for two years.」に入る正しい形は？",
      options: ["am", "have been", "was"],
      optionsJp: ["am", "have been", "was"],
      correctIndex: 1,
    },
    {
      prompt: "Which is the most natural interview answer?",
      promptJp: "面接での答えとして最も自然なものはどれですか？",
      options: [
        "My weakness is I am lazy sometimes.",
        "I sometimes struggle with time management, so I've started using a planner.",
        "I don't have any weakness.",
      ],
      optionsJp: [
        "My weakness is I am lazy sometimes.",
        "I sometimes struggle with time management, so I've started using a planner.",
        "I don't have any weakness.",
      ],
      correctIndex: 1,
    },
  ],
  result: {
    cefr: "A2",
    cefrName: "Elementary",
    cefrNameJp: "初級",
    score: 43,
    strengths: ["Everyday vocabulary", "Simple present & past tense", "Willingness to communicate"],
    strengthsJp: ["日常会話の語彙力", "現在形・過去形の基本文法", "積極的に話そうとする姿勢"],
    gaps: ["Interview-specific phrasing", "Speaking fluency under pressure", "Professional vocabulary"],
    gapsJp: ["面接特有の言い回し", "プレッシャー下での流暢さ", "ビジネス語彙"],
    firstGoal: "Build confidence answering common interview questions",
    firstGoalJp: "よくある面接質問に自信を持って答えられるようにする",
    encouragement: "Alex has a solid foundation — the next step is practicing the exact language job interviews demand.",
    encouragementJp: "Alexにはしっかりとした土台があります。次のステップは、面接で求められる表現を実践的に練習することです。",
  },
};

export const DEMO_JONA_DECISION = {
  reasoning: [
    "Assessment shows CEFR A2 with strong everyday vocabulary but low confidence under pressure.",
    "Stated goal is \"Job interview\" — a high-stakes, structured speaking scenario.",
    "Recurring gap: professional phrasing and answering fluently without long pauses.",
  ],
  reasoningJp: [
    "アセスメントの結果はCEFR A2。日常語彙は強いが、プレッシャー下での自信が低い。",
    "目標は「就職面接」— 緊張感のある、構成されたスピーキング場面。",
    "繰り返し見られる課題：ビジネス的な言い回しと、間を空けずに流暢に話すこと。",
  ],
  recommendation: {
    app: "Career Ready",
    icon: "💼",
    path: "Job Interview Coach",
    pathJp: "面接コーチ",
    lesson: "\"Tell me about yourself\" — structuring a confident 60-second answer",
    lessonJp: "「自己紹介をしてください」— 自信を持って60秒で答える構成づくり",
    challenge: "Answer 3 common interview questions out loud, get instant feedback",
    challengeJp: "よくある面接質問3つに声に出して答え、即座にフィードバックを受ける",
    reason: "Directly targets Alex's goal and closes the biggest confidence gap first.",
    reasonJp: "Alexの目標に直結し、最大の自信ギャップから優先的に埋めていきます。",
  },
};

export const DEMO_LEARNING = {
  category: "Job Interview Coach",
  categoryJp: "面接コーチ",
  question: "Tell me about yourself.",
  questionJp: "自己紹介をしてください。",
  tip: "Keep it to 3 parts: who you are, your relevant experience/studies, and what you're looking for next.",
  tipJp: "3つの要素にまとめましょう：自分は誰か、関連する経験・学び、次に何を求めているか。",
  sampleAnswer:
    "I'm a third-year university student studying business, and I've spent the last year improving my English through daily practice. I'm looking for an internship where I can use both my analytical skills and my English communication.",
  sampleAnswerJp:
    "私は経営学を学ぶ大学3年生で、この1年間毎日練習して英語力を伸ばしてきました。分析力と英語コミュニケーション力の両方を活かせるインターンシップを探しています。",
  feedback: {
    headline: "Nice structure — clear and confident.",
    headlineJp: "良い構成です — 明確で自信が伝わります。",
    points: [
      "Good use of present perfect: \"I've spent the last year...\"",
      "Try adding one specific example next time (a project or result).",
      "Pace was steady — that's exactly what interviewers want to hear.",
    ],
    pointsJp: [
      "現在完了形「I've spent the last year...」の使い方が良いです。",
      "次回は具体的な例（プロジェクトや成果）を一つ加えてみましょう。",
      "話すペースが安定していて、面接官が求めている印象そのものです。",
    ],
  },
  reward: { xp: 40, confidenceDelta: 6 },
};

export const DEMO_PROGRESS = {
  before: { confidence: 43, cefr: "A2", streak: 0, hours: 0 },
  after: { confidence: 58, cefr: "A2 → B1", streak: 12, hours: 6.5 },
  weeklyTrend: [43, 46, 49, 52, 55, 58],
  milestones: [
    { label: "Completed baseline assessment", labelJp: "初回アセスメント完了", done: true },
    { label: "Finished Job Interview Coach — Module 1", labelJp: "面接コーチ — モジュール1修了", done: true },
    { label: "12-day practice streak", labelJp: "12日間連続練習", done: true },
    { label: "Mock interview with Jona", labelJp: "Jonaとの模擬面接", done: false },
  ],
};

// The other apps in the ecosystem that build confidence alongside Career
// Ready — shown so judges see this is a connected system, not one feature.
export const DEMO_APPS = [
  {
    id: "career-ready",
    name: "Career Ready",
    image: "/demo/apps/career-ready.jpg",
    tag: "Alex's primary path",
    tagJp: "Alexのメインパス",
    blurb: "Mock interviews, resume support, and workplace English — directly targets Alex's goal.",
    blurbJp: "模擬面接、履歴書サポート、ビジネス英語 — Alexの目標に直結します。",
    confidenceRole: "Builds confidence answering high-stakes questions under time pressure.",
    confidenceRoleJp: "プレッシャーの中で重要な質問に答える自信を育てます。",
    primary: true,
  },
  {
    id: "speak-ready",
    name: "Speak Ready",
    icon: "🎤",
    tag: "Recommended next",
    tagJp: "次のおすすめ",
    blurb: "Daily pronunciation and speaking drills with instant feedback.",
    blurbJp: "毎日の発音・スピーキング練習と即時フィードバック。",
    confidenceRole: "Builds confidence with spoken fluency — fewer pauses, clearer delivery.",
    confidenceRoleJp: "話す流暢さへの自信を育てます — 間が減り、伝わりやすくなります。",
  },
  {
    id: "global-ready",
    name: "Global Ready",
    image: "/demo/apps/global-ready.jpg",
    tag: "For later",
    tagJp: "この後のステップ",
    blurb: "Real-world conversation scenarios — travel, ordering, small talk.",
    blurbJp: "旅行、注文、雑談など、実際の会話シナリオ。",
    confidenceRole: "Builds confidence in unscripted, everyday conversation.",
    confidenceRoleJp: "台本のない日常会話への自信を育てます。",
  },
];

// The rest of the HSD OS ecosystem — shown so the demo doesn't read as
// "university-only." Same matching engine that picked Career Ready for Alex
// picks a phonics world for a 7-year-old or a mindset track for an adult.
export const DEMO_ECOSYSTEM = [
  {
    id: "phonics",
    name: "Monkey Yoga Phonics",
    image: "/demo/apps/monkey-yoga.jpg",
    audience: "Kids",
    audienceJp: "子ども向け",
    blurb: "Phonics mastery through movement and music for young learners.",
    blurbJp: "動きと音楽で身につける、子ども向けフォニックス学習。",
  },
  {
    id: "wondercamp",
    name: "Wondercamp",
    image: "/demo/apps/wondercamp.jpg",
    audience: "Kids",
    audienceJp: "子ども向け",
    blurb: "An immersive English adventure camp, built for young explorers.",
    blurbJp: "子どもの冒険心をくすぐる、没入型の英語キャンプ体験。",
  },
  {
    id: "family",
    name: "HSD Family",
    image: "/demo/apps/family.jpg",
    audience: "Families",
    audienceJp: "家族向け",
    blurb: "Shared learning with progress tracking for every family member.",
    blurbJp: "家族全員の学習と成長を、ひとつのアカウントで見守れます。",
  },
  {
    id: "sipswitch",
    name: "Sip & Switch",
    image: "/demo/apps/sip-and-switch.jpg",
    audience: "Adults & Professionals",
    audienceJp: "社会人・大人向け",
    blurb: "Everyday fluency built through natural conversational switching.",
    blurbJp: "自然な会話の切り替えで、日常の流暢さを育てます。",
  },
  {
    id: "innerkey",
    name: "The Inner Key Blueprint",
    image: "/demo/apps/inner-key.jpg",
    audience: "Adults",
    audienceJp: "大人向け",
    blurb: "Mindset and confidence work for deeper, lasting English growth.",
    blurbJp: "マインドセットと自信に働きかける、より深い英語成長のためのプログラム。",
  },
];

export const JONA_SCRIPT = {
  start:
    "Hi, I'm Jona. Let me introduce you to Alex — nineteen, a university student, English level A2, and confidence sitting at just forty-three percent. Alex's goal is simple: walk into a job interview and speak with confidence. Let's follow that journey together.",
  assessment:
    "First, Alex takes a short placement assessment. A few questions on grammar and vocabulary, and one on interview instinct. This tells me exactly where Alex is starting from.",
  assessmentResult:
    "Here's the result. Alex is at CEFR A2, forty-three percent confidence. Good everyday vocabulary, but the gaps are exactly what you'd expect for interview prep — professional phrasing and speaking fluently under pressure.",
  jona:
    "Now I make a decision. A2 level, plus a goal of job interview, plus a specific gap in speaking under pressure — that points to one place to start. Career Ready's Job Interview Coach, beginning with the single most common interview question: tell me about yourself.",
  apps:
    "Career Ready isn't the only tool that helps here. Speak Ready builds spoken fluency with daily drills, and Global Ready keeps Alex comfortable in everyday conversation. Every app in HSD OS is aimed at the same outcome — confidence — just from a different angle.",
  engine:
    "And this isn't just Alex. The same engine — level, goal, and confidence in, a matched path out — works for a seven-year-old starting phonics, a family learning together, or a professional building fluency for work. One decision engine, a different path for every learner.",
  learning:
    "Let's watch Alex practice. The question: tell me about yourself. I give feedback immediately — what worked, and one thing to try next time.",
  progress:
    "Two weeks later, here's what changed. Confidence up from forty-three to fifty-eight percent. A twelve-day practice streak. Alex is closer to a B1 level, and closer to walking into that interview ready.",
  close:
    "That's Alex's journey — from a forty-three percent baseline to walking into an interview ready. Every learner gets this same path: an honest assessment, a clear decision, real practice, and progress you can actually see. This demo was scripted so you'd see it exactly as it happens for real learners every day.",
};

export const JONA_SCRIPT_JP = {
  start:
    "こんにちは、Jonaです。Alexを紹介させてください — 19歳、大学生、英語レベルはA2、自信度はまだ43パーセントです。Alexの目標はシンプル：就職面接で自信を持って話すこと。一緒にその journey を追っていきましょう。",
  assessment:
    "まず、Alexは短いプレースメントアセスメントを受けます。文法と語彙の質問がいくつかと、面接の感覚を見る質問が一つ。これでAlexの今の状態が正確にわかります。",
  assessmentResult:
    "結果が出ました。AlexはCEFR A2、自信度は43パーセントです。日常語彙は良いですが、課題は面接対策でよくあるもの — ビジネス的な言い回しと、プレッシャー下で流暢に話すことです。",
  jona:
    "では決定します。A2レベル、目標は就職面接、そしてプレッシャー下で話す力に課題がある — これが指し示す先は一つです。Career Readyの面接コーチ、最も一般的な面接質問「自己紹介をしてください」から始めます。",
  apps:
    "Career Readyだけがすべてではありません。Speak Readyは毎日のドリルで話す流暢さを育て、Global ReadyはAlexが日常会話に慣れるのを助けます。HSD OSのすべてのアプリは同じゴール — 自信 — を、それぞれ違う角度から目指しています。",
  engine:
    "そしてこれはAlexだけの話ではありません。同じエンジンが — レベル、目標、自信度を入力し、最適な学習パスを出力する — 7歳でフォニックスを始める子どもにも、一緒に学ぶ家族にも、仕事のために流暢さを身につけたい社会人にも機能します。ひとつの決定エンジンが、学習者ごとに違う道を用意します。",
  learning:
    "Alexの練習を見てみましょう。質問は「自己紹介をしてください」。私はすぐにフィードバックします — 何が良かったか、次に試すべきことは何か。",
  progress:
    "2週間後、変化はこうです。自信度は43パーセントから58パーセントへ。12日間の連続練習。AlexはB1レベルに近づき、面接に向けて着実に準備が整ってきています。",
  close:
    "これがAlexの journey です — 43パーセントのベースラインから、面接に自信を持って臨めるまで。すべての学習者が同じ道をたどります：正直なアセスメント、明確な決定、実践的な練習、そして目に見える成長。このデモは、実際の学習者が毎日体験していることをそのまま見てもらうために、あえて台本にしています。",
};
