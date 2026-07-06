import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS } from "../constants/colors";

// ─── Full 36-lesson dataset ───────────────────────────────────────────────────
const MONTHS = [
  {
    month: "April", theme: "Spring Adventure Camp", emoji: "🌸",
    color: "#ff4d94", gradient: "linear-gradient(135deg,#ff7eb3,#ff4d94)",
    lessons: [
      {
        num: 1, title: "Cherry Blossom Breeze Picnic", song: "Blow, Blow Cherry Blossoms",
        vocab: ["Pink", "Flower", "Blow"],
        ns: "Pink! / Flower!", nc: "I see flowers.", no: "I see pink flowers.",
        materials: ["🩷 pink scarves", "🪂 parachute", "🌸 flowers", "🏀 balls"],
        setup: ["Scatter fake flowers on the floor before students enter", "Give each student 1 pink scarf", "Parachute unfolded in the centre"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Pink! Flower! — wave scarf dramatically in the air. Students copy scarf wave and repeat words." },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Blow! — blow scarf into the air, catch it. Students blow scarves and repeat the action word." },
          { name: "Parachute Game", time: "8 min", desc: "Teacher: Make the blossoms blow! — toss flowers onto parachute, students wave it to make them 'fly'." },
          { name: "Toss & Catch", time: "4 min", desc: "Teacher: Throw the flower! — toss soft balls across parachute. Students catch and call Pink! or Flower!" },
          { name: "Cool Down", time: "2 min", desc: "Teacher: Play song, sing and model slow scarf wave. Students wave scarves slowly, gradually sit and breathe." },
        ],
      },
      {
        num: 2, title: "Rainbow Rain Boots Day", song: "Jump in the Puddle!",
        vocab: ["Rain", "Umbrella", "Jump"],
        ns: "Rainy!", nc: "It's rainy.", no: "I need my umbrella.",
        materials: ["☂️ umbrellas", "🎵 shakers", "💧 puddle spots", "🏀 balls"],
        setup: ["Place floor markers (puddle spots) around the room", "Give each student an umbrella or pretend with arms overhead", "Shakers ready at each seat"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Rainy! Rainy! — tap knees in rain-drip rhythm. Students copy rhythm and call Rainy!" },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Rain! — shake shaker overhead. Umbrella! — open umbrella dramatically. Students repeat." },
          { name: "Puddle Jumps", time: "8 min", desc: "Teacher: Jump! — model big two-footed landing on a puddle spot. Students jump puddle to puddle." },
          { name: "Command Freeze", time: "4 min", desc: "Teacher: Rainy! → students run. Jump! → students jump to nearest puddle. Stop! → everyone freezes." },
          { name: "Cool Down", time: "2 min", desc: "Students jump slowly in rhythm to song, shake instruments, gradually stop." },
        ],
      },
      {
        num: 3, title: "Bunny Trail Treasure Hunt", song: "Hop Hop Bunny Go!",
        vocab: ["Bunny", "Egg", "Find"],
        ns: "Bunny!", nc: "I found an egg!", no: "I found a blue egg!",
        materials: ["🥚 eggs", "🧺 baskets", "🎯 nerf balls"],
        setup: ["Hide Easter eggs around the room before students arrive", "Give each student a small basket", "Nerf target set up for the game phase"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Bunny! Bunny! — hop with hands up like ears. Students hop around calling Bunny!" },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Egg! — hold up eggs, show different colours. Students say the colour and Egg!" },
          { name: "Treasure Hunt", time: "8 min", desc: "Teacher: Find the egg! — point around the room to start. Students hunt and call I found an egg!" },
          { name: "Colour Call Game", time: "4 min", desc: "Teacher: Blue egg! — call a colour. Students race to find the matching egg." },
          { name: "Cool Down", time: "2 min", desc: "Students hop slowly back to their spots. Count eggs together gently." },
        ],
      },
    ],
  },
  {
    month: "May", theme: "Golden Sky Festival", emoji: "🎏",
    color: "#2ab5ab", gradient: "linear-gradient(135deg,#4ecdc4,#2ab5ab)",
    lessons: [
      {
        num: 4, title: "Koinobori Sky Dance", song: "Fly Fish Fly!",
        vocab: ["Fish", "Fly", "Sky"],
        ns: "Fish!", nc: "It can fly.", no: "The fish is flying in the sky.",
        materials: ["🎀 ribbons", "🎊 streamers", "🌬️ fans"],
        setup: ["Hang or hold koinobori fish banners at child height", "Give each student a ribbon or streamer", "Fans ready to create wind effect"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Fish! Fish! — swim motion with arms. Students copy and repeat Fish!" },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Fly! — hold ribbon and run, let it stream behind. Wind! — fan vigorously at ribbons." },
          { name: "Sky Dance", time: "8 min", desc: "Teacher: Make the fish fly! — model ribbon waving overhead in figure-8." },
          { name: "Wind Race", time: "4 min", desc: "Teacher: Ready… Wind! — fan streamers toward the finish line." },
          { name: "Cool Down", time: "2 min", desc: "Students drift ribbons slowly to the ground, sit and breathe deeply." },
        ],
      },
      {
        num: 5, title: "Super Kid Power Day", song: "I Am Strong!",
        vocab: ["Strong", "Jump", "High"],
        ns: "Strong!", nc: "I am strong.", no: "I can jump high!",
        materials: ["🔶 cones", "🏀 balls", "🥁 drums"],
        setup: ["Set up cones in an obstacle circuit", "Drums at stations", "Balls stacked ready"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Strong! — flex both arms dramatically. Students flex and shout Strong!" },
          { name: "Power Moves", time: "8 min", desc: "Teacher: Jump! — leap over cone. High! — reach arms up. Students repeat moves and words." },
          { name: "Super Circuit", time: "8 min", desc: "Teacher: Go! — signal start of circuit. Students complete jumps, beats, and throws calling Strong! at each." },
          { name: "Drum Challenge", time: "4 min", desc: "Teacher: Hit the drum! Boom! Students run to drum, hit it, call I am strong!" },
          { name: "Cool Down", time: "2 min", desc: "Students march slowly around the room, gradually sitting and breathing." },
        ],
      },
      {
        num: 6, title: "Garden Bug Explorer Camp", song: "Creepy Crawly Go!",
        vocab: ["Bug", "Butterfly", "Flower"],
        ns: "Bug!", nc: "I see a butterfly.", no: "I see a butterfly on a flower.",
        materials: ["🐞 bug toys", "🧣 scarves"],
        setup: ["Scatter bug toys around the room", "Give each student a scarf for butterfly wings", "Designate 'flower' spots with floor circles"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Bug! Bug! — crawl dramatically. Students crawl and call Bug!" },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Butterfly! — wave scarf like wings. Flower! — sit in circle pose. Students repeat and act." },
          { name: "Bug Hunt", time: "8 min", desc: "Teacher: Find the bug! Students search, pick up a bug, call I see a bug!" },
          { name: "Butterfly Game", time: "4 min", desc: "Teacher: Fly to the flower! Students flutter scarves and land on flower spots." },
          { name: "Cool Down", time: "2 min", desc: "Students flutter scarves slowly, float to the ground like a butterfly landing." },
        ],
      },
    ],
  },
  {
    month: "June", theme: "Rainy Rhythm Camp", emoji: "🌧️",
    color: "#2098b8", gradient: "linear-gradient(135deg,#45b7d1,#2098b8)",
    lessons: [
      {
        num: 7, title: "Thunder Drum Parade", song: "Boom Boom Thunder!",
        vocab: ["Boom", "Loud", "Thunder"],
        ns: "Boom!", nc: "It's loud!", no: "The thunder is loud.",
        materials: ["🥁 drums", "🥢 sticks", "🧣 scarves"],
        setup: ["Drums at every seat or shared pairs", "Sticks distributed to all students", "Scarves for wave section"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Boom! — hit drum once, huge reaction. Students copy hit and shout Boom!" },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Loud! — bang drum very loud. Thunder! — roll hands on drum fast. Students repeat." },
          { name: "Drum Parade", time: "8 min", desc: "Teacher: Parade! — march holding drum, students follow in a circle parade hitting and calling Boom!" },
          { name: "Thunder Game", time: "4 min", desc: "Teacher: Soft thunder! → quiet taps. LOUD thunder! → full power hits. Students match energy to call." },
          { name: "Cool Down", time: "2 min", desc: "Students tap drum very quietly, slowing to silence. It's loud → it's quiet." },
        ],
      },
      {
        num: 8, title: "Frog Pond Splash Camp", song: "Ribbit Jump!",
        vocab: ["Frog", "Jump", "Pond"],
        ns: "Jump!", nc: "The frog can jump.", no: "The frog jumps in the pond.",
        materials: ["🟢 lily pads", "🏀 balls", "⭕ hoops"],
        setup: ["Lay lily pad spots (green circles) across the floor", "Set up hoops as pond sections", "Soft balls ready as 'flies' to catch"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Frog! Frog! — squat low and jump forward dramatically. Students squat and jump like frogs." },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Jump! — leap from spot to spot. Splash! — slap hands on knees like hitting water." },
          { name: "Pond Game", time: "8 min", desc: "Teacher: Jump to the lily pad! — point to different spots. Students hop from pad to pad calling Jump!" },
          { name: "Fly Catch", time: "4 min", desc: "Teacher: Catch the fly! — toss soft ball up. Students jump and catch calling The frog can jump!" },
          { name: "Cool Down", time: "2 min", desc: "Students slow motion hop back to their spot, sit and breathe like a calm pond." },
        ],
      },
      {
        num: 9, title: "Rainbow Umbrella Orchestra", song: "Ring the Rainbow Bells!",
        vocab: ["Rainbow", "Umbrella", "Colorful"],
        ns: "Rainbow!", nc: "I have an umbrella.", no: "My umbrella is colorful.",
        materials: ["☂️ umbrellas", "🔔 bells"],
        setup: ["Give each child a coloured umbrella or colour strip", "Bells at each seat", "Draw a colour rainbow on the board for reference"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Rainbow! — draw a rainbow arc in the air with both arms. Students draw the same arc." },
          { name: "Colour Orchestra", time: "8 min", desc: "Teacher: Red! — point to red, ring bell once. Blue! — ring twice. Students ring bell when their colour is called." },
          { name: "Orchestra Game", time: "8 min", desc: "Teacher: Open your umbrella! Ring your bell! — conduct like a conductor. Students perform on cue." },
          { name: "Rainbow Song", time: "4 min", desc: "Teacher leads song pointing to each umbrella colour. Students: My umbrella is colorful! — hold umbrellas open overhead." },
          { name: "Cool Down", time: "2 min", desc: "Students slowly close umbrellas, hum the rainbow song softly while breathing." },
        ],
      },
    ],
  },
  {
    month: "July", theme: "Ocean Quest Camp", emoji: "🌊",
    color: "#1A9BD4", gradient: "linear-gradient(135deg,#f9c74f,#f4a829)",
    lessons: [
      {
        num: 10, title: "Pirate Treasure Beach", song: "Ahoy Treasure!",
        vocab: ["Treasure", "Beach", "Found"],
        ns: "Treasure!", nc: "I found treasure!", no: "I found treasure on the beach!",
        materials: ["💎 treasure", "🪙 coins", "🗺️ maps"],
        setup: ["Scatter gold coins and 'gems' around the room", "Give each student a treasure map", "Mark X spots with tape"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Treasure! — eyes wide, excited gesture. Students copy and call Treasure!" },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Beach! — walk in sand mime. Found! — pick up an object dramatically. Students repeat actions and words." },
          { name: "Map Hunt", time: "8 min", desc: "Teacher: Follow the map! — trace the path. Students navigate to X spots and call I found treasure!" },
          { name: "Coin Toss", time: "4 min", desc: "Teacher: Toss the coin! Students throw coins into a bucket calling Found!" },
          { name: "Cool Down", time: "2 min", desc: "Students count treasure slowly, whisper I found treasure on the beach." },
        ],
      },
      {
        num: 11, title: "Mermaid Lagoon Dance", song: "Under the Sea Sway!",
        vocab: ["Shell", "Sea", "Mermaid"],
        ns: "Shell!", nc: "I see a shell.", no: "I see a shell in the sea.",
        materials: ["🧣 scarves", "🐚 shells"],
        setup: ["Give each student a blue scarf as 'water'", "Shells at each spot", "Mark a 'lagoon' area in the centre"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Mermaid! — sway arms side to side in swimming motion. Students copy and call Mermaid!" },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Shell! — hold up shell dramatically. Sea! — wave blue scarf like water. Students repeat." },
          { name: "Lagoon Dance", time: "8 min", desc: "Teacher: Swim to the shell! — model swimming motion to a shell. Students dance/swim and collect shells." },
          { name: "Shell Toss", time: "4 min", desc: "Teacher: Throw it! Students toss shells into a 'sea' hoop calling I see a shell!" },
          { name: "Cool Down", time: "2 min", desc: "Students sway scarves gently, breathe in rhythm with the 'waves'." },
        ],
      },
      {
        num: 12, title: "Shark Surf Rescue", song: "Swim Fast Shark!",
        vocab: ["Swim", "Shark", "Fast"],
        ns: "Swim!", nc: "I can swim.", no: "I can swim fast!",
        materials: ["🟦 mats", "🔶 cones"],
        setup: ["Mats as 'surfboards' or 'islands'", "Cones marking the swim path", "One student or teacher plays the 'shark'"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Shark! — do the shark fin on head, chasing motion. Students scatter calling Swim!" },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Fast! — sprint between cones. Swim! — crawl forward quickly. Students repeat speed and word." },
          { name: "Shark Game", time: "8 min", desc: "Teacher: Shark is coming — swim fast! Students run/crawl to the island mats calling I can swim!" },
          { name: "Race", time: "4 min", desc: "Students race between safe zones calling I can swim fast! on each crossing." },
          { name: "Cool Down", time: "2 min", desc: "Students slow motion swim back to their mats, breathe like the ocean is calm." },
        ],
      },
    ],
  },
  {
    month: "August", theme: "Festival Star Camp", emoji: "🏮",
    color: "#d96d00", gradient: "linear-gradient(135deg,#f77f00,#d96d00)",
    lessons: [
      {
        num: 13, title: "Lantern Night Parade", song: "Glow Little Lantern!",
        vocab: ["Light", "Lantern", "Beautiful"],
        ns: "Light!", nc: "I see a lantern.", no: "I see beautiful lanterns.",
        materials: ["🏮 lanterns", "🌟 glow sticks"],
        setup: ["Darken the room slightly", "Give each student a lantern or glow stick", "Mark the parade path around the room"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Light! — switch on glow stick dramatically. Students gasp and call Light!" },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Lantern! — hold up lantern. Beautiful! — gesture like something amazing. Students repeat." },
          { name: "Night Parade", time: "8 min", desc: "Teacher leads parade holding lantern high. Students follow, waving lanterns and calling I see beautiful lanterns!" },
          { name: "Glow Game", time: "4 min", desc: "Teacher: Lights off! → everyone whispers. Light! → everyone cheers and raises lanterns." },
          { name: "Cool Down", time: "2 min", desc: "Students hold lanterns low, whisper Beautiful lanterns, slowly lower and close eyes." },
        ],
      },
      {
        num: 14, title: "Firework Boom Show", song: "Boom Bang Firework!",
        vocab: ["Firework", "Boom", "Beautiful"],
        ns: "Boom!", nc: "I see fireworks!", no: "The fireworks are beautiful!",
        materials: ["🎀 ribbons", "🥁 drums"],
        setup: ["Ribbons at each spot", "Drums or buckets for boom sounds", "Dark area if possible for effect"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Boom! — hit drum loud, throw arms out. Students copy explosion gesture and call Boom!" },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Firework! — throw ribbon up and watch it fall. Beautiful! — sweep arms wide. Students repeat." },
          { name: "Firework Show", time: "8 min", desc: "Teacher: Ready… Boom! — students throw ribbons and call I see fireworks!" },
          { name: "Colour Call", time: "4 min", desc: "Teacher: Red firework! Students wave red ribbon. Blue! Students wave blue. All colours! — everyone!" },
          { name: "Cool Down", time: "2 min", desc: "Students let ribbons drift slowly to the floor, whispering The fireworks are beautiful." },
        ],
      },
      {
        num: 15, title: "Star Wish Camp", song: "Twinkle Wish Star!",
        vocab: ["Star", "Wish", "Night"],
        ns: "Star!", nc: "I want a star.", no: "I have a wish.",
        materials: ["⭐ star cards", "✨ stickers"],
        setup: ["Star cards at each seat", "Stickers for writing/drawing wishes", "Dim lighting if available"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Star! — shoot both arms up like a star shape. Students copy and call Star!" },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Wish! — close eyes and make a wish gesture. Night! — spread arms wide like the dark sky." },
          { name: "Star Throw", time: "8 min", desc: "Teacher: Throw your star to the sky! Students toss star cards up and call I want a star!" },
          { name: "Wish Cards", time: "4 min", desc: "Students draw/write a wish on their star card. Teacher circulates: What's your wish? Students answer in English." },
          { name: "Cool Down", time: "2 min", desc: "Students hold star cards to their hearts, whisper I have a wish, close eyes and breathe." },
        ],
      },
    ],
  },
  {
    month: "September", theme: "Harvest Adventure Camp", emoji: "🍎",
    color: "#4d7a34", gradient: "linear-gradient(135deg,#6a994e,#4d7a34)",
    lessons: [
      {
        num: 16, title: "Moon Rabbit Rice Party", song: "Moon Rabbit Dance!",
        vocab: ["Moon", "Rabbit", "Bright"],
        ns: "Moon!", nc: "I see the moon.", no: "The moon is big and bright.",
        materials: ["🐰 rabbit props", "🟦 mats"],
        setup: ["Moon circle on the floor (large circle of tape)", "Rabbit ears headbands for students", "Mat as 'rice pounding' station"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Moon! — arms form a big circle above head. Students copy and call Moon!" },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Rabbit! — hop with ears up. Bright! — shield eyes from bright light gesture. Students repeat." },
          { name: "Moon Dance", time: "8 min", desc: "Teacher leads dance around the moon circle. Students hop and call I see the moon!" },
          { name: "Rice Pounding", time: "4 min", desc: "Teacher: Pound! — mime pounding rice with a stick. Students pound in rhythm calling Moon!" },
          { name: "Cool Down", time: "2 min", desc: "Students sit in the moon circle, breathe slowly, whispering The moon is big and bright." },
        ],
      },
      {
        num: 17, title: "Apple Orchard Adventure", song: "Pick the Apple Song!",
        vocab: ["Apple", "Pick", "Red"],
        ns: "Apple!", nc: "I pick apples.", no: "I pick red apples.",
        materials: ["🍎 apples", "🧺 baskets"],
        setup: ["Set up baskets at each station", "Hang or place pretend apples at different heights", "Mark tree zones with tape or a cone"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Apple! — reach up high as if picking from a tree. Students reach and call Apple!" },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Pick! — grasp and pull motion. Red! — point to red things around the room. Students repeat." },
          { name: "Orchard Pick", time: "8 min", desc: "Teacher: Pick the red apple! Students walk to apple stations, pick, place in basket calling I pick apples!" },
          { name: "Sorting", time: "4 min", desc: "Teacher: Red apple here! Students sort different colour apples. Which is red? — students call Red!" },
          { name: "Cool Down", time: "2 min", desc: "Students sit with baskets, count apples slowly in English: one, two, three…" },
        ],
      },
      {
        num: 18, title: "Scarecrow Dance Field", song: "Dance Scarecrow Dance!",
        vocab: ["Scarecrow", "Hat", "Field"],
        ns: "Hat!", nc: "It's a scarecrow.", no: "The scarecrow is in the field.",
        materials: ["🎩 hats", "🧣 scarves"],
        setup: ["Hats for all students", "Mark the 'field' area with tape", "Scarves as bird props"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Scarecrow! — stand with arms straight out. Students hold the pose and call Scarecrow!" },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Hat! — put on hat dramatically. Field! — sweep arms to indicate the space. Students repeat." },
          { name: "Scarecrow Freeze", time: "8 min", desc: "Teacher: Birds coming — scare them! Students become scarecrows in the field, flapping and calling Scarecrow!" },
          { name: "Hat Game", time: "4 min", desc: "Teacher: Whose hat? — toss hats gently. Students scramble to find their hat calling Hat!" },
          { name: "Cool Down", time: "2 min", desc: "Students stand as still as a scarecrow, slowly lower arms and sit." },
        ],
      },
    ],
  },
  {
    month: "October", theme: "Mystery Forest Camp", emoji: "🎃",
    color: "#5e1e6a", gradient: "linear-gradient(135deg,#7b2d8b,#5e1e6a)",
    lessons: [
      {
        num: 19, title: "Pumpkin Forest Party", song: "Pumpkin Glow!",
        vocab: ["Pumpkin", "Orange", "Big"],
        ns: "Pumpkin!", nc: "It's a pumpkin.", no: "It's a big orange pumpkin.",
        materials: ["🎃 pumpkins", "💡 lights"],
        setup: ["Place pumpkins (real or foam) around the room", "Fairy lights or glow for atmosphere", "Orange construction paper at each seat"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Pumpkin! — make a big round belly shape. Students copy and call Pumpkin!" },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Orange! — point to orange around the room. Big! — spread arms as wide as possible. Students repeat." },
          { name: "Pumpkin Roll", time: "8 min", desc: "Teacher: Roll the big pumpkin! Students roll foam balls calling It's a pumpkin!" },
          { name: "Jack-o-lantern", time: "4 min", desc: "Students draw a pumpkin face on their orange paper. Teacher: What face? — students describe in English." },
          { name: "Cool Down", time: "2 min", desc: "Students hug their 'pumpkin' round belly pose and breathe slowly." },
        ],
      },
      {
        num: 20, title: "Witch Hat Magic School", song: "Abracadabra!",
        vocab: ["Magic", "Hat", "Wand"],
        ns: "Magic!", nc: "I have a hat.", no: "I have a magic hat.",
        materials: ["🎩 hats", "🪄 wands"],
        setup: ["Witch hats for all students", "Wand (pencil/stick) for each student", "Magic circle marked on floor"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Magic! — wave wand dramatically with sound effect. Students wave and call Magic!" },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Hat! — tap hat twice. Wand! — wave wand in an arc. Students repeat action and word." },
          { name: "Spell School", time: "8 min", desc: "Teacher: Cast a spell! Abracadabra! — students wave wands and call I have a magic hat!" },
          { name: "Hat Trick", time: "4 min", desc: "Teacher hides object under hat. What's in the hat? — students guess in English." },
          { name: "Cool Down", time: "2 min", desc: "Students wave wands slowly, lower hats over eyes, and rest." },
        ],
      },
      {
        num: 21, title: "Ghost Train Camp", song: "Boo Boo Ghost!",
        vocab: ["Ghost", "Train", "Boo"],
        ns: "Boo!", nc: "It's a ghost.", no: "The ghost is on the train!",
        materials: ["👻 sheets", "🚇 tunnel"],
        setup: ["Tunnel or sheet-draped chairs as ghost train", "White scarves as ghost capes", "Dim the lights"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Boo! — jump out suddenly with arms raised. Students scatter, then call Boo! back." },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Ghost! — float arms slowly. Train! — choo-choo arm motion. Students repeat both." },
          { name: "Ghost Train", time: "8 min", desc: "Teacher: All aboard the ghost train! — students line up, chug through the tunnel calling Boo!" },
          { name: "Scare Game", time: "4 min", desc: "Teacher hides, jumps out: Boo! Students respond It's a ghost! and laugh." },
          { name: "Cool Down", time: "2 min", desc: "Students float arms slowly like ghosts, gradually sit and whisper shhh." },
        ],
      },
    ],
  },
  {
    month: "November", theme: "Cozy Adventure Camp", emoji: "🍂",
    color: "#a855f7", gradient: "linear-gradient(135deg,#c77dff,#a855f7)",
    lessons: [
      {
        num: 22, title: "Campfire Song Night", song: "Campfire Sing Along!",
        vocab: ["Warm", "Fire", "Sing"],
        ns: "Warm!", nc: "It is warm.", no: "The fire is warm.",
        materials: ["🔥 fake fire", "🥢 sticks"],
        setup: ["Set up a fake fire in the centre (orange tissue paper + fan)", "Give each student a rhythm stick or pencil", "Arrange seats in a campfire circle"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Warm! — rub hands together and hold them to the fire. Students copy and call Warm!" },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Fire! — point to fake fire. Sing! — cup hands around mouth. Students repeat word and action." },
          { name: "Campfire Sing", time: "8 min", desc: "Teacher: Let's sing! — tap rhythm on stick, begin call-and-response. Students tap sticks in rhythm and repeat phrases." },
          { name: "Story Circle", time: "4 min", desc: "Teacher: Tell me a fire story! — students make up 1-2 sentences about the fire. Keep it short." },
          { name: "Cool Down", time: "2 min", desc: "Students hum campfire song softly, stare at the fake fire and breathe until it 'goes out'." },
        ],
      },
      {
        num: 23, title: "Windy Leaf Parade", song: "Blow Leaf Blow!",
        vocab: ["Leaf", "Wind", "Fall"],
        ns: "Leaf!", nc: "I see leaves.", no: "The leaves are falling.",
        materials: ["🍂 leaves", "🌬️ fans"],
        setup: ["Scatter paper leaves on the floor", "Give each student a fan", "Mark the parade path"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Leaf! — pick up a leaf and blow it gently. Students copy and call Leaf!" },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Wind! — fan dramatically. Fall! — flutter hands downward like falling leaves. Students repeat." },
          { name: "Leaf Parade", time: "8 min", desc: "Teacher leads parade through the leaf-scattered floor. Students call I see leaves! with each step." },
          { name: "Fan Race", time: "4 min", desc: "Teacher: Fan your leaf to the finish! Students race leaves using fans calling The leaves are falling!" },
          { name: "Cool Down", time: "2 min", desc: "Students let leaves drift slowly down, breathe like the wind is stopping." },
        ],
      },
      {
        num: 24, title: "Bear Cave Pajama Camp", song: "Sleepy Bear Sleep!",
        vocab: ["Bear", "Sleep", "Cave"],
        ns: "Sleep!", nc: "The bear is sleeping.", no: "The bear is sleeping in the cave.",
        materials: ["🛏️ blankets", "🧸 soft toys"],
        setup: ["Blankets at each spot", "Stuffed bears or soft toys for each student", "Chair arrangement as 'cave'"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Bear! — big bear walk, arms low. Students lurch and call Bear!" },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Sleep! — yawn dramatically, curl up. Cave! — make an arch with arms. Students repeat." },
          { name: "Hibernation Game", time: "8 min", desc: "Teacher: Bears are sleepy — go to the cave! Students waddle to cave spots and call The bear is sleeping!" },
          { name: "Quiet Story", time: "4 min", desc: "Teacher narrates: The bear is sleeping in the cave. Students hold bears and whisper along." },
          { name: "Cool Down", time: "2 min", desc: "Students pull blankets up, hug bears, whisper Sleep bear sleep, and breathe slowly." },
        ],
      },
    ],
  },
  {
    month: "December", theme: "Winter Wonder Camp", emoji: "❄️",
    color: "#2840c8", gradient: "linear-gradient(135deg,#4361ee,#2840c8)",
    lessons: [
      {
        num: 25, title: "Santa's Music Workshop", song: "Jingle Bell Rock!",
        vocab: ["Gift", "Santa", "Bell"],
        ns: "Gift!", nc: "I see Santa.", no: "Santa has many gifts.",
        materials: ["🔔 bells", "🎁 presents"],
        setup: ["Bells at each seat", "Wrapped boxes as gifts around the room", "Santa hat for teacher"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher (as Santa): Ho Ho Ho! Gift! — hold up a present. Students call Gift!" },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Santa! — point to teacher/Santa hat. Bell! — ring bell. Students repeat and ring their bells." },
          { name: "Gift Delivery", time: "8 min", desc: "Teacher: Santa has a gift for you! Hands out boxes. Students respond Santa has many gifts!" },
          { name: "Bell Choir", time: "4 min", desc: "Teacher conducts a jingle bell song. Students ring on cue and call I see Santa!" },
          { name: "Cool Down", time: "2 min", desc: "Students set bells down gently, hum jingle bells softly." },
        ],
      },
      {
        num: 26, title: "Snowflake Ballet Day", song: "Snowflake Waltz!",
        vocab: ["Snow", "Cold", "Float"],
        ns: "Snow!", nc: "It's cold.", no: "The snow is falling.",
        materials: ["🤍 white scarves"],
        setup: ["White scarves for all students", "Snowflake shapes cut from paper", "Calm music ready"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Snow! — shake scarf above head like falling snow. Students copy and call Snow!" },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Cold! — shiver dramatically. Float! — drift scarf slowly. Students repeat with full body." },
          { name: "Ballet", time: "8 min", desc: "Teacher: Snowflakes float! Students drift scarves in slow motion, calling The snow is falling." },
          { name: "Snowflake Shapes", time: "4 min", desc: "Students create snowflake shapes with their bodies calling It's cold!" },
          { name: "Cool Down", time: "2 min", desc: "Students let scarves settle to the floor, lie still like snow on the ground." },
        ],
      },
      {
        num: 27, title: "Reindeer Parade Race", song: "Rudolph Run!",
        vocab: ["Reindeer", "Run", "Fast"],
        ns: "Run!", nc: "The reindeer can run.", no: "The reindeer runs very fast.",
        materials: ["🦌 antlers", "🔶 cones"],
        setup: ["Antler headbands for students", "Cone slalom course set up", "Finish line marked"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Reindeer! — gallop with antlers on head. Students gallop and call Reindeer!" },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Run! — sprint to a cone. Fast! — dash back. Students repeat word at each end." },
          { name: "Reindeer Race", time: "8 min", desc: "Teacher: On your marks — reindeer run! Students race through the slalom calling Run run run!" },
          { name: "Relay", time: "4 min", desc: "Team relay — pass the antlers. Each runner calls The reindeer can run! on their turn." },
          { name: "Cool Down", time: "2 min", desc: "Students trot slowly back to spots, breathe like a reindeer after a long flight." },
        ],
      },
    ],
  },
  {
    month: "January", theme: "New Year Dream Camp", emoji: "🎊",
    color: "#c7006c", gradient: "linear-gradient(135deg,#f72585,#c7006c)",
    lessons: [
      {
        num: 28, title: "New Year Sunrise Dance", song: "Happy New Year!",
        vocab: ["Happy", "New Year", "Dance"],
        ns: "Happy!", nc: "Happy New Year!", no: "Happy New Year, everyone!",
        materials: ["🎀 ribbons", "🎈 balloons"],
        setup: ["Ribbons and balloons at each spot", "Countdown board or clock visual", "Party atmosphere"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Happy! — jump up with both arms raised. Students jump and call Happy!" },
          { name: "Countdown", time: "8 min", desc: "Teacher: 10-9-8… Happy New Year! — students count down and erupt with ribbons and balloons." },
          { name: "Dance Parade", time: "8 min", desc: "Teacher leads sunrise dance around the room. Students call Happy New Year, everyone! throughout." },
          { name: "Wish Circle", time: "4 min", desc: "Each student says one Happy New Year word: I want to… in English. Teacher models." },
          { name: "Cool Down", time: "2 min", desc: "Students breathe in the new year slowly, ribbons drifting down." },
        ],
      },
      {
        num: 29, title: "Lucky Dragon Mountain", song: "Dragon Fly High!",
        vocab: ["Dragon", "Fly", "High"],
        ns: "Dragon!", nc: "I see a dragon.", no: "The dragon is flying high.",
        materials: ["🐉 dragon", "🥁 drums"],
        setup: ["Dragon prop or puppet for teacher", "Drums for each student", "Mountain shape with stacked mats"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Dragon! — spread arms like wings, growl. Students copy and call Dragon!" },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Fly! — run with arms as wings. High! — jump to peak of mountain stack. Students repeat." },
          { name: "Dragon Parade", time: "8 min", desc: "Students hold the dragon puppet train and parade. Call I see a dragon! at each turn." },
          { name: "Drum Mountain", time: "4 min", desc: "Students beat drums in dragon rhythm. Teacher: The dragon is flying high! — everyone joins." },
          { name: "Cool Down", time: "2 min", desc: "Dragon slowly descends. Students lower arms slowly and breathe." },
        ],
      },
      {
        num: 30, title: "Snow Monkey Hot Spring Camp", song: "Warm Water Monkey!",
        vocab: ["Monkey", "Hot", "Spring"],
        ns: "Hot!", nc: "The monkey is hot.", no: "The monkey is in the hot spring.",
        materials: ["🏖️ towels", "🟦 mats"],
        setup: ["Blue mats as hot spring", "Towels for each student", "Warm, cozy atmosphere"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Monkey! — monkey arm swing. Students swing and call Monkey!" },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Hot! — fan face dramatically. Spring! — lower carefully into mat/tub. Students repeat." },
          { name: "Hot Spring", time: "8 min", desc: "Teacher: Jump in the hot spring! Students step onto mats calling The monkey is in the hot spring!" },
          { name: "Splash Game", time: "4 min", desc: "Teacher splashes imaginary water: Hot! Students react and call Hot!" },
          { name: "Cool Down", time: "2 min", desc: "Students relax on mats, breathe steam out slowly, wrap in towels." },
        ],
      },
    ],
  },
  {
    month: "February", theme: "Heart Adventure Camp", emoji: "💖",
    color: "#c01f2c", gradient: "linear-gradient(135deg,#e63946,#c01f2c)",
    lessons: [
      {
        num: 31, title: "Heart Balloon Parade", song: "Love Balloon Fly!",
        vocab: ["Heart", "Pink", "Love"],
        ns: "Heart!", nc: "I like pink.", no: "I like this heart.",
        materials: ["🎈 balloons", "🧣 scarves"],
        setup: ["Heart balloons inflated", "Pink scarves at each seat", "Heart path on the floor"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Heart! — make heart shape with hands. Students copy and call Heart!" },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Pink! — wave pink scarf. Love! — hug yourself. Students repeat action and word." },
          { name: "Balloon Parade", time: "8 min", desc: "Teacher leads parade with balloons. Students call I like this heart! as they parade." },
          { name: "Balloon Keep-Up", time: "4 min", desc: "Students keep heart balloons in the air calling Heart! with each tap." },
          { name: "Cool Down", time: "2 min", desc: "Students hug balloons gently and breathe I like pink slowly." },
        ],
      },
      {
        num: 32, title: "Friendship Train", song: "Choo Choo Friends!",
        vocab: ["Friend", "Train", "Together"],
        ns: "Friend!", nc: "You are my friend.", no: "Let's help our friends.",
        materials: ["⭕ hoops", "🃏 cards"],
        setup: ["Hoops as train cars", "Friendship cards at each hoop", "Track path marked on floor"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Friend! — reach out a hand. Students grab a partner and call Friend!" },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Train! — choo-choo arm motion. Together! — pull students together. Students repeat." },
          { name: "Friendship Train", time: "8 min", desc: "Students form a train, hands on shoulders of the friend in front. Call You are my friend! at each station." },
          { name: "Help Game", time: "4 min", desc: "Teacher: Help your friend! — one student drops card, another helps pick it up: Let's help our friends!" },
          { name: "Cool Down", time: "2 min", desc: "Students sit in a friendship circle, hold hands, breathe together." },
        ],
      },
      {
        num: 33, title: "Candy Castle Mission", song: "Candy Kingdom!",
        vocab: ["Candy", "Sweet", "Please"],
        ns: "Candy!", nc: "I want candy.", no: "I want pink candy, please.",
        materials: ["🍬 candy props"],
        setup: ["Candy props (wrappers, foam shapes) at 'castle'", "Castle structure from boxes/chairs", "Polite word prompts on board"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Candy! — hold up candy dramatically. Students reach for it and call Candy!" },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Sweet! — lick lips. Please! — hands together politely. Students practice the polite phrase." },
          { name: "Castle Mission", time: "8 min", desc: "Teacher (as castle guard): What do you want? Student: I want pink candy, please! Teacher: Here you go!" },
          { name: "Sort & Call", time: "4 min", desc: "Students sort candy by colour calling each colour + candy: red candy, blue candy…" },
          { name: "Cool Down", time: "2 min", desc: "Students pretend to taste candy slowly, Sweet… whispered, smiling." },
        ],
      },
    ],
  },
  {
    month: "March", theme: "Graduation Adventure Camp", emoji: "🎓",
    color: "#1fa89c", gradient: "linear-gradient(135deg,#2ec4b6,#1fa89c)",
    lessons: [
      {
        num: 34, title: "Balloon Sky Celebration", song: "Up Up Balloon!",
        vocab: ["Balloon", "Goodbye", "Sky"],
        ns: "Bye-bye!", nc: "Goodbye, everyone!", no: "Goodbye! See you again!",
        materials: ["🎈 balloons", "🪂 parachute"],
        setup: ["Balloons for all students", "Parachute spread out", "Sky-blue streamers decorating the room"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Balloon! — hold balloon up and let it bob. Students copy and call Balloon!" },
          { name: "Vocabulary", time: "8 min", desc: "Teacher: Goodbye! — wave dramatically. Sky! — point high above. Students repeat." },
          { name: "Sky Launch", time: "8 min", desc: "Teacher: Let's send balloons to the sky! Students toss balloons on parachute calling Goodbye, everyone!" },
          { name: "Parade Farewell", time: "4 min", desc: "Students parade around the room waving balloons: Goodbye! See you again!" },
          { name: "Cool Down", time: "2 min", desc: "Students hold balloons gently, breathe: Goodbye, Wonder Camp." },
        ],
      },
      {
        num: 35, title: "Memory Treasure Camp", song: "Remember the Song!",
        vocab: ["Memory", "Favorite", "Fun"],
        ns: "Fun!", nc: "I like this.", no: "My favorite is the drum game.",
        materials: ["🃏 cards", "💎 treasure box"],
        setup: ["Memory cards (lesson images from the year)", "Treasure box in the centre", "Token for each student to place"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Remember! — tap temple and think gesture. Students copy and call Remember!" },
          { name: "Memory Game", time: "8 min", desc: "Teacher: What was your favourite? — flip cards showing past lessons. Students identify and call the lesson." },
          { name: "Treasure Ceremony", time: "8 min", desc: "Each student places a memory token in the treasure box: My favorite is… (any lesson name)." },
          { name: "Replay", time: "4 min", desc: "Mini re-run of the favourite moment: Teacher calls a past activity. Students jump into it." },
          { name: "Cool Down", time: "2 min", desc: "Students close eyes: Remember this — Wonder Camp is fun. Breathe and smile." },
        ],
      },
      {
        num: 36, title: "Adventure Parade Finale", song: "Wonder Camp Parade!",
        vocab: ["Together", "Parade", "Sing"],
        ns: "Together!", nc: "Let's play together!", no: "Let's sing and dance together!",
        materials: ["🎺 instruments", "🎀 ribbons"],
        setup: ["All instruments from the year — drums, bells, shakers", "Give each student a ribbon", "Create the biggest parade path possible"],
        steps: [
          { name: "Warm-Up", time: "5 min", desc: "Teacher: Together! — grab two students' hands and raise them up. Students all join hands and call Together!" },
          { name: "Pick Your Instrument", time: "8 min", desc: "Teacher: Choose your instrument! — show each instrument with the word. Students pick and play." },
          { name: "The Grand Parade", time: "8 min", desc: "Teacher: Wonder Camp Parade — let's go! Lead with big energy — march, wave ribbon. Students parade the whole room." },
          { name: "Final Song", time: "5 min", desc: "Teacher leads the full year finale song. Students sing, clap, play instruments: Let's sing and dance together!" },
          { name: "Graduation Bow", time: "2 min", desc: "Teacher: Take a bow, Wonder Camp stars! Students take a deep bow and wave ribbons in the air." },
        ],
      },
    ],
  },
];

