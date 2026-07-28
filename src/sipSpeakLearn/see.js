// Sip Speak Learn — SEE support
// The workbooks give the six key phrases per lesson but not their meanings, so
// this module supplies concise, plain-English glosses + a natural example.
// A curated dictionary covers the common/recurring phrases; anything not listed
// falls back to a sensible category-based gloss so every card is still useful.
// (Meanings are standard ESL explanations, expanded over time — never invented facts.)

function norm(s) {
  return s.toLowerCase().replace(/[.?!…]+$/g, "").replace(/\[.*?\]/g, "").replace(/\s+/g, " ").trim();
}

// Curated meanings keyed by normalized phrase.
const MEANINGS = {
  // Greetings / openers
  "is this seat taken": "A polite way to ask if you may sit in an empty seat.",
  "i just moved to": "You use this to say you recently arrived in a new place.",
  "the weather has been perfect for": "A friendly way to comment on the weather and start a topic.",
  "i'm [name], by the way": "A relaxed way to introduce your name mid-conversation.",
  "how are you liking it so far": "You ask this to see how someone feels about something new.",
  "nice to meet you": "The standard friendly phrase when you meet someone for the first time.",
  "it finally feels like": "You use this when a season or change has clearly arrived.",
  "have you made any plans yet": "A natural way to ask about someone's upcoming plans.",
  "i'm hoping to": "A soft way to share something you'd like to do.",
  "same here": "A quick way to say you feel or plan the same thing.",
  "we should plan": "A friendly suggestion to arrange something together.",
  "there's a chill in the air": "A natural way to say the weather is turning cold.",
  "it's freezing out there": "An informal way to say it is very cold outside.",
  "at least it's warm inside": "You use this to find the positive side of cold weather.",

  // Interests / plans
  "what are you into lately": "A casual way to ask about someone's current interests.",
  "i'm thinking of": "You use this to share something you might do.",
  "i'm thinking about": "You use this to share something you're considering.",
  "you should": "A friendly way to encourage or recommend something.",
  "you should!": "An enthusiastic way to encourage someone to do something.",
  "i've been trying": "You use this to talk about something new you've started.",
  "that sounds nice": "A warm way to react positively to someone's idea.",
  "we could [do something] sometime": "A relaxed way to suggest doing something together later.",
  "would you be up for": "A casual way to invite someone to do an activity.",
  "i've always wanted to try it": "You use this to show real interest in something new.",
  "what do you usually do when": "A natural way to ask about someone's habits.",
  "i've been meaning to": "You use this for something you've intended to do but haven't yet.",

  // Travel
  "do you have any travel plans coming up": "A friendly way to ask about upcoming trips.",
  "i'm heading to": "A natural way to say where you're going.",
  "i haven't booked anything yet": "You use this to say your plans aren't finalised.",
  "are you getting away anywhere": "A casual way to ask if someone is taking a trip.",
  "have you booked anything": "A natural way to ask about trip arrangements.",
  "not yet": "A short way to say something hasn't happened so far.",
  "i'm weighing up my options": "You use this when you're still deciding between choices.",
  "have you thought about": "A gentle way to suggest an idea to someone.",
  "i'd love to": "An enthusiastic way to accept or express a wish.",
  "are you planning to go anywhere": "A natural way to ask about someone's plans to travel.",
  "have you checked the forecast": "A practical way to ask about the weather before plans.",
  "i'll keep an eye on it": "You use this to say you'll watch how something develops.",

  // Food / dining
  "what are you getting": "A casual way to ask what someone will order.",
  "i'm torn between": "You use this when you can't choose between two options.",
  "i think i'll go with": "A natural way to announce your choice.",
  "good choice": "A friendly way to approve of someone's decision.",
  "i can't decide": "A simple way to say you're unsure what to choose.",
  "i'm leaning towards": "You use this to show which option you prefer.",
  "how about you": "A quick way to turn a question back to the other person.",
  "let's order both and share": "A friendly suggestion to split dishes together.",
  "i need something warm": "You use this to express what you're craving in cold weather.",
  "i'm tempted by": "A natural way to say an option is attractive to you.",
  "we could share it": "A friendly suggestion to split a dish.",

  // Weekend / stories
  "how was your weekend": "The standard way to ask about someone's weekend.",
  "i ended up going to": "You use this for how your plans actually turned out.",
  "it was pretty low-key": "A casual way to say something was quiet and relaxed.",
  "it was packed": "An informal way to say a place was very crowded.",
  "busy weekend?": "A short, friendly way to ask if someone had a lot on.",
  "no way!": "An informal reaction showing surprise.",
  "how did that come about": "A natural way to ask how something happened.",
  "we just went for it": "You use this to say you decided to do something spontaneously.",

  // Goals / motivation
  "i really need to get organised": "You use this to express a wish to be more in control.",
  "that's ambitious!": "A supportive reaction to a big goal.",
  "it keeps me on track": "You use this to explain what helps you stay focused.",
  "i've set a goal to": "A clear way to state a goal.",
  "how are you staying motivated": "A natural way to ask what keeps someone going.",
  "i need to get back on track": "You use this about restarting after losing momentum.",
  "what's your main priority": "A natural way to ask what matters most right now.",
  "one step at a time": "A calm way to say you're making steady progress.",
  "have you set any goals": "A friendly way to ask about someone's goals.",

  // Social / hosting
  "do you know many people here": "A natural icebreaker at a gathering.",
  "it's a great turnout": "A positive comment about how many people came.",
  "would you like to come over": "A warm way to invite someone to your home.",
  "what time should i come": "A practical question when accepting an invitation.",
  "should i bring anything": "A polite offer to contribute to a gathering.",
  "if you don't mind": "A polite softener when asking or offering.",
  "of course": "A warm way to agree readily.",
  "i'm thinking of having people over": "A casual way to mention you might host.",
  "that sounds fun": "A friendly, positive reaction to a plan.",

  // Celebrations / gratitude
  "we should celebrate": "A cheerful suggestion to mark an occasion.",
  "here's to us!": "A warm toast to the people present.",
  "cheers!": "The common word said when raising a glass together.",
  "it feels so good to be done": "You use this to express relief at finishing something.",
  "what are you grateful for": "A thoughtful way to ask what someone appreciates.",
  "i'm grateful for": "A natural way to express gratitude.",
  "this reminds me of": "You use this to connect the present to a memory.",
  "what do you remember most": "A warm way to invite a memory.",
  "here's to staying connected": "A toast about keeping a relationship strong.",

  // Weather / coping / health
  "how are you coping with the cold": "A caring way to ask how someone handles the weather.",
  "how are you coping with it": "A caring way to ask how someone is managing something.",
  "that's sensible": "A supportive way to approve of a practical choice.",
  "it makes a big difference": "You use this to say something clearly helps.",
  "the atmosphere is amazing": "A positive comment about the mood of a place.",
  "good idea": "A quick, friendly way to agree with a suggestion.",
};

