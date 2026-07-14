const test = require("node:test");
const assert = require("node:assert/strict");

const {
  REDACTION_TOKEN,
  normalizeKnownValues,
  redactKnownValues,
  sanitizePageOrigin
} = require("../src/ai-privacy.js");

test("normalizes useful existing values without treating one-character options as PII", () => {
  assert.deepEqual(
    normalizeKnownValues([" 张三 ", "demo@example.com", "张三", "是", "请选择", ""]),
    ["demo@example.com", "张三"]
  );
});

test("redacts every known current value from page metadata", () => {
  const text = "姓名：张三 | 邮箱 DEMO@example.com | 张三的申请";
  const redacted = redactKnownValues(text, ["张三", "demo@example.com"]);

  assert.equal(redacted.includes("张三"), false);
  assert.equal(redacted.toLowerCase().includes("demo@example.com"), false);
  assert.equal(redacted.split(REDACTION_TOKEN).length - 1, 3);
});

test("reduces page URLs to an origin before sending metadata to AI", () => {
  assert.equal(
    sanitizePageOrigin("https://jobs.example.com:8443/apply/secret-id?token=abc#resume"),
    "https://jobs.example.com:8443/"
  );
  assert.equal(sanitizePageOrigin("file:///private/resume.html"), "");
  assert.equal(sanitizePageOrigin("not a url"), "");
});
