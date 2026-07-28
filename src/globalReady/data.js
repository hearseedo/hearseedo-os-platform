// Global Ready — content banks
// University Path pathway inside HSDOS.AI. Confidence before correctness.
// Japanese fields (nameJp/descJp/promptJp) support the reading-support toggle
// for students who find English text hard to follow.

export const CATEGORIES = [
  {
    id:    "study_abroad",
    name:  "Study Abroad Coach",
    nameJp: "留学コーチ",
    desc:  "Practice real situations before you study abroad",
    descJp: "留学前に本番の場面を練習しよう",
    icon:  "🎓",
    color: "#2ec4b6",
  },
  {
    id:    "travel",
    name:  "Travel English Coach",
    nameJp: "旅行英語コーチ",
    desc:  "Airports, hotels, restaurants, and getting around",
    descJp: "空港・ホテル・レストラン・移動で使う英語",
    icon:  "✈️",
    color: "#f59e0b",
  },
  {
    id:    "friends",
    name:  "International Friends Coach",
    nameJp: "国際交流コーチ",
    desc:  "Make friends and keep the conversation going",
    descJp: "友達を作り、会話を続けよう",
    icon:  "🤝",
    color: "#e01010",
  },
  {
    id:    "campus",
    name:  "Campus Conversation Coach",
    nameJp: "キャンパス会話コーチ",
    desc:  "Talk with classmates, professors, and clubs",
    descJp: "クラスメート・教授・サークルとの会話",
    icon:  "🏫",
    color: "#4488ff",
  },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

export const STUDY_ABROAD_SCENARIOS = [
  { id: "self_intro",   persona: "a friendly classmate at your new university, meeting you for the first time",         prompt: "Introduce yourself to a new classmate on your first day.",                    promptJp: "初日に新しいクラスメートへ自己紹介をしてください。" },
  { id: "airport",      persona: "an immigration officer at the airport",                                                 prompt: "Answer the immigration officer's questions when you arrive in a new country.", promptJp: "入国審査官の質問に答えてください。" },
  { id: "homestay",     persona: "your homestay family's mother, welcoming you home",                                     prompt: "Talk with your homestay family about your day.",                              promptJp: "ホームステイ先の家族と一日の出来事について話してください。" },
  { id: "classmates",   persona: "a classmate sitting next to you before class starts",                                   prompt: "Make small talk with a classmate before class.",                              promptJp: "授業前にクラスメートと雑談してください。" },
  { id: "ask_teacher",  persona: "your teacher during office hours",                                                       prompt: "Ask your teacher for help understanding an assignment.",                      promptJp: "課題について先生に助けを求めてください。" },
  { id: "discussion",   persona: "your teacher leading a class discussion",                                               prompt: "Share your opinion during a classroom discussion.",                           promptJp: "クラスディスカッションで自分の意見を伝えてください。" },
  { id: "clubs",        persona: "a friendly club member inviting you to join",                                           prompt: "Ask about joining a university club or activity.",                            promptJp: "大学のサークルや活動への参加について尋ねてください。" },
  { id: "culture",      persona: "a curious classmate who has never been to Japan",                                       prompt: "Explain a part of Japanese culture to a classmate.",                           promptJp: "クラスメートに日本文化について説明してください。" },
  { id: "medical",      persona: "a pharmacist at a local pharmacy",                                                       prompt: "Explain your symptoms and ask for medicine.",                                  promptJp: "症状を説明し、薬について尋ねてください。" },
  { id: "homesick",     persona: "a caring student advisor checking in on you",                                            prompt: "Talk to your student advisor about feeling homesick.",                        promptJp: "ホームシックについて学生アドバイザーに相談してください。" },
];

export const TRAVEL_SCENARIOS = [
  { id: "checkin",      persona: "an airline check-in staff member",              prompt: "Check in for your flight at the airport counter.",              promptJp: "空港のカウンターでチェックインをしてください。" },
  { id: "immigration",  persona: "an immigration officer",                        prompt: "Answer immigration questions when entering a country.",         promptJp: "入国時の審査官の質問に答えてください。" },
  { id: "hotel",        persona: "a hotel front desk receptionist",               prompt: "Check in to your hotel room.",                                   promptJp: "ホテルにチェックインしてください。" },
  { id: "restaurant",   persona: "a restaurant server taking your order",         prompt: "Order a meal at a restaurant.",                                  promptJp: "レストランで食事を注文してください。" },
  { id: "shopping",     persona: "a shop assistant helping you find something",   prompt: "Ask a shop assistant for help finding an item.",                 promptJp: "店員に商品を探す手伝いをお願いしてください。" },
  { id: "directions",   persona: "a friendly local on the street",                prompt: "Ask a local for directions to a nearby landmark.",               promptJp: "近くの観光名所への道を地元の人に尋ねてください。" },
  { id: "transport",    persona: "a public transportation staff member",          prompt: "Ask which train or bus to take to get to your destination.",    promptJp: "目的地までの電車やバスについて尋ねてください。" },
  { id: "lost_item",    persona: "a lost-and-found staff member",                 prompt: "Report a lost item and describe it.",                            promptJp: "紛失物について届け出て、特徴を説明してください。" },
  { id: "emergency",    persona: "an emergency hotline operator",                 prompt: "Explain an emergency situation and ask for help.",               promptJp: "緊急事態を説明し、助けを求めてください。" },
  { id: "tourist_info", persona: "a tourist information center staff member",     prompt: "Ask a tourist information center for recommendations.",         promptJp: "観光案内所でおすすめを尋ねてください。" },
  { id: "small_talk",   persona: "a friendly traveler you just met",              prompt: "Make small talk with another traveler while waiting.",          promptJp: "待っている間に他の旅行者と雑談してください。" },
];

export const FRIENDS_SCENARIOS = [
  { id: "start_convo",   persona: "a new international friend you just met",  prompt: "Start a conversation with someone you just met.",                         promptJp: "出会ったばかりの人と会話を始めてください。" },
  { id: "ask_questions", persona: "a new international friend you just met",  prompt: "Ask natural follow-up questions to learn more about someone.",             promptJp: "相手のことをもっと知るための自然な質問をしてください。" },
  { id: "hobbies",       persona: "a new international friend you just met",  prompt: "Talk about your hobbies.",                                                 promptJp: "自分の趣味について話してください。" },
  { id: "interests",     persona: "a new international friend you just met",  prompt: "Talk about music, food, movies, sports, or travel you enjoy.",             promptJp: "好きな音楽・食べ物・映画・スポーツ・旅行について話してください。" },
  { id: "invite",        persona: "a new international friend you just met",  prompt: "Invite someone for coffee or lunch.",                                      promptJp: "コーヒーやランチに誘ってください。" },
  { id: "group",         persona: "a small group of international students",  prompt: "Join a group conversation that's already happening.",                     promptJp: "すでに始まっているグループの会話に加わってください。" },
  { id: "react",         persona: "a new international friend you just met",  prompt: "React naturally to something interesting your friend just said.",         promptJp: "友達の話に自然に反応してください。" },
  { id: "keep_going",    persona: "a new international friend you just met",  prompt: "Keep a conversation going instead of letting it end too soon.",            promptJp: "会話がすぐに終わらないように続けてください。" },
  { id: "explain_japan", persona: "a new international friend you just met",  prompt: "Explain something about Japan or Japanese culture.",                       promptJp: "日本や日本文化について説明してください。" },
  { id: "contact_info",  persona: "a new international friend you just met",  prompt: "Politely exchange contact information before saying goodbye.",             promptJp: "別れる前に丁寧に連絡先を交換してください。" },
];

export const CAMPUS_SCENARIOS = [
  { id: "intl_students", persona: "an international student you'd like to get to know",  prompt: "Start a conversation with an international student on campus.", promptJp: "キャンパスで留学生に話しかけてください。" },
  { id: "classmate_q",   persona: "a classmate in your lecture",                          prompt: "Ask a classmate a question about the course.",                   promptJp: "授業についてクラスメートに質問してください。" },
  { id: "group_project", persona: "a classmate in your group project",                    prompt: "Coordinate with a classmate on a group project.",                promptJp: "グループプロジェクトについてクラスメートと調整してください。" },
  { id: "professor",     persona: "your professor after class",                           prompt: "Talk with your professor after class.",                         promptJp: "授業後に教授と話してください。" },
  { id: "office_hours",  persona: "your professor during office hours",                   prompt: "Go to office hours to ask about your grade.",                    promptJp: "成績について尋ねるためオフィスアワーを訪ねてください。" },
  { id: "assignment",    persona: "your professor",                                       prompt: "Ask your professor a question about an assignment.",            promptJp: "課題について教授に質問してください。" },
  { id: "univ_events",   persona: "a student staffing a university event booth",          prompt: "Ask about an upcoming university event.",                       promptJp: "今度の大学のイベントについて尋ねてください。" },
  { id: "club_activity", persona: "a club leader",                                        prompt: "Talk to a club leader about a club activity.",                  promptJp: "サークルの活動についてサークルリーダーと話してください。" },
  { id: "exchange_event",persona: "another student at an international exchange event",   prompt: "Meet someone new at an international exchange event.",          promptJp: "国際交流イベントで新しい人と出会ってください。" },
  { id: "opinions",      persona: "your professor leading a class discussion",            prompt: "Give your opinion during a class discussion.",                  promptJp: "クラスディスカッションで自分の意見を述べてください。" },
];

export const PRACTICE_BANKS = {
  study_abroad: STUDY_ABROAD_SCENARIOS,
  travel:       TRAVEL_SCENARIOS,
  friends:      FRIENDS_SCENARIOS,
  campus:       CAMPUS_SCENARIOS,
};

export const CONFIDENCE_LEVELS = [
  { level: 1, name: "First Step",            nameJp: "最初の一歩",           minXP: 0   },
  { level: 2, name: "Traveler",              nameJp: "トラベラー",           minXP: 100 },
  { level: 3, name: "Conversation Builder",  nameJp: "会話を築く人",         minXP: 250 },
  { level: 4, name: "Global Communicator",   nameJp: "グローバルコミュニケーター", minXP: 450 },
  { level: 5, name: "Global Ready",          nameJp: "グローバル準備完了",   minXP: 700 },
];

export const BADGES = [
  { id: "first_global",     name: "First Global Practice",  nameJp: "初めてのグローバル練習", icon: "🌍", desc: "Completed your first practice conversation",        descJp: "最初の練習会話を完了しました" },
  { id: "travel_ready",     name: "Travel Ready",           nameJp: "旅行準備完了",           icon: "✈️", desc: "Completed all travel practice scenarios",           descJp: "旅行の練習シナリオを全て完了" },
  { id: "study_abroad_ready", name: "Study Abroad Ready",   nameJp: "留学準備完了",           icon: "🎓", desc: "Completed all study abroad practice scenarios",     descJp: "留学の練習シナリオを全て完了" },
  { id: "friendly_convo",   name: "Friendly Conversation",  nameJp: "フレンドリーな会話",     icon: "🤝", desc: "Completed all international friends scenarios",     descJp: "国際交流の練習シナリオを全て完了" },
  { id: "culture_connector",name: "Culture Connector",      nameJp: "文化のかけ橋",           icon: "🎌", desc: "Explained Japanese culture to someone new",         descJp: "新しい相手に日本文化を説明しました" },
  { id: "campus_communicator", name: "Campus Communicator", nameJp: "キャンパスコミュニケーター", icon: "🏫", desc: "Completed all campus conversation scenarios",     descJp: "キャンパス会話の練習シナリオを全て完了" },
  { id: "confidence_builder", name: "Confidence Builder",   nameJp: "自信を積み上げる",       icon: "🔥", desc: "Practiced 10 times across any category",             descJp: "いずれかのカテゴリーで10回練習しました" },
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
