// HSD Family — beta content registry (Phase 3, 2026-09-09).
//
// Content model (item 11): kept deliberately close to the shape the brief
// suggested, but NOT a new parallel system — activityType "iframe_app"
// activities reuse the EXISTING apps.js/AppModal.jsx iframe+SSO mechanism
// (Phonics V2 is already a registered, working sub-app; this just surfaces
// it inside Family Home instead of building a second embed mechanism).
// activityType "jona" activities reuse the existing /api/chat pipeline via
// src/family/jonaFamily.js — no new AI service.
//
// Every entry below is REAL, reusable HSD IP (see docs/PHASE_3_CONTENT_AUDIT.md
// for the full inventory this was drawn from) — no filler activities were
// added just to hit a numeric target. Where the beta-minimum target (item 33)
// isn't met by real content yet, the category is left smaller rather than
// padded — see the Phase 3 report's Content Inventory section.
//
// Shape:
//   activityId, title, titleJp, category (hear|see|do|talk|create|hub),
//   ageBands (subset of AGE_BANDS ids), activityType, duration (minutes),
//   skills, media, curriculum, completionCriteria, icon

export const AGE_BANDS = [
  { id: "early_years", label: "Early Years",  labelJp: "幼児期",     range: "3-5" },
  { id: "elementary",  label: "Elementary",   labelJp: "小学生",     range: "6-11" },
  { id: "junior_high", label: "Junior High",  labelJp: "中学生",     range: "12-14" },
  { id: "teen",        label: "Teen",         labelJp: "ティーン",   range: "15-18" },
];

const AUDIO_BASE = "/assets/hsd/family/audio/hear";

