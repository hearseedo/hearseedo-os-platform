// Sip Speak Learn — Conversation Games content (Phase 4)
// Static seasonal question/scenario banks — no AI calls, so games stay free to
// replay and cost nothing to the platform's AI-credit budget (Table Mode will
// follow the same "prepared banks first" rule in Phase 5).

// ── Conversation Roulette ───────────────────────────────────────────────────
// Six wheel categories, matching the approved wheel concept. Colors are sampled
// from the actual wheel-face artwork (public/ssl/games/ssl-wheel-face.png) in
// clockwise order from 12 o'clock, then brightened slightly for text legibility,
// so each category's UI color visually matches the wedge it lands on.
export const ROULETTE_CATEGORIES = [
  { id: "travel",  label: "Travel",      icon: "✈️", color: "#2c7a72" },
  { id: "food",    label: "Food",        icon: "🍽️", color: "#c99a3d" },
  { id: "memories",label: "Memories",    icon: "📷", color: "#8a3f72" },
  { id: "goals",   label: "Goals",       icon: "🏔️", color: "#c2651f" },
  { id: "culture", label: "Culture",     icon: "🌍", color: "#3f5f95" },
  { id: "fun",     label: "Just for Fun",icon: "🎉", color: "#a3232b" },
];

// Each question: { id, category, season (null = any), text, easier, deeper, phrases }
export const ROULETTE_QUESTIONS = [
  // Travel
  { id: "tr1", category: "travel", season: null, text: "What is a small winter memory that still makes you smile?", easier: "What is a happy memory from this year?", deeper: "How has a memory like that shaped who you are today?", phrases: ["This reminds me of...", "I can still remember...", "How about you?"] },
  { id: "tr2", category: "travel", season: null, text: "Where is your dream travel destination, and why?", easier: "What is a place you want to visit?", deeper: "What does travel actually give you that staying home doesn't?", phrases: ["I'd love to...", "Someday I want to...", "What about you?"] },
  { id: "tr3", category: "travel", season: "summer", text: "What's the best trip you've taken in the summer?", easier: "Do you like summer trips?", deeper: "How does travelling in summer compare to other seasons for you?", phrases: ["It was unforgettable because...", "The best part was...", "Have you ever...?"] },
  { id: "tr4", category: "travel", season: "winter", text: "Would you rather a snowy mountain trip or a warm beach escape in winter?", easier: "Do you prefer snow or sun?", deeper: "What does your ideal winter escape say about how you like to recharge?", phrases: ["I'm torn between...", "I'd pick... because...", "What would you choose?"] },
  { id: "tr5", category: "travel", season: null, text: "If you could live in another country for a year, where would you go?", easier: "Which country do you want to visit?", deeper: "What would you actually miss most about home if you lived abroad?", phrases: ["I'd choose... because...", "I think I'd miss...", "How about you?"] },

  // Food
  { id: "fo1", category: "food", season: null, text: "What's a dish that instantly makes you feel at home?", easier: "What is your favourite food?", deeper: "Why do certain foods carry so much emotional weight for us?", phrases: ["It reminds me of...", "Whenever I eat it, I...", "What's yours?"] },
  { id: "fo2", category: "food", season: null, text: "Do you prefer cooking at home or eating out? Why?", easier: "Do you like cooking?", deeper: "How has your relationship with food changed as you've gotten older?", phrases: ["I'm more of a... person", "Honestly, I...", "What about you?"] },
  { id: "fo3", category: "food", season: "fall", text: "What's your favourite comfort food when the weather turns cold?", easier: "What food keeps you warm?", deeper: "Why do we crave different foods depending on the season?", phrases: ["Nothing beats...", "I always crave...", "Same here / Not really"] },
  { id: "fo4", category: "food", season: null, text: "If you could only eat one cuisine for the rest of your life, what would it be?", easier: "What's your favourite type of food?", deeper: "What would you actually miss the most about variety in food?", phrases: ["Without a doubt...", "That's a tough one, but...", "What would you pick?"] },

  // Memories
  { id: "me1", category: "memories", season: null, text: "What's a small moment that became an important memory?", easier: "Tell me about a happy day.", deeper: "Why do you think small moments sometimes matter more than big ones?", phrases: ["It's funny how...", "That memory has stayed with me...", "Do you have one too?"] },
  { id: "me2", category: "memories", season: null, text: "Who is someone who really encouraged you when things were hard?", easier: "Who helps you when you're sad?", deeper: "How do you try to give that same support to others now?", phrases: ["I really appreciated...", "They always...", "Has someone done that for you?"] },
  { id: "me3", category: "memories", season: "fall", text: "What's a family tradition you remember fondly from this time of year?", easier: "What do you do with your family?", deeper: "How do traditions change as families grow or move apart?", phrases: ["We always used to...", "It's a bit different now, but...", "What did your family do?"] },
  { id: "me4", category: "memories", season: null, text: "What's the best celebration you've ever been part of?", easier: "Do you like parties?", deeper: "What makes a celebration actually feel meaningful rather than just fun?", phrases: ["I'll never forget...", "It felt so...", "What about you?"] },

  // Goals
  { id: "go1", category: "goals", season: null, text: "What's one goal you're working towards right now?", easier: "What do you want to do this year?", deeper: "What's actually stopping you from moving faster on that goal?", phrases: ["I'm working on...", "One step at a time...", "What about you?"] },
  { id: "go2", category: "goals", season: "winter", text: "Have you set any goals for the new year? How are they going?", easier: "What is one goal you have?", deeper: "Do you think New Year's resolutions actually help, or add pressure?", phrases: ["I'm keeping it realistic...", "So far, so good / not great, but...", "What's yours?"] },
  { id: "go3", category: "goals", season: null, text: "What habit would you most like to build?", easier: "What do you want to do more often?", deeper: "What usually gets in the way when you try to build a new habit?", phrases: ["I'm trying to...", "It's easier said than done, but...", "Any habit you're building?"] },
  { id: "go4", category: "goals", season: null, text: "How do you stay motivated when things get difficult?", easier: "What helps you keep going?", deeper: "Has your definition of 'success' changed as you've gotten older?", phrases: ["Having people to talk to...", "I remind myself that...", "What keeps you going?"] },

  // Culture
  { id: "cu1", category: "culture", season: null, text: "What's something from another culture you'd love to experience firsthand?", easier: "What country interests you?", deeper: "How do you think travel changes the way people see their own culture?", phrases: ["I've always wanted to...", "I'm curious about...", "What about you?"] },
  { id: "cu2", category: "culture", season: null, text: "How is socialising different in your home country versus abroad?", easier: "How do people relax where you're from?", deeper: "What's a cultural habit you've had to unlearn or adapt?", phrases: ["Where I'm from, we...", "It's quite different because...", "Have you noticed that too?"] },
  { id: "cu3", category: "culture", season: null, text: "What's a tradition from your culture you're proud of?", easier: "What is special about your culture?", deeper: "How do you decide which traditions to keep and which to let go of?", phrases: ["We take pride in...", "It means a lot because...", "Does your culture have something similar?"] },

  // Just for Fun
  { id: "fu1", category: "fun", season: null, text: "If you could instantly master any skill, what would you choose?", easier: "What skill do you want to learn?", deeper: "What's stopped you from actually learning it so far?", phrases: ["I'd love to be able to...", "Honestly, probably...", "What about you?"] },
  { id: "fu2", category: "fun", season: null, text: "What's a small thing that always makes you laugh?", easier: "What makes you happy?", deeper: "Why do you think humour matters so much in relationships?", phrases: ["Every time, without fail...", "It sounds silly, but...", "What about you?"] },
  { id: "fu3", category: "fun", season: null, text: "Would you rather always be 10 minutes late or 20 minutes early?", easier: "Are you usually early or late?", deeper: "What does that habit say about how you handle time and pressure?", phrases: ["I'd pick... because...", "Honestly, I'm always...", "What about you?"] },
  { id: "fu4", category: "fun", season: "summer", text: "What's the most fun you've had on a hot summer day?", easier: "What do you like doing in summer?", deeper: "Why do summer memories often feel more vivid than other seasons?", phrases: ["Probably the time I...", "Nothing beats...", "What about you?"] },
];

