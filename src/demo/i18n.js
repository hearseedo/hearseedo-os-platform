// Tiny helper for Demo Mode's *Jp field convention (see data.js). Not a full
// STRINGS dictionary — mirrors how Dashboard.jsx/speakReady inline-translate
// page copy, since Demo Mode's UI chrome is small and page-specific.
export function pick(lang, en, jp) {
  return lang === "jp" && jp ? jp : en;
}

export const UI = {
  start: { en: "Start", jp: "スタート" },
  assessment: { en: "Assessment", jp: "アセスメント" },
  jonaDecision: { en: "Jona Decision", jp: "Jonaの決定" },
  confidenceApps: { en: "Confidence Apps", jp: "自信を育てるアプリ" },
  oneEngine: { en: "One Engine", jp: "ひとつのエンジン" },
  learning: { en: "Learning", jp: "レッスン" },
  progress: { en: "Progress", jp: "成長記録" },
  close: { en: "Complete", jp: "完了" },
  demoMode: { en: "Demo Mode", jp: "デモモード" },
  voiceOn: { en: "Jona's voice on", jp: "Jonaの音声：オン" },
  voiceOff: { en: "Jona's voice off", jp: "Jonaの音声：オフ" },
  restartDemo: { en: "Restart Demo", jp: "デモを再開" },
  exitDemo: { en: "Exit Demo", jp: "デモを終了" },
  back: { en: "← Back", jp: "← 戻る" },
  next: { en: "Next →", jp: "次へ →" },
  stepOf: { en: "Step {n} of {total}", jp: "ステップ {n} / {total}" },
};

export function ui(key, lang) {
  const entry = UI[key];
  if (!entry) return key;
  return lang === "jp" ? entry.jp : entry.en;
}