export const HEAR_ACTIVITIES = [
  { activityId: "hear-hello-song",      title: "Hello Song",                  titleJp: "ハローソング",       category: "hear", ageBands: ["early_years", "elementary"], activityType: "audio", duration: 3, skills: ["listening", "greetings"], media: { audioUrl: `${AUDIO_BASE}/hello-song.mp3` }, curriculum: { source: "HSD Music" }, completionCriteria: "audio_played", icon: "👋" },
  { activityId: "hear-head-shoulders",  title: "Head, Shoulders, Knees & Toes", titleJp: "頭・肩・膝・つま先", category: "hear", ageBands: ["early_years", "elementary"], activityType: "audio", duration: 3, skills: ["listening", "body_vocab", "movement"], media: { audioUrl: `${AUDIO_BASE}/head-shoulders-knees-toes.mp3` }, curriculum: { source: "HSD Music" }, completionCriteria: "audio_played", icon: "🙆" },
  { activityId: "hear-banana-chant",    title: "Banana Chant",                titleJp: "バナナチャント",     category: "hear", ageBands: ["early_years", "elementary"], activityType: "audio", duration: 2, skills: ["listening", "rhythm"], media: { audioUrl: `${AUDIO_BASE}/banana-chant.mp3` }, curriculum: { source: "HSD Music" }, completionCriteria: "audio_played", icon: "🍌" },
  { activityId: "hear-banana-words",    title: "Banana Words Song",           titleJp: "バナナワーズソング", category: "hear", ageBands: ["early_years", "elementary"], activityType: "audio", duration: 3, skills: ["listening", "vocabulary"], media: { audioUrl: `${AUDIO_BASE}/banana-words-song.mp3` }, curriculum: { source: "HSD Music" }, completionCriteria: "audio_played", icon: "🎵" },
  { activityId: "hear-daily-routines",  title: "Daily Routines Song",         titleJp: "デイリールーティンソング", category: "hear", ageBands: ["elementary", "junior_high"], activityType: "audio", duration: 3, skills: ["listening", "daily_life_vocab"], media: { audioUrl: `${AUDIO_BASE}/daily-routines-song.mp3` }, curriculum: { source: "HSD Music" }, completionCriteria: "audio_played", icon: "⏰" },
  { activityId: "hear-phonics-theme",   title: "Monkey Yoga Phonics Theme",   titleJp: "モンキーヨガフォニックス テーマ", category: "hear", ageBands: ["early_years", "elementary"], activityType: "audio", duration: 2, skills: ["listening", "phonics"], media: { audioUrl: `${AUDIO_BASE}/monkey-yoga-phonics-theme.mp3` }, curriculum: { book: "Monkey Yoga Phonics" }, completionCriteria: "audio_played", icon: "🐵" },
  { activityId: "hear-talk-unlock-theme", title: "Monkeys Talk & Unlock Theme", titleJp: "モンキーズ・トーク＆アンロック テーマ", category: "hear", ageBands: ["elementary", "junior_high"], activityType: "audio", duration: 2, skills: ["listening"], media: { audioUrl: `${AUDIO_BASE}/monkeys-talk-unlock-theme.mp3` }, curriculum: { book: "Monkeys Talk & Unlock" }, completionCriteria: "audio_played", icon: "🔓" },
  { activityId: "hear-phonics-app",     title: "Listen with Monkey Yoga Phonics", titleJp: "モンキーヨガフォニックスで聞く", category: "hear", ageBands: ["early_years", "elementary"], activityType: "iframe_app", duration: 10, skills: ["listening", "phonics"], media: { appId: "phonics" }, curriculum: { book: "Monkey Yoga Phonics" }, completionCriteria: "app_progress_event", icon: "🎧" },
  // Fall seasonal audio (HSD Family Seasonal Audio Integration — Fall, 2026-09-18).
  { activityId: "hear-apple-tree-yoga",     title: "Apple Tree Yoga Song",         titleJp: "りんごの木のヨガソング", category: "hear", ageBands: ["early_years", "elementary"], activityType: "audio", duration: 3, skills: ["listening", "movement"], media: { audioUrl: `${AUDIO_BASE}/apple-tree-yoga-song.mp3` }, curriculum: { source: "HSD Music", season: "fall" }, completionCriteria: "audio_played", icon: "🍎" },
  { activityId: "hear-five-little-pumpkins-yoga", title: "Five Little Pumpkins Yoga Song", titleJp: "５つの小さなかぼちゃのヨガソング", category: "hear", ageBands: ["early_years", "elementary"], activityType: "audio", duration: 3, skills: ["listening", "movement", "counting"], media: { audioUrl: `${AUDIO_BASE}/five-little-pumpkins-yoga-song.mp3` }, curriculum: { source: "HSD Music", season: "fall" }, completionCriteria: "audio_played", icon: "🎃" },
];

export const SEE_ACTIVITIES = [
  { activityId: "see-phonics-app",      title: "Explore Monkey Yoga Phonics", titleJp: "モンキーヨガフォニックスを見る", category: "see", ageBands: ["early_years", "elementary"], activityType: "iframe_app", duration: 10, skills: ["reading", "letters", "vocabulary"], media: { appId: "phonics" }, curriculum: { book: "Monkey Yoga Phonics", books: "1-4" }, completionCriteria: "app_progress_event", icon: "📖" },
  { activityId: "see-wondercamp-story", title: "WonderCamp Story Explorer",   titleJp: "ワンダーキャンプ ストーリー探検", category: "see", ageBands: ["elementary", "junior_high"], activityType: "iframe_app", duration: 10, skills: ["reading", "vocabulary", "imagination"], media: { appId: "wondercamp" }, curriculum: { source: "WonderCamp" }, completionCriteria: "app_progress_event", icon: "🏕️" },
  // Real WonderCamp lesson vocab (src/pages/WonderCamp.jsx), presented as a
  // standalone vocabulary-preview activity rather than requiring the full
  // camp session — legitimate reuse of existing curriculum, not new content.
  { activityId: "see-bug-explorer-vocab", title: "Garden Bug Explorer: New Words", titleJp: "ガーデンバグ探検：新しい単語", category: "see", ageBands: ["early_years", "elementary"], activityType: "instructions", duration: 4, skills: ["vocabulary", "reading"], media: { imageUrl: "/assets/hsd/family/backgrounds/family-reading.webp" }, curriculum: { source: "WonderCamp", lesson: "Garden Bug Explorer Camp" }, completionCriteria: "manual", icon: "🐛" },
  { activityId: "see-rainy-day-vocab",  title: "Rainbow Rain Boots: New Words", titleJp: "レインボー長靴：新しい単語", category: "see", ageBands: ["early_years", "elementary"], activityType: "instructions", duration: 4, skills: ["vocabulary", "reading"], media: { imageUrl: "/assets/hsd/family/backgrounds/family-reading.webp" }, curriculum: { source: "WonderCamp", lesson: "Rainbow Rain Boots Day" }, completionCriteria: "manual", icon: "🌧️" },
];

