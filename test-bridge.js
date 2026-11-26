// Test harness for the Speak Easily Kids bridge transformation.
// Mocks window.SPEAKEASILYKIDS and window.lessonData, loads the bridge, and
// verifies the transformed topics are merged into the lesson data model.

var fs = require("fs");
var path = require("path");

// 1. Read the bridge file (the IIFE runs on load)
var bridgePath = path.resolve(__dirname, "speak-easily-kids-fix-bridge.js");
var bridgeCode = fs.readFileSync(bridgePath, "utf8");

// 2. Build a minimal SPEAKEASILYKIDS object matching the fixed-questions.js schema
var mockSpeakEasilyKids = {
  version: "1.0-fix",
  themes: ["Me and My Family", "School and Friends"],
  topics: [
    {
      slug: "my-family",
      title: "My Family",
      category: "me-and-my-family",
      questions: [
        {
          n: 1,
          q: "What does your family look like?",
          wordBank: "close-knit, quiet, noisy",
          hint: "Use two adjectives to describe each person.",
          model: "My family is close-knit. My mother is very caring.",
          ladder: ["Probe", "What else?", "Reason", "Why?", "Example", "Give an example."]
        }
      ]
    },
    {
      slug: "my-home-and-bedroom",
      title: "My Home",
      category: "me-and-my-home",
      questions: [
        {
          n: 1,
          q: "What does your room look like?",
          wordBank: "cosy, bright, tidy",
          hint: "Describe your room.",
          model: "My room is cosy and bright.",
          ladder: ["Probe", "What is in your room?", "Example", "Show me."]
        }
      ]
    },
    {
      slug: "games-and-sports",
      title: "Games and Sports",
      category: "fun-and-free-time",
      questions: [
        {
          n: 1,
          q: "What sports do you play?",
          wordBank: "run, swim, team",
          hint: "Name a sport.",
          model: "I play rugby with my team.",
          ladder: ["Probe", "Who do you play with?", "Compare", "Is it hard?"]
        }
      ]
    }
  ]
};

// 3. Build a minimal lesson-data.js: the free teaser with 4 topics
var mockLessonData = [
  {
    category: "me-and-my-family",
    topics: [
      {
        slug: "myfamily",
        title: "My Family",
        count: 12,
        questions: [{ original: "What does your family look like?" }]
      },
      {
        slug: "mybestfriend",
        title: "My Best Friend",
        count: 12,
        questions: [{ original: "Who is your best friend?" }]
      }
    ]
  },
  {
    category: "fun-and-free-time",
    topics: [
      {
        slug: "gamesandsports",
        title: "Games and Sports",
        count: 12,
        questions: [{ original: "What sports do you play?" }]
      }
    ]
  },
  {
    category: "me-and-my-home",
    topics: [
      {
        slug: "myhomeandbedroom",
        title: "My Home",
        count: 12,
        questions: [{ original: "What does your room look like?" }]
      }
    ]
  },
  {
    category: "the-world-around-me",
    topics: [
      {
        slug: "animalsandnature",
        title: "Animals and Nature",
        count: 12,
        questions: [{ original: "What is in nature?" }]
      }
    ]
  }
];

// 4. Set up the mock environment (global.window)
global.window = {
  SPEAKEASILYKIDS: mockSpeakEasilyKids,
  lessonData: JSON.parse(JSON.stringify(mockLessonData)) // deep copy
};

// 5. Evaluate the bridge code in the mock environment
eval(bridgeCode);

// 6. Run assertions
var errors = [];
function assert(name, condition, detail) {
  if (condition) {
    console.log("PASS:", name);
  } else {
    console.log("FAIL:", name, detail || "");
    errors.push(name);
  }
}

// The bridge should have merged the topics
var merged = window.lessonData;
assert("lessonData is an array", Array.isArray(merged), JSON.stringify(merged));

var bySlug = {};
merged.forEach(function (cat) {
  cat.topics.forEach(function (t) { bySlug[t.slug] = t; });
});

assert("topic myfamily merged with fixed questions", bySlug.myfamily && bySlug.myfamily.questions.length > 0, JSON.stringify(bySlug.myfamily));
assert("topic mybestfriend still free", bySlug.mybestfriend && bySlug.mybestfriend.questions.length === 1, JSON.stringify(bySlug.mybestfriend));

var myfamily = bySlug.myfamily;
assert("myfamily has vocabulary", Array.isArray(myfamily.questions[0].vocab) && myfamily.questions[0].vocab.length > 0, JSON.stringify(myfamily.questions[0].vocab));
assert("myfamily has paraphrased hint", typeof myfamily.questions[0].paraphrased === "string" && myfamily.questions[0].paraphrased.length > 0, JSON.stringify(myfamily.questions[0]));
assert("myfamily has model answer", Array.isArray(myfamily.questions[0].possibleAnswers) && myfamily.questions[0].possibleAnswers.length === 1, JSON.stringify(myfamily.questions[0]));
assert("myfamily ladder has 3 steps", Array.isArray(myfamily.questions[0].ladder) && myfamily.questions[0].ladder.length === 3, JSON.stringify(myfamily.questions[0].ladder));
assert("myfamily ladder step labels", myfamily.questions[0].ladder[0].label === "Probe" && myfamily.questions[0].ladder[0].text === "What else?", "ladder[0]: " + JSON.stringify(myfamily.questions[0].ladder[0]));

var myhome = bySlug["myhomeandbedroom"];
assert("myhomeandbedroom merged", myhome && myhome.questions.length > 0, "myhome: " + JSON.stringify(myhome));

// Test the "no-op when SPEAKEASILYKIDS missing" path is separate — skip here.

if (errors.length === 0) {
  console.log("\nALL TESTS PASSED");
  process.exit(0);
} else {
  console.log("\nFAILED tests:", errors.join(", "));
  process.exit(1);
}
