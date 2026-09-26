// Educators demo pathway — three fictional sample learners with a small
// amount of understandable evidence, per spec. Explicitly labelled sample
// data throughout (never real students); the evidence/suggestion text is
// deterministic lookup content, not generated. i18n keys only, no raw
// strings, so this is fully localized.
export const SAMPLE_LEARNERS = [
  {
    id: "learner-a",
    nameKey: "educators_demo_learner_a_name",
    evidenceKey: "educators_demo_learner_a_evidence",
    suggestionKey: "educators_demo_learner_a_suggestion",
  },
  {
    id: "learner-b",
    nameKey: "educators_demo_learner_b_name",
    evidenceKey: "educators_demo_learner_b_evidence",
    suggestionKey: "educators_demo_learner_b_suggestion",
  },
  {
    id: "learner-c",
    nameKey: "educators_demo_learner_c_name",
    evidenceKey: "educators_demo_learner_c_evidence",
    suggestionKey: "educators_demo_learner_c_suggestion",
  },
];
