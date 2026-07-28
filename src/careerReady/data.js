// Career Ready — content banks
// University Path pathway inside HSDOS.AI. Confidence before correctness.
// Japanese fields (nameJp/descJp/promptJp) support the reading-support toggle
// for students who find English text hard to follow.

export const CATEGORIES = [
  {
    id:    "interview",
    name:  "Job Interview Coach",
    nameJp: "面接コーチ",
    desc:  "Practice real interview questions with an AI interviewer",
    descJp: "AI面接官と本番の面接質問を練習しよう",
    icon:  "🎤",
    color: "#2ec4b6",
  },
  {
    id:    "internship",
    name:  "Internship Coach",
    nameJp: "インターンシップコーチ",
    desc:  "Prepare for internship applications and interviews",
    descJp: "インターンシップの応募や面接の準備をしよう",
    icon:  "💼",
    color: "#4488ff",
  },
  {
    id:    "parttime",
    name:  "Part-Time Work English",
    nameJp: "アルバイト英語",
    desc:  "Cafes, hotels, retail, tourism & customer service English",
    descJp: "カフェ・ホテル・接客・観光で使う英語",
    icon:  "☕",
    color: "#f59e0b",
  },
  {
    id:    "resume",
    name:  "Resume / Email Support",
    nameJp: "履歴書・メールサポート",
    desc:  "Turn rough notes into professional English",
    descJp: "メモを自然でプロフェッショナルな英語に",
    icon:  "✉️",
    color: "#a855f7",
  },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

export const INTERVIEW_QUESTIONS = [
  { id: "tell_me",    prompt: "Tell me about yourself.",                    promptJp: "自己紹介をしてください。" },
  { id: "why_job",    prompt: "Why do you want this job?",                  promptJp: "なぜこの仕事を希望するのですか?" },
  { id: "strengths",  prompt: "What are your strengths?",                   promptJp: "あなたの強みは何ですか?" },
  { id: "weaknesses", prompt: "What are your weaknesses?",                  promptJp: "あなたの弱みは何ですか?" },
  { id: "challenge",  prompt: "Tell me about a challenge you overcame.",    promptJp: "乗り越えた困難について教えてください。" },
  { id: "hire_you",   prompt: "Why should we hire you?",                    promptJp: "なぜ我々はあなたを採用すべきですか?" },
  { id: "questions",  prompt: "Do you have any questions for us?",          promptJp: "何か質問はありますか?" },
];

export const INTERNSHIP_QUESTIONS = [
  { id: "self_intro",  prompt: "Introduce yourself to your internship supervisor on day one.", promptJp: "初日にインターン先の担当者へ自己紹介をしてください。" },
  { id: "major",       prompt: "Explain your university major and why you chose it.",           promptJp: "大学の専攻と、それを選んだ理由を説明してください。" },
  { id: "skills",      prompt: "Talk about the skills you would bring to this internship.",     promptJp: "このインターンシップで活かせるスキルについて話してください。" },
  { id: "projects",    prompt: "Describe a project you worked on at university.",                promptJp: "大学で取り組んだプロジェクトについて説明してください。" },
  { id: "ask_company",  prompt: "Ask the company an interesting question about their work.",    promptJp: "会社の仕事について興味深い質問をしてください。" },
  { id: "small_talk",  prompt: "Make small talk with a coworker in the break room.",             promptJp: "休憩室で同僚と雑談をしてください。" },
  { id: "first_day",   prompt: "Introduce yourself to the whole team on your first day.",        promptJp: "初日にチーム全員へ自己紹介をしてください。" },
];

export const PARTTIME_SCENARIOS = [
  { id: "greeting",    prompt: "Greet a customer walking into the store.",                       promptJp: "店に入ってきたお客様に挨拶してください。" },
  { id: "explain",     prompt: "Explain one of your products to a customer.",                    promptJp: "お客様に商品の一つを説明してください。" },
  { id: "orders",      prompt: "Take a customer's order at a cafe.",                              promptJp: "カフェでお客様の注文を受けてください。" },
  { id: "directions",  prompt: "Give a tourist directions to the nearest station.",                promptJp: "観光客に最寄り駅までの道を案内してください。" },
  { id: "complaint",   prompt: "Handle a customer who says their order is wrong.",                promptJp: "注文が間違っていると言うお客様に対応してください。" },
  { id: "tourists",    prompt: "Help a tourist who doesn't speak much English find something.",   promptJp: "英語があまり話せない観光客が探し物を見つける手伝いをしてください。" },
  { id: "polite",      prompt: "Politely tell a customer the item they want is out of stock.",    promptJp: "欲しい商品が品切れであることを丁寧に伝えてください。" },
];

export const PRACTICE_BANKS = {
  interview:  INTERVIEW_QUESTIONS,
  internship: INTERNSHIP_QUESTIONS,
  parttime:   PARTTIME_SCENARIOS,
};

export const RESUME_TOOLS = [
  { id: "resume_bullets",   label: "Resume Bullet Points",         labelJp: "履歴書の箇条書き",       icon: "📄", desc: "Turn a task or duty into a strong resume bullet",       descJp: "仕事の内容を履歴書向けの強い一文に" },
  { id: "cover_letter",     label: "Cover Letter Support",         labelJp: "カバーレター作成",       icon: "📝", desc: "Build a professional cover letter paragraph",            descJp: "プロフェッショナルなカバーレターの段落を作成" },
  { id: "email_professor",  label: "Email to Professor",          labelJp: "教授へのメール",         icon: "🎓", desc: "A polite, clear email to your professor",                descJp: "教授への丁寧で分かりやすいメール" },
  { id: "internship_email", label: "Internship Application Email", labelJp: "インターン応募メール",   icon: "📨", desc: "Apply for an internship professionally",                 descJp: "プロフェッショナルにインターンへ応募する" },
  { id: "thank_you",        label: "Thank-You Email After Interview", labelJp: "面接後のお礼メール",  icon: "🙏", desc: "Follow up after an interview",                            descJp: "面接後のフォローアップメール" },
  { id: "recruiter_msg",    label: "Message to Recruiter",         labelJp: "採用担当者へのメッセージ", icon: "💬", desc: "Reach out to a recruiter naturally",                     descJp: "採用担当者へ自然に連絡する" },
  { id: "polite_rewrite",   label: "Polite Message Rewriting",     labelJp: "丁寧な文章に書き換え",   icon: "🎩", desc: "Make any message sound more polite",                     descJp: "文章をより丁寧な印象にする" },
  { id: "friendly_rewrite", label: "Friendly Message Rewriting",   labelJp: "親しみやすい文章に書き換え", icon: "😊", desc: "Make any message sound warmer and friendlier",         descJp: "文章をより温かく親しみやすくする" },
  { id: "formal_rewrite",   label: "Formal Message Rewriting",     labelJp: "フォーマルな文章に書き換え", icon: "🏢", desc: "Make any message sound formal and professional",       descJp: "文章をよりフォーマルでプロフェッショナルにする" },
];

export const RESUME_TOOL_MAP = Object.fromEntries(RESUME_TOOLS.map(t => [t.id, t]));

export const CONFIDENCE_LEVELS = [
  { level: 1, name: "Getting Started",   nameJp: "はじめの一歩",         minXP: 0   },
  { level: 2, name: "Building Answers",  nameJp: "答えを組み立てる",     minXP: 100 },
  { level: 3, name: "Speaking Clearly",  nameJp: "はっきり話せる",       minXP: 250 },
  { level: 4, name: "Interview Ready",   nameJp: "面接準備完了",         minXP: 450 },
  { level: 5, name: "Career Ready",      nameJp: "キャリア準備完了",     minXP: 700 },
];

export const BADGES = [
  { id: "first_interview",   name: "First Interview Practice",  nameJp: "初めての面接練習",     icon: "🎤", desc: "Completed your first interview question",           descJp: "最初の面接質問を完了しました" },
  { id: "strong_intro",      name: "Strong Self-Introduction",  nameJp: "力強い自己紹介",       icon: "🌟", desc: "Scored 80+ confidence on a self-introduction",       descJp: "自己紹介で自信度80以上を獲得" },
  { id: "internship_ready",  name: "Internship Ready",          nameJp: "インターン準備完了",   icon: "💼", desc: "Completed all internship practice topics",           descJp: "インターンシップの練習トピックを全て完了" },
  { id: "professional_email",name: "Professional Email",        nameJp: "プロフェッショナルなメール", icon: "✉️", desc: "Polished your first email or resume text",       descJp: "初めてメールや履歴書の文章を仕上げました" },
  { id: "parttime_hero",     name: "Part-Time Work Hero",       nameJp: "アルバイトのヒーロー", icon: "☕", desc: "Completed all part-time work scenarios",             descJp: "アルバイトのシナリオを全て完了" },
  { id: "confidence_builder",name: "Confidence Builder",        nameJp: "自信を積み上げる",     icon: "🔥", desc: "Practiced 10 times across any category",             descJp: "いずれかのカテゴリーで10回練習しました" },
];

export function levelForXP(xp) {
  let current = CONFIDENCE_LEVELS[0];
  for (const l of CONFIDENCE_LEVELS) {
    if (xp >= l.minXP) current = l;
  }
  return current;
}

export function nextLevel(xp) {
  const current = levelForXP(xp);
  return CONFIDENCE_LEVELS.find(l => l.level === current.level + 1) ?? null;
}
