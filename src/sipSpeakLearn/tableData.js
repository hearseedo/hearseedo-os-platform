// Sip Speak Learn — Table Mode content (Phase 5)
// Static seasonal question banks per round stage — same "prepared banks first"
// principle as Conversation Games, so live table events never spend AI credits
// unless a table explicitly asks for an AI-generated question (not yet wired;
// Another Question / Easier / Deeper all draw from these banks for now).

export const STAGES = ["warmup", "main", "challenge", "reflection"];
export const STAGE_LABELS = { warmup: "Warm-up", main: "Main Conversation", challenge: "Challenge", reflection: "Reflection" };

export const ROLES = [
  { id: "starter",  name: "Starter",         desc: "Reads the first question" },
  { id: "followup", name: "Follow-up Leader",desc: "Encourages deeper answers" },
  { id: "connector",name: "Connector",       desc: "Links ideas together" },
  { id: "encourager",name: "Encourager",     desc: "Celebrate and support" },
];

// Rotation colors used to instruct table movement between rounds.
export const ROTATION_COLORS = ["Gold", "Blue", "Rose", "Teal"];

// Per-season round banks. Each stage has a main question + 2 alternates (for
// "Another Question"), and easier/deeper variants of the main question.
const BANKS = {
  spring: {
    warmup:     { q: "What's one small thing that made you smile this week?", easier: "What made you happy today?", deeper: "How often do you pause to notice small good things?", alts: ["What's your favourite thing about spring so far?", "What are you looking forward to this week?"], phrases: ["For me, it's...", "I really appreciate...", "How about you?"] },
    main:       { q: "What does a fresh start mean to you right now?", easier: "What is something new in your life?", deeper: "What usually stops people from actually making a fresh start?", alts: ["What's a habit you're hoping to build this spring?", "Where would you go for a perfect spring day out?"], phrases: ["I'm thinking about...", "It feels like the right time to...", "What about you?"] },
    challenge:  { q: "Describe your ideal spring weekend in under 30 seconds.", easier: "What do you like doing on weekends?", deeper: "What does your ideal weekend say about what you value?", alts: ["Convince the table to try your favourite spring activity.", "Describe a spring memory without using the word 'flowers'."], phrases: ["Picture this...", "Trust me, you'd love it because...", "Your turn!"] },
    reflection: { q: "What's one thing you'll remember from this conversation?", easier: "What did you enjoy talking about?", deeper: "How did this conversation change how you see the topic?", alts: ["What's a phrase you heard tonight that you want to reuse?", "Who at this table surprised you tonight?"], phrases: ["I'll remember...", "I really enjoyed...", "Thank you for..."] },
  },
  summer: {
    warmup:     { q: "What does the perfect summer evening look like for you?", easier: "Do you like summer evenings?", deeper: "What is it about summer evenings specifically that people love?", alts: ["What's the best part of summer so far?", "Where's your favourite place to cool down?"], phrases: ["For me, it's...", "Honestly, I love...", "What about you?"] },
    main:       { q: "What makes a summer gathering feel memorable?", easier: "Do you like summer parties?", deeper: "Why do summer memories often feel more vivid than other seasons?", alts: ["What's a summer tradition you never skip?", "Beach, mountains, or city — where do you feel most alive?"], phrases: ["For me, it's...", "I really appreciate...", "How about you?"] },
    challenge:  { q: "Sell the table on your favourite warm-weather activity in 30 seconds.", easier: "What's your favourite summer activity?", deeper: "What would need to be true for you to actually do this more often?", alts: ["Describe a summer memory without using the word 'hot'.", "Plan a perfect day trip for this table right now."], phrases: ["Picture this...", "Trust me, you'd love it because...", "Your turn!"] },
    reflection: { q: "What's one thing you'll remember from this conversation?", easier: "What did you enjoy talking about?", deeper: "How did this conversation change how you see the topic?", alts: ["What's a phrase you heard tonight that you want to reuse?", "Who at this table surprised you tonight?"], phrases: ["I'll remember...", "I really enjoyed...", "Thank you for..."] },
  },
  fall: {
    warmup:     { q: "What's a small ritual that makes cooler evenings feel cozy?", easier: "Do you like cold weather?", deeper: "Why do we crave routine more as the seasons change?", alts: ["What's the best part of fall so far?", "What's your go-to warm drink right now?"], phrases: ["For me, it's...", "Honestly, I love...", "What about you?"] },
    main:       { q: "What's a tradition from this time of year you look forward to?", easier: "What do you do in autumn?", deeper: "How do traditions change as families and friend groups grow apart?", alts: ["What are you grateful for this season?", "What's a comfort food that feels like home?"], phrases: ["We always...", "It means a lot because...", "What about you?"] },
    challenge:  { q: "Convince the table your favourite comfort food is the best one, in 30 seconds.", easier: "What's your favourite comfort food?", deeper: "Why do certain foods carry so much emotional weight?", alts: ["Describe a fall memory without using the word 'leaves'.", "Plan the perfect cozy night in for this table."], phrases: ["Picture this...", "Trust me, you'd love it because...", "Your turn!"] },
    reflection: { q: "What's one thing you'll remember from this conversation?", easier: "What did you enjoy talking about?", deeper: "How did this conversation change how you see the topic?", alts: ["What's a phrase you heard tonight that you want to reuse?", "Who at this table surprised you tonight?"], phrases: ["I'll remember...", "I really enjoyed...", "Thank you for..."] },
  },
  winter: {
    warmup:     { q: "What's a small thing that makes a cold day better?", easier: "Do you like winter?", deeper: "How does winter weather affect people's routines and mood?", alts: ["What's the best part of winter so far?", "What's your go-to way to warm up?"], phrases: ["For me, it's...", "Honestly, I love...", "What about you?"] },
    main:       { q: "What makes a winter gathering feel welcoming?", easier: "Do you like winter parties?", deeper: "How do hosting expectations differ between cultures?", alts: ["What's a winter tradition that matters to you?", "What's one goal you have for the new year?"], phrases: ["For me, it's...", "I really appreciate...", "How about you?"] },
    challenge:  { q: "Sell the table on your favourite winter comfort in 30 seconds.", easier: "What's your favourite way to stay warm?", deeper: "What would need to change for you to actually slow down more?", alts: ["Describe a winter memory without using the word 'snow'.", "Plan a perfect cozy evening for this table right now."], phrases: ["Picture this...", "Trust me, you'd love it because...", "Your turn!"] },
    reflection: { q: "What's one thing you'll remember from this conversation?", easier: "What did you enjoy talking about?", deeper: "How did this conversation change how you see the topic?", alts: ["What's a phrase you heard tonight that you want to reuse?", "Who at this table surprised you tonight?"], phrases: ["I'll remember...", "I really enjoyed...", "Thank you for..."] },
  },
};

export function getStageContent(seasonId, stage) {
  const season = BANKS[seasonId] || BANKS.winter;
  return season[stage] || season.warmup;
}

export function pickAnotherQuestion(seasonId, stage, currentText) {
  const content = getStageContent(seasonId, stage);
  const pool = [content.q, ...content.alts].filter((t) => t !== currentText);
  return pool[Math.floor(Math.random() * pool.length)] || content.q;
}

// Rotation instruction text for a given mode (host-configured in Phase 6;
// defaults to "full" for the demo path in Phase 5).
export function rotationInstruction(mode = "full") {
  switch (mode) {
    case "none":    return "Stay at your table for the next round.";
    case "partner": return `${ROTATION_COLORS[0]} moves one seat to the right. Everyone else stays.`;
    case "half":    return `${ROTATION_COLORS[0]} and ${ROTATION_COLORS[1]} move one table clockwise. ${ROTATION_COLORS[2]} and ${ROTATION_COLORS[3]} stay.`;
    case "full":
    default:        return `${ROTATION_COLORS[0]} moves one table clockwise. ${ROTATION_COLORS[1]} stays.`;
  }
}

export function shortEventCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  let code = "";
  for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}
