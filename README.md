# Speak Easily Kids

An English speaking-card series for **ages 9–12 (CEFR A1–A2)**, in the Sliding In style.
Open the site, pick a topic, slide through the questions and talk.

Live: https://articulate-english.github.io/speak-easily-kids/

## What is here

- 20 topics × 12 questions = **240 original questions** across 4 categories:
  Me and My Family · School and Friends · Fun and Free Time · The World Around Me
- Every question carries 2 common words with a child-friendly definition and 2–3 short
  model answers, plus a "go deeper" re-frame.
- One-tap UK &#8596; US English switch — every question, vocabulary word and model answer
  rewrites between British and American English on the fly.
- Nine colour themes, keyboard control (arrows, R to reveal, Escape to close), one
  cover image per topic.

## Files

- `index.html` — the whole app and its styles
- `lesson-data.js` — the free teaser + topic metadata (encrypted)
- `mapping-data.json` — cover image per topic

Cover images are free-to-use stock from Pexels.

## Paygate

Four topics are free; the other sixteen are locked. Locked topics open the buy
modal (honest "On Payhip soon" state until the store products exist) and the
licence-key unlock row. A teacher key unlocks the app and enables **Share topic**,
which mints a signed link that unlocks exactly one topic for a student.

- `lesson-data.js` ships only the free teaser plus metadata for all 20 topics,
  encrypted under a public key. The remaining question text is sealed per buyer /
  per shared topic by the unlock Worker (`ae-sliding-in`) and never ships.
- `app-runtime.js` — access check, unlock, share, deep links.
