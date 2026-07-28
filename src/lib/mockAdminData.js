// Mock admin data — used for admin panel MVP display
// TODO: Replace with real-time Firestore subscriptions

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
function hoursAgo(n) {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d.toISOString();
}
function minutesAgo(n) {
  const d = new Date();
  d.setMinutes(d.getMinutes() - n);
  return d.toISOString();
}
function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

export const MOCK_SIGNUPS = [
  {
    userId: "mock_001", name: "Yuki Tanaka", email: "yuki.t@example.com",
    userType: "University Student", accessCodeUsed: "UNI-READY-HSD",
    campaignCategory: "University", source: "university",
    selectedPath: "University Path", mainGoal: "Job interviews",
    signupTime: hoursAgo(2), lastActiveTime: minutesAgo(18),
    aiCreditsGranted: 30, aiCreditsUsed: 22, aiCreditsRemaining: 8,
    accessStatus: "active", activatedAt: hoursAgo(2), expiresAt: daysFromNow(28),
    sessionsCompleted: 5, confidenceScore: 4, savedPhrases: 12, badges: ["First Session", "Interview Ready"],
  },
  {
    userId: "mock_002", name: "Hana Sato", email: "hana.s@example.com",
    userType: "Parent", accessCodeUsed: "KINDER-HSD-2026",
    campaignCategory: "Kindergarten", source: "kindergarten",
    selectedPath: "Kids Path", mainGoal: "Phonics",
    signupTime: daysAgo(3), lastActiveTime: hoursAgo(5),
    aiCreditsGranted: 30, aiCreditsUsed: 14, aiCreditsRemaining: 16,
    accessStatus: "active", activatedAt: daysAgo(3), expiresAt: daysFromNow(27),
    sessionsCompleted: 3, confidenceScore: 3, savedPhrases: 7, badges: ["Phonics Star"],
  },
  {
    userId: "mock_003", name: "Kenji Watanabe", email: "kenji.w@example.com",
    userType: "Teacher", accessCodeUsed: "TEACHER-HSD-2026",
    campaignCategory: "Teacher", source: "teacher",
    selectedPath: "Adult Path", mainGoal: "Teacher support",
    signupTime: daysAgo(7), lastActiveTime: daysAgo(1),
    aiCreditsGranted: 30, aiCreditsUsed: 28, aiCreditsRemaining: 2,
    accessStatus: "active", activatedAt: daysAgo(7), expiresAt: daysFromNow(23),
    sessionsCompleted: 8, confidenceScore: 5, savedPhrases: 22, badges: ["Power User", "Confidence Builder"],
  },
  {
    userId: "mock_004", name: "Mika Yoshida", email: "mika.y@example.com",
    userType: "Workshop Attendee", accessCodeUsed: "WORKSHOP-HSD-2026",
    campaignCategory: "Workshop / Event / Partner", source: "workshop_event_partner",
    selectedPath: "Adult Path", mainGoal: "Speaking confidence",
    signupTime: daysAgo(1), lastActiveTime: hoursAgo(3),
    aiCreditsGranted: 30, aiCreditsUsed: 6, aiCreditsRemaining: 24,
    accessStatus: "active", activatedAt: daysAgo(1), expiresAt: daysFromNow(29),
    sessionsCompleted: 2, confidenceScore: 2, savedPhrases: 4, badges: [],
  },
  {
    userId: "mock_005", name: "Ryo Nakamura", email: "ryo.n@example.com",
    userType: "University Student", accessCodeUsed: "UNI-READY-HSD",
    campaignCategory: "University", source: "university",
    selectedPath: "University Path", mainGoal: "Study abroad",
    signupTime: daysAgo(12), lastActiveTime: daysAgo(2),
    aiCreditsGranted: 30, aiCreditsUsed: 30, aiCreditsRemaining: 0,
    accessStatus: "active", activatedAt: daysAgo(12), expiresAt: daysFromNow(18),
    sessionsCompleted: 9, confidenceScore: 4, savedPhrases: 18, badges: ["Study Abroad Ready", "Power User"],
  },
  {
    userId: "mock_006", name: "Aiko Fujimoto", email: "aiko.f@example.com",
    userType: "Parent", accessCodeUsed: "FAMILY-HSD-2026",
    campaignCategory: "Family", source: "family",
    selectedPath: "Family Path", mainGoal: "Parent-child English",
    signupTime: daysAgo(5), lastActiveTime: hoursAgo(8),
    aiCreditsGranted: 30, aiCreditsUsed: 10, aiCreditsRemaining: 20,
    accessStatus: "active", activatedAt: daysAgo(5), expiresAt: daysFromNow(25),
    sessionsCompleted: 3, confidenceScore: 3, savedPhrases: 9, badges: ["Family First"],
  },
  {
    userId: "mock_007", name: "Taro Ito", email: "taro.i@example.com",
    userType: "University Student", accessCodeUsed: "UNI-READY-HSD",
    campaignCategory: "University", source: "university",
    selectedPath: "University Path", mainGoal: "Presentations",
    signupTime: daysAgo(2), lastActiveTime: minutesAgo(45),
    aiCreditsGranted: 30, aiCreditsUsed: 4, aiCreditsRemaining: 26,
    accessStatus: "active", activatedAt: daysAgo(2), expiresAt: daysFromNow(28),
    sessionsCompleted: 1, confidenceScore: 2, savedPhrases: 3, badges: [],
  },
  {
    userId: "mock_008", name: "Nana Kobayashi", email: "nana.k@example.com",
    userType: "Adult Learner", accessCodeUsed: "WORKSHOP-HSD-2026",
    campaignCategory: "Workshop / Event / Partner", source: "workshop_event_partner",
    selectedPath: "Adult Path", mainGoal: "Travel English",
    signupTime: daysAgo(35), lastActiveTime: daysAgo(8),
    aiCreditsGranted: 30, aiCreditsUsed: 30, aiCreditsRemaining: 0,
    accessStatus: "expired", activatedAt: daysAgo(35), expiresAt: daysAgo(5),
    sessionsCompleted: 7, confidenceScore: 4, savedPhrases: 15, badges: ["Traveler", "Confident Speaker"],
  },
  {
    userId: "mock_009", name: "Shota Matsuda", email: "shota.m@example.com",
    userType: "University Student", accessCodeUsed: "UNI-READY-HSD",
    campaignCategory: "University", source: "university",
    selectedPath: "University Path", mainGoal: "Job interviews",
    signupTime: hoursAgo(5), lastActiveTime: hoursAgo(5),
    aiCreditsGranted: 30, aiCreditsUsed: 0, aiCreditsRemaining: 30,
    accessStatus: "active", activatedAt: hoursAgo(5), expiresAt: daysFromNow(30),
    sessionsCompleted: 0, confidenceScore: 0, savedPhrases: 0, badges: [],
  },
  {
    userId: "mock_010", name: "Emi Yamamoto", email: "emi.y@example.com",
    userType: "Parent", accessCodeUsed: "KINDER-HSD-2026",
    campaignCategory: "Kindergarten", source: "kindergarten",
    selectedPath: "Kids Path", mainGoal: "EIKEN practice",
    signupTime: daysAgo(4), lastActiveTime: daysAgo(4),
    aiCreditsGranted: 30, aiCreditsUsed: 0, aiCreditsRemaining: 30,
    accessStatus: "active", activatedAt: daysAgo(4), expiresAt: daysFromNow(26),
    sessionsCompleted: 0, confidenceScore: 0, savedPhrases: 0, badges: [],
  },
  {
    userId: "mock_011", name: "Jun Hayashi", email: "jun.h@example.com",
    userType: "Teacher", accessCodeUsed: "TEACHER-HSD-2026",
    campaignCategory: "Teacher", source: "teacher",
    selectedPath: "Adult Path", mainGoal: "Classroom support",
    signupTime: daysAgo(9), lastActiveTime: hoursAgo(12),
    aiCreditsGranted: 30, aiCreditsUsed: 19, aiCreditsRemaining: 11,
    accessStatus: "active", activatedAt: daysAgo(9), expiresAt: daysFromNow(21),
    sessionsCompleted: 5, confidenceScore: 4, savedPhrases: 11, badges: ["Educator"],
  },
  {
    userId: "mock_012", name: "Sara Kimura", email: "sara.k@example.com",
    userType: "Workshop Attendee", accessCodeUsed: "WORKSHOP-HSD-2026",
    campaignCategory: "Workshop / Event / Partner", source: "workshop_event_partner",
    selectedPath: "University Path", mainGoal: "Email writing",
    signupTime: daysAgo(6), lastActiveTime: daysAgo(3),
    aiCreditsGranted: 30, aiCreditsUsed: 8, aiCreditsRemaining: 22,
    accessStatus: "active", activatedAt: daysAgo(6), expiresAt: daysFromNow(24),
    sessionsCompleted: 2, confidenceScore: 3, savedPhrases: 6, badges: [],
  },
];