// Category hints for the fallback gloss.
function categoryGloss(phrase) {
  const p = norm(phrase);
  if (/(i'll have|could i (get|have)|can i get|one .* please|make it two|start a tab|close out|please)/.test(p))
    return "A natural, polite way to order or ask for something at a bar or café.";
  if (/\.\.\.$|…$/.test(phrase) || /^(i'm|i've|i'd|we could|we should|would you|have you|do you|what|how|shall we)/.test(p))
    return "A useful sentence starter you can finish in your own words.";
  return "A natural expression to use in this kind of conversation.";
}

// Find a natural example: prefer the lesson dialogue line that uses the phrase,
// else a matching ordering line, else the phrase itself.
function findExample(phrase, lesson) {
  const stem = norm(phrase).replace(/\[.*?\]/g, "").split("...")[0].trim();
  const key = stem.split(" ").slice(0, 3).join(" ");
  const fromDialogue = lesson?.dialogue?.find((d) => norm(d.line).includes(key) && key.length > 4);
  if (fromDialogue) return fromDialogue.line;
  const fromOrder = lesson?.mixAndSpeak?.find((m) => norm(m).includes(key) && key.length > 4);
  if (fromOrder) return fromOrder;
  return phrase.replace(/\[.*?\]/g, "…");
}

export function describePhrase(phrase, lesson) {
  const meaning = MEANINGS[norm(phrase)] || categoryGloss(phrase);
  return { meaning, example: findExample(phrase, lesson) };
}