export const DO_ACTIVITIES = [
  { activityId: "do-phonics-poses",     title: "Do the Phonics Poses",        titleJp: "フォニックス・ポーズをやってみよう", category: "do", ageBands: ["early_years", "elementary"], activityType: "iframe_app", duration: 8, skills: ["movement", "phonics", "physical_response"], media: { appId: "phonics" }, curriculum: { book: "Monkey Yoga Phonics" }, completionCriteria: "app_progress_event", icon: "🤸" },
  { activityId: "do-body-song-action",  title: "Move with Head, Shoulders, Knees & Toes", titleJp: "頭・肩・膝・つま先で動こう", category: "do", ageBands: ["early_years", "elementary"], activityType: "instructions", duration: 3, skills: ["movement", "body_vocab"], media: { audioUrl: `${AUDIO_BASE}/head-shoulders-knees-toes.mp3`, imageUrl: "/assets/hsd/family/backgrounds/family-movement.webp" }, curriculum: { source: "HSD Music" }, completionCriteria: "manual", icon: "🕺" },
  { activityId: "do-family-scavenger",  title: "English Scavenger Hunt",      titleJp: "英語スカベンジャーハント", category: "do", ageBands: ["elementary", "junior_high"], activityType: "instructions", duration: 10, skills: ["vocabulary", "speaking", "movement"], media: { imageUrl: "/assets/hsd/family/backgrounds/family-games.webp" }, curriculum: { source: "HSD Family" }, completionCriteria: "manual", icon: "🔍" },
  // Real WonderCamp lesson movement activities, adapted as standalone Do
  // activities (same reuse rationale as the See entries above).
  { activityId: "do-super-kid-power",   title: "Super Kid Power Day",         titleJp: "スーパーキッドパワーデー", category: "do", ageBands: ["early_years", "elementary"], activityType: "instructions", duration: 5, skills: ["movement", "physical_response"], media: { imageUrl: "/assets/hsd/family/backgrounds/family-movement.webp" }, curriculum: { source: "WonderCamp", lesson: "Super Kid Power Day" }, completionCriteria: "manual", icon: "💪" },
  { activityId: "do-frog-pond-splash",  title: "Frog Pond Splash",            titleJp: "カエルの池スプラッシュ", category: "do", ageBands: ["early_years", "elementary"], activityType: "instructions", duration: 5, skills: ["movement", "physical_response"], media: { imageUrl: "/assets/hsd/family/backgrounds/family-movement.webp" }, curriculum: { source: "WonderCamp", lesson: "Frog Pond Splash Camp" }, completionCriteria: "manual", icon: "🐸" },
  // Fall seasonal audio (HSD Family Seasonal Audio Integration — Fall, 2026-09-18).
  // Same pattern as do-body-song-action: audio + image + generic follow-along
  // instructions, manual completion. Ordered together so they appear adjacent
  // in the Do grid, matching the intended Apple Tree → Five Little Pumpkins flow.
  { activityId: "do-apple-tree-yoga",   title: "Apple Tree Yoga Song",         titleJp: "りんごの木のヨガソング", category: "do", ageBands: ["early_years", "elementary"], activityType: "instructions", duration: 3, skills: ["movement", "listening"], media: { audioUrl: `${AUDIO_BASE}/apple-tree-yoga-song.mp3`, imageUrl: "/assets/hsd/family/backgrounds/family-movement.webp" }, curriculum: { source: "HSD Music", season: "fall" }, completionCriteria: "manual", icon: "🍎" },
  { activityId: "do-five-little-pumpkins-yoga", title: "Five Little Pumpkins Yoga Song", titleJp: "５つの小さなかぼちゃのヨガソング", category: "do", ageBands: ["early_years", "elementary"], activityType: "instructions", duration: 3, skills: ["movement", "listening", "counting"], media: { audioUrl: `${AUDIO_BASE}/five-little-pumpkins-yoga-song.mp3`, imageUrl: "/assets/hsd/family/backgrounds/family-movement.webp" }, curriculum: { source: "HSD Music", season: "fall" }, completionCriteria: "manual", icon: "🎃" },
];

