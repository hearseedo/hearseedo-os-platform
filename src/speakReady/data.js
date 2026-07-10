// Speak Ready — content banks
// University Path pathway inside HSDOS.AI. Confidence before correctness.
// Hear → See → Do: every scenario is a live spoken exchange, not a quiz.
// Japanese fields (nameJp/descJp/promptJp) support the reading-support toggle
// for students who find English text hard to follow.

export const CATEGORIES = [
  {
    id:    "missions",
    name:  "Speaking Missions",
    nameJp: "スピーキングミッション",
    desc:  "Real-life situations — cafes, calls, meetings, and more",
    descJp: "カフェ・電話・会議など、実生活の場面を練習",
    icon:  "🎯",
    color: "#2ec4b6",
  },
  {
    id:    "quick_thinking",
    name:  "Quick Thinking",
    nameJp: "クイックシンキング",
    desc:  "Rapid questions, instant answers — build automatic English",
    descJp: "素早い質問に即答して、自動的に出てくる英語を鍛える",
    icon:  "⚡",
    color: "#f59e0b",
  },
  {
    id:    "picture",
    name:  "Picture Speaking",
    nameJp: "ピクチャースピーキング",
    desc:  "Describe a scene and tell its story",
    descJp: "情景を描写し、物語を語ろう",
    icon:  "🖼️",
    color: "#a855f7",
  },
  {
    id:    "debate",
    name:  "Debate & Discussion",
    nameJp: "ディベート・ディスカッション",
    desc:  "Share opinions, agree, disagree, and explain why",
    descJp: "意見を伝え、賛成・反対し、理由を説明しよう",
    icon:  "💭",
    color: "#e01010",
  },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

export const MISSIONS_SCENARIOS = [
  { id: "coffee_shop",  persona: "a friendly barista at a busy coffee shop",                    prompt: "Order a drink and make a little small talk with the barista.",         promptJp: "バリスタに飲み物を注文し、少し雑談してください。" },
  { id: "gym",          persona: "a friendly regular at the gym you go to",                      prompt: "Chat with someone at the gym between sets.",                            promptJp: "ジムでセットの合間に誰かと雑談してください。" },
  { id: "phone_call",   persona: "a customer service representative you called",                 prompt: "Call a business and ask about their hours or a service.",              promptJp: "お店に電話をかけ、営業時間やサービスについて尋ねてください。" },
  { id: "small_talk",   persona: "someone you just met while waiting in line",                   prompt: "Make small talk with a stranger while waiting.",                       promptJp: "待っている間に見知らぬ人と雑談してください。" },
  { id: "networking",   persona: "someone new you just met at a networking event",               prompt: "Introduce yourself professionally at a networking event.",             promptJp: "交流イベントでプロフェッショナルに自己紹介してください。" },
  { id: "business_mtg", persona: "a colleague leading a business meeting",                       prompt: "Contribute your idea during a business meeting.",                      promptJp: "ビジネス会議で自分の意見を伝えてください。" },
  { id: "team_discuss", persona: "a teammate working on a group task with you",                  prompt: "Discuss how to divide a task with a teammate.",                        promptJp: "チームメイトとタスクの分担について話し合ってください。" },
  { id: "presentation", persona: "an audience member asking a question after your presentation", prompt: "Give a short update, then answer a follow-up question.",               promptJp: "簡単な報告をして、その後の質問に答えてください。" },
  { id: "emergency",    persona: "an emergency operator answering your call",                    prompt: "Explain an urgent situation and ask for help.",                        promptJp: "緊急事態を説明し、助けを求めてください。" },
  { id: "family",       persona: "a family member catching up with you",                         prompt: "Catch up with a family member about your week.",                       promptJp: "家族と最近の一週間について話してください。" },
  { id: "dating",       persona: "someone you're on a first date with",                          prompt: "Keep a friendly conversation going on a first date.",                  promptJp: "初デートで楽しく会話を続けてください。" },
  { id: "problem_solve",persona: "a friend who mixed up plans with you",                          prompt: "Politely sort out a misunderstanding with someone.",                   promptJp: "相手との誤解を丁寧に解決してください。" },
];

export const QUICK_THINKING_ROUNDS = [
  { id: "warmup",     persona: "an energetic, friendly quiz host who asks easy warm-up questions and reacts with enthusiasm", prompt: "Start a warm-up round with light, easy personal questions, one at a time.",        promptJp: "簡単な自己紹介系の質問からウォームアップラウンドを始めてください。" },
  { id: "opinions",   persona: "an energetic, friendly quiz host who asks quick opinion and preference questions",             prompt: "Ask quick 'would you rather' and preference questions, one at a time.",             promptJp: "「どっちが好き?」のような質問を一つずつ聞いてください。" },
  { id: "storytime",  persona: "an energetic, friendly quiz host who loves hearing quick personal stories",                    prompt: "Ask for a quick personal story or memory, then a fun follow-up question.",          promptJp: "短い思い出やエピソードを聞き、楽しいフォローアップ質問をしてください。" },
  { id: "imagination",persona: "an energetic, friendly quiz host who asks playful hypothetical questions",                     prompt: "Ask playful hypothetical 'what would you do if...' questions, one at a time.",      promptJp: "「もし〜だったら?」という仮定の質問を一つずつしてください。" },
  { id: "rapidfire",  persona: "an energetic, friendly quiz host running a fast-paced rapid-fire round",                       prompt: "Run a rapid-fire round — quick describe-it and finish-the-sentence prompts.",       promptJp: "素早い描写や文の続きを答えるラピッドファイアラウンドをしてください。" },
];

export const PICTURE_SCENES = [
  { id: "train_station", persona: "an encouraging conversation partner asking you to describe and discuss a scene", prompt: "A busy morning at a train station — commuters rushing while a food cart owner prepares breakfast.", promptJp: "駅の忙しい朝 — 急ぐ通勤客と朝食を準備する屋台のオーナー。" },
  { id: "birthday",      persona: "an encouraging conversation partner asking you to describe and discuss a scene", prompt: "A birthday party in a backyard, with balloons, a cake, and kids playing games.",                    promptJp: "庭でのお誕生日会 — 風船とケーキ、遊んでいる子どもたち。" },
  { id: "kitchen",       persona: "an encouraging conversation partner asking you to describe and discuss a scene", prompt: "A busy restaurant kitchen during the dinner rush, chefs moving quickly between stations.",           promptJp: "夕食時で忙しいレストランの厨房 — 素早く動くシェフたち。" },
  { id: "rainy_city",    persona: "an encouraging conversation partner asking you to describe and discuss a scene", prompt: "A rainy day in the city, people with umbrellas crossing a busy street.",                             promptJp: "雨の日の街 — 傘をさして交差点を渡る人々。" },
  { id: "hiking",        persona: "an encouraging conversation partner asking you to describe and discuss a scene", prompt: "A group of friends hiking up a mountain trail with a view of the valley below.",                     promptJp: "山道をハイキングする友人グループと谷の景色。" },
  { id: "market",        persona: "an encouraging conversation partner asking you to describe and discuss a scene", prompt: "A colorful farmers market with fresh fruit, vegetables, and vendors calling out prices.",            promptJp: "色とりどりのファーマーズマーケット — 新鮮な野菜と呼び込みの声。" },
  { id: "moving",        persona: "an encouraging conversation partner asking you to describe and discuss a scene", prompt: "Moving into a new apartment, boxes everywhere and furniture half-assembled.",                        promptJp: "新しいアパートへの引っ越し — 段ボールと組み立て途中の家具。" },
  { id: "beach",         persona: "an encouraging conversation partner asking you to describe and discuss a scene", prompt: "A beach vacation, people swimming, reading, and playing volleyball in the sun.",                     promptJp: "ビーチでのバケーション — 泳いだり読書したりバレーボールをする人々。" },
];

export const DEBATE_TOPICS = [
  { id: "wfh_office",    persona: "a friendly debate partner who takes a light opposing view to keep the discussion going", prompt: "Some people think working from home is better than working in an office. What do you think?", promptJp: "在宅勤務とオフィス勤務、どちらが良いと思いますか?" },
  { id: "social_media",  persona: "a friendly debate partner who takes a light opposing view to keep the discussion going", prompt: "Does social media do more good or more harm?",                                                  promptJp: "SNSは良い影響と悪い影響、どちらが大きいと思いますか?" },
  { id: "travel_style",  persona: "a friendly debate partner who takes a light opposing view to keep the discussion going", prompt: "Is it better to travel alone or with friends?",                                                 promptJp: "一人旅と友達との旅行、どちらが良いと思いますか?" },
  { id: "student_jobs",  persona: "a friendly debate partner who takes a light opposing view to keep the discussion going", prompt: "Should university students have part-time jobs?",                                              promptJp: "大学生はアルバイトをするべきだと思いますか?" },
  { id: "ai_smart",      persona: "a friendly debate partner who takes a light opposing view to keep the discussion going", prompt: "Is AI making people smarter, or lazier?",                                                      promptJp: "AIは人を賢くしていると思いますか、それとも怠惰にしていると思いますか?" },
  { id: "city_country",  persona: "a friendly debate partner who takes a light opposing view to keep the discussion going", prompt: "Is it better to live in the city or the countryside?",                                         promptJp: "都会と田舎、どちらに住むのが良いと思いますか?" },
  { id: "second_lang",   persona: "a friendly debate partner who takes a light opposing view to keep the discussion going", prompt: "How important is it to learn a second language?",                                              promptJp: "第二言語を学ぶことはどれくらい大切だと思いますか?" },
  { id: "homework",      persona: "a friendly debate partner who takes a light opposing view to keep the discussion going", prompt: "Should schools give students less homework?",                                                  promptJp: "学校は宿題を減らすべきだと思いますか?" },
];

export const PRACTICE_BANKS = {
  missions:       MISSIONS_SCENARIOS,
  quick_thinking: QUICK_THINKING_ROUNDS,
  picture:        PICTURE_SCENES,
  debate:         DEBATE_TOPICS,
};

export const CONFIDENCE_LEVELS = [
  { level: 1, name: "First Words",             nameJp: "最初のひとこと",     minXP: 0   },
  { level: 2, name: "Building Confidence",     nameJp: "自信を築く",         minXP: 100 },
  { level: 3, name: "Speaking Freely",         nameJp: "自由に話す",         minXP: 250 },
  { level: 4, name: "Natural Conversationalist", nameJp: "自然な会話力",     minXP: 450 },
  { level: 5, name: "Speak Ready",             nameJp: "スピーク準備完了",   minXP: 700 },
];

export const BADGES = [
  { id: "first_words",     name: "First Words",         nameJp: "最初のひとこと",       icon: "🗣️", desc: "Completed your first speaking session",         descJp: "最初のスピーキングセッションを完了しました" },
  { id: "mission_ready",   name: "Mission Ready",       nameJp: "ミッション準備完了",   icon: "🎯", desc: "Completed all Speaking Missions",                descJp: "スピーキングミッションを全て完了" },
  { id: "quick_thinker",   name: "Quick Thinker",       nameJp: "クイックシンカー",     icon: "⚡", desc: "Completed all Quick Thinking rounds",             descJp: "クイックシンキングを全て完了" },
  { id: "picture_perfect", name: "Picture Perfect",     nameJp: "ピクチャーパーフェクト", icon: "🖼️", desc: "Completed all Picture Speaking scenes",         descJp: "ピクチャースピーキングを全て完了" },
  { id: "great_debater",   name: "Great Debater",       nameJp: "グレートディベーター", icon: "💭", desc: "Completed all Debate & Discussion topics",       descJp: "ディベート・ディスカッションを全て完了" },
  { id: "confidence_builder", name: "Confidence Builder", nameJp: "自信を積み上げる",  icon: "🔥", desc: "Practiced 10 times across any category",         descJp: "いずれかのカテゴリーで10回練習しました" },
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