export const MOCK_EVENTS = [
  { eventId: "ev_001", timestamp: minutesAgo(18), eventType: "ai_credit_used", userId: "mock_001", email: "yuki.t@example.com", description: "Used 1 AI credit in Career Ready interview practice", accessCodeUsed: "UNI-READY-HSD", campaignCategory: "University", learningPath: "University Path", creditsRemaining: 8 },
  { eventId: "ev_002", timestamp: minutesAgo(45), eventType: "ai_credit_used", userId: "mock_007", email: "taro.i@example.com", description: "Used 1 AI credit in presentation feedback", accessCodeUsed: "UNI-READY-HSD", campaignCategory: "University", learningPath: "University Path", creditsRemaining: 26 },
  { eventId: "ev_003", timestamp: hoursAgo(2), eventType: "access_code_activated", userId: "mock_001", email: "yuki.t@example.com", description: "Activated UNI-READY-HSD", accessCodeUsed: "UNI-READY-HSD", campaignCategory: "University", learningPath: null, creditsRemaining: 30 },
  { eventId: "ev_004", timestamp: hoursAgo(3), eventType: "ai_credit_used", userId: "mock_004", email: "mika.y@example.com", description: "Used 1 AI credit in speaking practice", accessCodeUsed: "WORKSHOP-HSD-2026", campaignCategory: "Workshop / Event / Partner", learningPath: "Adult Path", creditsRemaining: 24 },
  { eventId: "ev_005", timestamp: hoursAgo(5), eventType: "access_code_activated", userId: "mock_009", email: "shota.m@example.com", description: "Activated UNI-READY-HSD", accessCodeUsed: "UNI-READY-HSD", campaignCategory: "University", learningPath: null, creditsRemaining: 30 },
  { eventId: "ev_006", timestamp: hoursAgo(8), eventType: "session_completed", userId: "mock_006", email: "aiko.f@example.com", description: "Completed parent-child English session", accessCodeUsed: "FAMILY-HSD-2026", campaignCategory: "Family", learningPath: "Family Path", creditsRemaining: 20 },
  { eventId: "ev_007", timestamp: hoursAgo(12), eventType: "ai_credit_used", userId: "mock_011", email: "jun.h@example.com", description: "Used 1 AI credit in classroom support practice", accessCodeUsed: "TEACHER-HSD-2026", campaignCategory: "Teacher", learningPath: "Adult Path", creditsRemaining: 11 },
  { eventId: "ev_008", timestamp: daysAgo(1), eventType: "access_code_activated", userId: "mock_004", email: "mika.y@example.com", description: "Activated WORKSHOP-HSD-2026", accessCodeUsed: "WORKSHOP-HSD-2026", campaignCategory: "Workshop / Event / Partner", learningPath: null, creditsRemaining: 30 },
  { eventId: "ev_009", timestamp: daysAgo(2), eventType: "access_code_activated", userId: "mock_007", email: "taro.i@example.com", description: "Activated UNI-READY-HSD", accessCodeUsed: "UNI-READY-HSD", campaignCategory: "University", learningPath: null, creditsRemaining: 30 },
  { eventId: "ev_010", timestamp: daysAgo(2), eventType: "low_credits", userId: "mock_003", email: "kenji.w@example.com", description: "Credits low — 2 remaining", accessCodeUsed: "TEACHER-HSD-2026", campaignCategory: "Teacher", learningPath: "Adult Path", creditsRemaining: 2 },
  { eventId: "ev_011", timestamp: daysAgo(2), eventType: "credits_exhausted", userId: "mock_005", email: "ryo.n@example.com", description: "All 30 AI credits used", accessCodeUsed: "UNI-READY-HSD", campaignCategory: "University", learningPath: "University Path", creditsRemaining: 0 },
  { eventId: "ev_012", timestamp: daysAgo(3), eventType: "session_completed", userId: "mock_002", email: "hana.s@example.com", description: "Completed phonics practice session", accessCodeUsed: "KINDER-HSD-2026", campaignCategory: "Kindergarten", learningPath: "Kids Path", creditsRemaining: 16 },
  { eventId: "ev_013", timestamp: daysAgo(8), eventType: "access_expired", userId: "mock_008", email: "nana.k@example.com", description: "Free month access expired", accessCodeUsed: "WORKSHOP-HSD-2026", campaignCategory: "Workshop / Event / Partner", learningPath: "Adult Path", creditsRemaining: 0 },
];
