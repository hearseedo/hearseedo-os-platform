// Students demo pathway — practice question bank. Copy lives in i18n keys
// (src/lib/i18n.js, students_demo_* block), never raw strings here, so the
// pathway is fully localized. Starter phrases are deliberately English —
// this is an English-speaking/writing practice exercise; only Jona's
// surrounding chrome and question framing are localized, matching how
// GlobalJonaAssistant itself separates chrome i18n from message content.
export const STUDENTS_QUESTIONS = [
  {
    id: "after-school",
    promptKey: "students_demo_q1_prompt",
    starters: [
      { id: "q1-s1", textKey: "students_demo_q1_starter_1" },
      { id: "q1-s2", textKey: "students_demo_q1_starter_2" },
    ],
    modelAnswerKey: "students_demo_q1_model",
  },
  {
    id: "favorite-subject",
    promptKey: "students_demo_q2_prompt",
    starters: [
      { id: "q2-s1", textKey: "students_demo_q2_starter_1" },
      { id: "q2-s2", textKey: "students_demo_q2_starter_2" },
    ],
    modelAnswerKey: "students_demo_q2_model",
  },
];
