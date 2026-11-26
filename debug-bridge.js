// Debug the bridge transformation
var fs = require("fs");
var path = require("path");

var bridgeCode = fs.readFileSync(path.resolve(__dirname, "speak-easily-kids-fix-bridge.js"), "utf8");

var mockSpeakEasilyKids = {
  version: "1.0-fix",
  themes: ["Me and My Family"],
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
          model: "My family is close-knit.",
          ladder: ["Probe", "What else?", "Reason", "Why?", "Example", "Give an example."]
        }
      ]
    }
  ]
};

var mockLessonData = [
  {
    category: "me-and-my-family",
    topics: [
      {
        slug: "myfamily",
        title: "My Family",
        count: 12,
        questions: [{ original: "What does your family look like?" }]
      }
    ]
  }
];

global.window = {
  SPEAKEASILYKIDS: mockSpeakEasilyKids,
  lessonData: JSON.parse(JSON.stringify(mockLessonData))
};

eval(bridgeCode);

console.log("=== window.lessonData after bridge ===");
console.log(JSON.stringify(window.lessonData, null, 2));
console.log("\n=== myfamily topic ===");
var bySlug = {};
window.lessonData.forEach(function(c){c.topics.forEach(function(t){bySlug[t.slug]=t;});});
console.log(JSON.stringify(bySlug.myfamily, null, 2));
