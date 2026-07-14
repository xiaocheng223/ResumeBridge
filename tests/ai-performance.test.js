const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const contentSource = fs.readFileSync(path.join(__dirname, "..", "src", "content.js"), "utf8");

test("one-click autofill has only one automatic AI request stage", () => {
  const automaticAiMessageTypes = Array.from(
    contentSource.matchAll(/type:\s*"(OJAF_(?:MAP_FIELDS|ANALYZE_PAGE_STRUCTURE))"/g),
    (match) => match[1]
  );

  assert.deepEqual(automaticAiMessageTypes, ["OJAF_MAP_FIELDS"]);
  assert.doesNotMatch(contentSource, /enhanceScanWithAi/);
  assert.match(contentSource, /MAX_AI_ASSIST_FIELD_COUNT = 96/);
});