export const TALK_ACTIVITIES = [
  { activityId: "talk-first-hello",     title: "Say Hello to Jona",           titleJp: "Jonaにあいさつしよう", category: "talk", ageBands: ["early_years", "elementary"], activityType: "jona", duration: 5, skills: ["speaking", "greetings", "confidence"], media: {}, curriculum: { source: "Jona Family" }, completionCriteria: "jona_turns:2", icon: "👋" },
  { activityId: "talk-my-day",          title: "Tell Jona About Your Day",    titleJp: "今日の出来事をJonaに話そう", category: "talk", ageBands: ["elementary", "junior_high"], activityType: "jona", duration: 6, skills: ["speaking", "daily_life_vocab", "confidence"], media: {}, curriculum: { source: "Jona Family" }, completionCriteria: "jona_turns:3", icon: "☀️" },
  { activityId: "talk-favourite-thing", title: "Show and Tell",               titleJp: "見せて話そう", category: "talk", ageBands: ["elementary", "junior_high"], activityType: "jona", duration: 6, skills: ["speaking", "description", "confidence"], media: {}, curriculum: { source: "Jona Family" }, completionCriteria: "jona_turns:3", icon: "🧸" },
  { activityId: "talk-family-member",   title: "Talk About Your Family",      titleJp: "家族について話そう", category: "talk", ageBands: ["elementary", "junior_high", "teen"], activityType: "jona", duration: 6, skills: ["speaking", "family_vocab", "confidence"], media: {}, curriculum: { source: "Jona Family" }, completionCriteria: "jona_turns:3", icon: "👨‍👩‍👧" },
  { activityId: "talk-brave-question",  title: "Ask Jona a Brave Question",   titleJp: "勇気を出してJonaに質問しよう", category: "talk", ageBands: ["junior_high", "teen"], activityType: "jona", duration: 6, skills: ["speaking", "curiosity", "confidence"], media: {}, curriculum: { source: "Jona Family" }, completionCriteria: "jona_turns:2", icon: "🙋" },
];