export function rouletteQuestionsFor(categoryId, seasonId) {
  const inCategory = ROULETTE_QUESTIONS.filter((q) => q.category === categoryId);
  const seasonal = inCategory.filter((q) => q.season === seasonId);
  return seasonal.length ? [...seasonal, ...inCategory.filter((q) => q.season === null)] : inCategory;
}

// ── Story Builder ────────────────────────────────────────────────────────
export const STORY_OPENERS = {
  spring: { setting: "A quiet café patio, cherry blossoms drifting past the window.", opener: "It was the first truly warm morning of spring, and something felt different the moment you stepped outside." },
  summer: { setting: "A rooftop terrace, string lights just switching on as the sun sets.", opener: "The whole city felt alive that evening — like anything could happen before the night was over." },
  fall:   { setting: "A cosy lounge, the first cold evening of the year, a fire crackling nearby.", opener: "You'd just sat down with a warm drink when someone unexpected walked through the door." },
  winter: { setting: "A snowy window seat, candles lit, the street outside glowing under streetlights.", opener: "The snow had been falling for hours, and you were about to find out why that mattered." },
};

export const STORY_SEQUENCING_PHRASES = ["At first...", "Suddenly...", "Because of that...", "Meanwhile...", "In the end..."];

export const STORY_TWISTS = [
  "Suddenly, someone you didn't expect walks in.",
  "You realise you've forgotten something important.",
  "The weather changes without warning.",
  "You get an unexpected message.",
  "A stranger says something that changes everything.",
  "You find something you weren't looking for.",
];