const PRINCIPLES = [
  { icon: "🏃", title: "Keep Moving", desc: "Every vocabulary item is tied to a physical action. Stillness = lost attention." },
  { icon: "🎯", title: "One Core Action", desc: "Each lesson has one dominant action: toss, jump, spin, hit, or carry. Never split focus." },
  { icon: "📈", title: "Layer the Language", desc: "Word first → phrase → sentence. Never jump ahead. If a student isn't saying the word yet, stay there longer." },
  { icon: "🎢", title: "High Energy → Calm", desc: "Every lesson arcs: excitement → release → calm. Always end with a slow song or quiet movement. Non-negotiable." },
];

const SCAFFOLDING_COLORS = {
  NS: { bg: "#fef3c7", text: "#92400e", border: "#f59e0b", label: "NS" },
  NC: { bg: "#dbeafe", text: "#1e40af", border: "#3b82f6", label: "NC" },
  NO: { bg: "#dcfce7", text: "#166534", border: "#22c55e", label: "NO" },
};

export default function WonderCamp() {
  const navigate = useNavigate();
  const [expandedLesson, setExpandedLesson] = useState(null);
  const [activeMonth, setActiveMonth] = useState(null);

  const toggleLesson = (key) => {
    setExpandedLesson(prev => prev === key ? null : key);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      color: "#fff",
      fontFamily: "'Nunito', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #1a0a2e 0%, #0a0a1a 100%)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        padding: "24px 24px 28px",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <button
            onClick={() => navigate("/dashboard")}
            style={{
              background: "none", border: "none", color: "#888",
              fontSize: 13, cursor: "pointer", marginBottom: 12, padding: 0,
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            ← Dashboard
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 36 }}>🌈</span>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>
                HearSeeDo WonderCamp
              </h1>
              <p style={{ margin: 0, color: "#999", fontSize: 13, marginTop: 2 }}>
                Complete Teacher System · 36 Lessons · April – March
              </p>
            </div>
            <a
              href="/wondercamp-worksheets.html"
              target="_blank"
              rel="noreferrer"
              style={{
                marginLeft: "auto",
                background: "#e01010",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "9px 18px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              📄 Print Worksheets
            </a>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px 60px" }}>

        {/* Teaching Principles */}
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>
            Core Teaching Principles
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {PRINCIPLES.map(p => (
              <div key={p.title} style={{
                background: "#111",
                border: "1px solid #222",
                borderRadius: 14,
                padding: "14px 16px",
              }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{p.icon}</div>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{p.title}</div>
                <div style={{ color: "#999", fontSize: 12, lineHeight: 1.5 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Month filter tabs */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 28, paddingBottom: 4 }}>
          <button
            onClick={() => setActiveMonth(null)}
            style={{
              background: activeMonth === null ? "#e01010" : "#111",
              border: "1px solid",
              borderColor: activeMonth === null ? "#e01010" : "#333",
              color: "#fff",
              borderRadius: 20,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            All Months
          </button>
          {MONTHS.map(m => (
            <button
              key={m.month}
              onClick={() => setActiveMonth(activeMonth === m.month ? null : m.month)}
              style={{
                background: activeMonth === m.month ? m.color : "#111",
                border: "1px solid",
                borderColor: activeMonth === m.month ? m.color : "#333",
                color: "#fff",
                borderRadius: 20,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {m.emoji} {m.month}
            </button>
          ))}
        </div>

        {/* Monthly lesson grids */}
        {MONTHS.filter(m => !activeMonth || m.month === activeMonth).map(month => (
          <section key={month.month} style={{ marginBottom: 36 }}>
            {/* Month header */}
            <div style={{
              background: month.gradient,
              borderRadius: "16px 16px 0 0",
              padding: "14px 20px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}>
              <span style={{ fontSize: 28 }}>{month.emoji}</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", opacity: 0.85 }}>
                  {month.month}
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, fontFamily: "serif" }}>{month.theme}</div>
              </div>
              <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.8, fontWeight: 700 }}>
                L{month.lessons[0].num}–L{month.lessons[month.lessons.length - 1].num}
              </div>
            </div>

            {/* Lessons */}
            <div style={{
              background: "#111",
              border: "1px solid #222",
              borderTop: "none",
              borderRadius: "0 0 16px 16px",
              overflow: "hidden",
            }}>
              {month.lessons.map((lesson, li) => {
                const key = `${month.month}-${lesson.num}`;
                const isOpen = expandedLesson === key;

                return (
                  <div key={lesson.num} style={{
                    borderTop: li > 0 ? "1px solid #1e1e1e" : "none",
                  }}>
                    {/* Lesson row header */}
                    <button
                      onClick={() => toggleLesson(key)}
                      style={{
                        width: "100%",
                        background: "none",
                        border: "none",
                        padding: "16px 20px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 14,
                        textAlign: "left",
                        color: "#fff",
                      }}
                    >
                      {/* Lesson number badge */}
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        background: month.gradient,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 900,
                        fontSize: 14,
                        flexShrink: 0,
                      }}>
                        {lesson.num}
                      </div>

                      {/* Title and song */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>
                          {lesson.title}
                        </div>
                        <div style={{ color: "#888", fontSize: 12, marginBottom: 8 }}>
                          🎵 {lesson.song}
                        </div>

                        {/* Vocab chips */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                          {lesson.vocab.map(v => (
                            <span key={v} style={{
                              background: "#1a1a1a",
                              border: "1px solid #333",
                              borderRadius: 8,
                              padding: "2px 8px",
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#ccc",
                            }}>
                              {v}
                            </span>
                          ))}
                        </div>

                        {/* NS/NC/NO */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {[["NS", lesson.ns], ["NC", lesson.nc], ["NO", lesson.no]].map(([level, phrase]) => {
                            const sc = SCAFFOLDING_COLORS[level];
                            return (
                              <span key={level} style={{
                                background: sc.bg,
                                color: sc.text,
                                border: `1.5px solid ${sc.border}`,
                                borderRadius: 8,
                                padding: "2px 8px",
                                fontSize: 11,
                                fontWeight: 700,
                              }}>
                                <span style={{ opacity: 0.7, marginRight: 4 }}>{level}</span>
                                {phrase}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      <span style={{ color: "#555", fontSize: 14, flexShrink: 0, marginTop: 10 }}>
                        {isOpen ? "▲" : "▼"}
                      </span>
                    </button>

                    {/* Expanded content */}
                    {isOpen && (
                      <div style={{
                        borderTop: "1px solid #1e1e1e",
                        padding: "16px 20px 20px",
                        background: "#0d0d0d",
                      }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

                          {/* Materials */}
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                              🎒 Materials
                            </div>
                            {lesson.materials.map(m => (
                              <div key={m} style={{
                                fontSize: 13,
                                color: "#ccc",
                                padding: "4px 0",
                                borderBottom: "1px solid #1a1a1a",
                              }}>
                                {m}
                              </div>
                            ))}
                          </div>

                          {/* Setup */}
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                              🚀 Setup
                            </div>
                            {lesson.setup.map((s, i) => (
                              <div key={i} style={{
                                display: "flex",
                                gap: 8,
                                fontSize: 12,
                                color: "#bbb",
                                marginBottom: 6,
                                lineHeight: 1.4,
                              }}>
                                <span style={{ color: "#e01010", flexShrink: 0 }}>▸</span>
                                {s}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Teacher steps */}
                        <div style={{ marginTop: 16 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                            📋 Lesson Steps
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {lesson.steps.map((step, i) => (
                              <div key={i} style={{
                                background: "#111",
                                border: "1px solid #1e1e1e",
                                borderRadius: 12,
                                overflow: "hidden",
                              }}>
                                <div style={{
                                  background: month.gradient,
                                  padding: "8px 14px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 10,
                                  opacity: 0.9,
                                }}>
                                  <span style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: 7,
                                    background: "rgba(255,255,255,0.25)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 11,
                                    fontWeight: 900,
                                  }}>
                                    {i + 1}
                                  </span>
                                  <span style={{ fontWeight: 800, fontSize: 13 }}>{step.name}</span>
                                  <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.75 }}>{step.time}</span>
                                </div>
                                <div style={{ padding: "10px 14px", fontSize: 12, color: "#aaa", lineHeight: 1.6 }}>
                                  {step.desc}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {/* What's Included */}
        <section style={{
          background: "#111",
          border: "1px solid #222",
          borderRadius: 16,
          padding: "20px 24px",
          marginBottom: 24,
        }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800 }}>
            🚀 What This System Unlocks
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {[
              { icon: "📋", title: "Full Training Manual", desc: "Printable PDF manual — hire and onboard new teachers in hours, not weeks." },
              { icon: "🃏", title: "Lesson Script Cards", desc: "Laminated A5 cards with the full script for each lesson — one card, one class, zero confusion." },
              { icon: "📖", title: "Storybook Scripts", desc: "A matching read-aloud storybook per lesson — same vocabulary, home reinforcement through narrative." },
              { icon: "🎵", title: "Song Lyrics", desc: "Full original lyrics for all 36 songs — each written to match the exact vocabulary target of its lesson." },
            ].map(item => (
              <div key={item.title} style={{
                background: "#0d0d0d",
                border: "1px solid #1e1e1e",
                borderRadius: 12,
                padding: "14px 16px",
              }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{item.icon}</div>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4 }}>{item.title}</div>
                <div style={{ color: "#777", fontSize: 12, lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer note */}
        <div style={{ textAlign: "center", color: "#555", fontSize: 12, padding: "8px 0" }}>
          Hear See Do™ Wonder Camp · Complete Teacher System · 36 Lessons 🌈
        </div>
      </div>
    </div>
  );
}