export const CREATE_ACTIVITIES = [
  { activityId: "create-sentence",      title: "Make a Sentence",             titleJp: "文を作ろう", category: "create", ageBands: ["early_years", "elementary"], activityType: "jona", duration: 5, skills: ["writing", "grammar", "creativity"], media: {}, curriculum: { source: "Jona Family" }, completionCriteria: "jona_turns:2", icon: "✏️" },
  { activityId: "create-character",     title: "Invent a Character",          titleJp: "キャラクターを作ろう", category: "create", ageBands: ["elementary", "junior_high"], activityType: "jona", duration: 8, skills: ["speaking", "vocabulary", "creativity"], media: {}, curriculum: { source: "Jona Family" }, completionCriteria: "jona_turns:3", icon: "🦸" },
  { activityId: "create-short-story",   title: "Build a Short Story",         titleJp: "短いお話を作ろう", category: "create", ageBands: ["elementary", "junior_high", "teen"], activityType: "jona", duration: 10, skills: ["writing", "narrative", "creativity"], media: {}, curriculum: { source: "Jona Family" }, completionCriteria: "jona_turns:4", icon: "📚" },
  { activityId: "create-describe-picture", title: "Describe Your Picture",    titleJp: "絵を説明しよう", category: "create", ageBands: ["early_years", "elementary"], activityType: "jona", duration: 5, skills: ["speaking", "description"], media: {}, curriculum: { source: "Jona Family" }, completionCriteria: "jona_turns:2", icon: "🎨" },
  { activityId: "create-dialogue",      title: "Create a Dialogue",           titleJp: "会話を作ろう", category: "create", ageBands: ["junior_high", "teen"], activityType: "jona", duration: 8, skills: ["speaking", "dialogue", "creativity"], media: {}, curriculum: { source: "Jona Family" }, completionCriteria: "jona_turns:3", icon: "💬" },
];

export const HUB_ACTIVITIES = [
  { activityId: "hub-sing-together",    title: "Sing Together: Hello Song",   titleJp: "一緒に歌おう：ハローソング", category: "hub", ageBands: ["early_years", "elementary"], activityType: "audio", duration: 3, skills: ["family_bonding", "listening"], media: { audioUrl: `${AUDIO_BASE}/hello-song.mp3`, imageUrl: "/assets/hsd/family/backgrounds/family-music.webp" }, curriculum: { source: "HSD Music" }, completionCriteria: "manual", icon: "🎤" },
  { activityId: "hub-family-scavenger", title: "Family English Scavenger Hunt", titleJp: "家族で英語スカベンジャーハント", category: "hub", ageBands: ["elementary", "junior_high"], activityType: "instructions", duration: 15, skills: ["family_bonding", "vocabulary", "movement"], media: { imageUrl: "/assets/hsd/family/backgrounds/family-games.webp" }, curriculum: { source: "HSD Family" }, completionCriteria: "manual", icon: "🔍" },
  { activityId: "hub-dinner-talk",      title: "Dinner Table English",        titleJp: "夕食テーブル英会話", category: "hub", ageBands: ["elementary", "junior_high", "teen"], activityType: "instructions", duration: 10, skills: ["family_bonding", "speaking"], media: { imageUrl: "/assets/hsd/family/backgrounds/family-parent.webp" }, curriculum: { source: "HSD Family" }, completionCriteria: "manual", icon: "🍽️" },
  { activityId: "hub-story-time",       title: "Family Story Time",           titleJp: "家族でストーリータイム", category: "hub", ageBands: ["early_years", "elementary"], activityType: "instructions", duration: 10, skills: ["family_bonding", "reading", "listening"], media: { imageUrl: "/assets/hsd/family/backgrounds/family-story.webp" }, curriculum: { source: "HSD Family" }, completionCriteria: "manual", icon: "📖" },
  { activityId: "hub-move-together",    title: "Move Together: Body Song",    titleJp: "一緒に動こう：ボディソング", category: "hub", ageBands: ["early_years", "elementary"], activityType: "audio", duration: 3, skills: ["family_bonding", "movement"], media: { audioUrl: `${AUDIO_BASE}/head-shoulders-knees-toes.mp3`, imageUrl: "/assets/hsd/family/backgrounds/family-movement.webp" }, curriculum: { source: "HSD Music" }, completionCriteria: "manual", icon: "🕺" },
];

export const CATEGORIES = ["hear", "see", "do", "talk", "create", "hub"];