// ── Would You Rather ─────────────────────────────────────────────────────
export const WOULD_YOU_RATHER = [
  { id: "wr1", season: null, a: "Travel somewhere new every year", b: "Return to the same favourite place every year", followUp: "What does that choice say about you?" },
  { id: "wr2", season: null, a: "Have unlimited time", b: "Have unlimited money", followUp: "Why did you pick that one?" },
  { id: "wr3", season: null, a: "Be fluent in every language", b: "Be a world-class expert in one skill", followUp: "Which would actually help you more in life?" },
  { id: "wr4", season: "winter", a: "A cosy night in with a hot drink", b: "A lively night out with friends", followUp: "Which do you choose more often — and why?" },
  { id: "wr5", season: "summer", a: "A relaxing beach holiday", b: "An active outdoor adventure", followUp: "What kind of trip actually helps you recharge?" },
  { id: "wr6", season: null, a: "Always know what people are thinking", b: "Always know what's going to happen next", followUp: "Would that actually make life better?" },
  { id: "wr7", season: null, a: "Live in a big city", b: "Live somewhere quiet and rural", followUp: "What matters most to you about where you live?" },
  { id: "wr8", season: "fall", a: "A house full of guests for the holidays", b: "A quiet holiday with just close family", followUp: "What makes a gathering feel right for you?" },
  { id: "wr9", season: null, a: "Never have to sleep", b: "Never have to eat", followUp: "Which routine matters more to you?" },
  { id: "wr10", season: null, a: "Get honest feedback, even if it stings", b: "Get kind feedback, even if it's softened", followUp: "Why do you prefer that?" },
  { id: "wr11", season: "spring", a: "Start a garden", b: "Start a new hobby indoors", followUp: "What's stopping you from doing it already?" },
  { id: "wr12", season: null, a: "Be famous for something small", b: "Be completely unknown but very wealthy", followUp: "What would you actually choose, honestly?" },
];

export function wouldYouRatherFor(seasonId) {
  const seasonal = WOULD_YOU_RATHER.filter((q) => q.season === seasonId);
  const general = WOULD_YOU_RATHER.filter((q) => q.season === null);
  return [...seasonal, ...general];
}

// ── Order Challenge ──────────────────────────────────────────────────────
// Realistic café/bar/restaurant role-plays. Cocktail and mocktail always equal.
export const ORDER_SCENARIOS = [
  { id: "oc1", title: "Order a Drink", setting: "You've just sat down at the bar and the bartender greets you.", task: "Order a drink and make a little small talk.", phrases: ["I'll have a [drink], please.", "What do you recommend?", "Something refreshing, please."] },
  { id: "oc2", title: "Ask for a Recommendation", setting: "You can't decide what to order from a long drinks menu.", task: "Ask the bartender to recommend something and explain what you like.", phrases: ["What would you recommend?", "I usually like something...", "That sounds perfect."] },
  { id: "oc3", title: "Request a Mocktail", setting: "You're not drinking alcohol tonight, but still want something special.", task: "Ask politely for a great non-alcoholic option.", phrases: ["Could you make that alcohol-free?", "Do you have a good mocktail?", "Something with no alcohol, please."] },
  { id: "oc4", title: "Change an Ingredient", setting: "A drink sounds great, but one ingredient isn't for you.", task: "Politely ask for a small change to your order.", phrases: ["Could I get that without...?", "Is it possible to swap...?", "Not too sweet, please."] },
  { id: "oc5", title: "Explain a Preference", setting: "The server wants to understand what flavours you enjoy.", task: "Describe what you like so they can suggest the right drink or dish.", phrases: ["I'm looking for something...", "I tend to enjoy...", "Nothing too strong, please."] },
  { id: "oc6", title: "Ask About Food Pairing", setting: "You've ordered a drink and want something to go with it.", task: "Ask what food pairs well with your drink.", phrases: ["What pairs well with this?", "Would you recommend anything to eat?", "That sounds like a great match."] },
  { id: "oc7", title: "Correct an Order Politely", setting: "Your order arrived, but it isn't quite what you asked for.", task: "Politely let the server know and ask for it to be fixed.", phrases: ["I think there's been a small mix-up.", "I actually ordered...", "No worries, thank you for fixing it."] },
  { id: "oc8", title: "Start a Tab", setting: "You're planning to stay a while and order more than one round.", task: "Ask to start a tab for the evening.", phrases: ["Can we start a tab?", "I'll keep it open for now.", "Thank you!"] },
  { id: "oc9", title: "Pay the Bill", setting: "It's time to wrap up and settle the bill.", task: "Ask to close out and pay.", phrases: ["Can we close out, please?", "Do you take cards?", "Thank you, that was lovely."] },
];

export const GAMES = [
  { id: "roulette", name: "Conversation Roulette", icon: "🎡", desc: "Spin for a question, speak for two minutes.", color: "#8f2d3b", cover: "/ssl/games/ssl-game-roulette-bg.png" },
  { id: "story",    name: "Story Builder",         icon: "📖", desc: "Build a story together, one turn at a time.", color: "#1f6b63", cover: "/ssl/games/ssl-game-story.png" },
  { id: "rather",   name: "Would You Rather?",     icon: "🤔", desc: "Choose, explain, and challenge each other.", color: "#5b3f8c", cover: "/ssl/games/ssl-game-rather.png" },
  { id: "order",    name: "Order Challenge",       icon: "🍹", desc: "Realistic café and bar role-plays.", color: "#b5794a", cover: "/ssl/games/ssl-game-order.png" },
];

// Wheel graphics (Conversation Roulette)
export const WHEEL_FACE = "/ssl/games/ssl-wheel-face.png";
export const WHEEL_POINTER = "/ssl/games/ssl-wheel-pointer.png";
export const ROULETTE_BG = "/ssl/games/ssl-game-roulette-bg.png";