export const ALL_ACTIVITIES = [
  ...HEAR_ACTIVITIES, ...SEE_ACTIVITIES, ...DO_ACTIVITIES,
  ...TALK_ACTIVITIES, ...CREATE_ACTIVITIES, ...HUB_ACTIVITIES,
];

export function getActivitiesByCategory(category, ageBand = null) {
  const list = ALL_ACTIVITIES.filter(a => a.category === category);
  return ageBand ? list.filter(a => a.ageBands.includes(ageBand)) : list;
}

export function getActivity(activityId) {
  return ALL_ACTIVITIES.find(a => a.activityId === activityId) ?? null;
}

// Instructions for activityType: "instructions" entries — kept as a
// separate lookup rather than bloating each activity object above.
export const INSTRUCTIONS = {
  "do-body-song-action":  { en: "Play the song. Touch your head, shoulders, knees, and toes as you sing along. Go faster each time!", jp: "曲を流して、歌いながら頭・肩・膝・つま先を触ろう。だんだん早くしてみよう！" },
  "do-family-scavenger":  { en: "Pick 5 English words (e.g. \"chair\", \"window\", \"blue\"). Race around the house to find and point at each one, saying it out loud in English.", jp: "英単語を5つ選ぼう（例：chair, window, blue）。家の中を探して見つけたら、英語で声に出して言おう。" },
  "do-super-kid-power":   { en: "Say \"I am strong!\" and flex your arms. Jump as high as you can 5 times, counting in English.", jp: "「I am strong!」と言って腕を曲げよう。英語で数えながら、できるだけ高くジャンプを5回しよう。" },
  "do-frog-pond-splash":  { en: "Crouch down like a frog and say \"Ribbit, jump!\" — then jump forward. Repeat 5 times, moving across the room.", jp: "カエルのようにしゃがんで「Ribbit, jump!」と言ってから前にジャンプしよう。部屋を移動しながら5回繰り返そう。" },
  "do-apple-tree-yoga":   { en: "Play the song. Stand tall and stretch your arms up like apple tree branches. Sway side to side in the wind, then reach up high to \"pick\" an apple!", jp: "曲を流して、りんごの木の枝のように腕を高く伸ばして立とう。風に揺れるように左右に揺れて、最後は高く手を伸ばしてりんごを「摘んで」みよう！" },
  "do-five-little-pumpkins-yoga": { en: "Play the song. Curl up small like a tiny pumpkin seed, then slowly grow round and big. Count to five together in English as you move!", jp: "曲を流して、小さなかぼちゃの種のように丸くなろう。ゆっくり大きく丸く育とう。動きながら英語で一緒に５まで数えよう！" },
  "see-bug-explorer-vocab": { en: "New words: Bug, Butterfly, Flower. Look for a picture or a real one of each — point and say the word in English.", jp: "新しい単語：Bug, Butterfly, Flower。それぞれの絵や実物を探して、指さしながら英語で言おう。" },
  "see-rainy-day-vocab":  { en: "New words: Rain, Umbrella, Jump. Look out the window (or a picture) and describe what you see using these words.", jp: "新しい単語：Rain, Umbrella, Jump。窓の外（または絵）を見て、これらの単語を使って説明しよう。" },
  "hub-family-scavenger": { en: "Everyone picks 3 English words. Race to find and say each one out loud — whoever finishes first picks the next game!", jp: "みんなで英単語を3つずつ選ぼう。見つけて声に出して言う競争をしよう。一番早い人が次のゲームを選ぼう！" },
  "hub-dinner-talk":      { en: "At dinner, take turns saying one thing in English: your favourite part of today, a color you saw, or a food you like.", jp: "夕食で順番に英語で一言：今日の一番好きな出来事、見た色、好きな食べ物など。" },
  "hub-story-time":       { en: "Pick a favourite story. Read it together, and have your child point to and name 3 things they recognise in English.", jp: "好きなお話を選ぼう。一緒に読んで、お子さんに知っているものを3つ英語で指させて言わせよう。" },
};
