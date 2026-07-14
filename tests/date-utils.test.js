const test = require("node:test");
const assert = require("node:assert/strict");

const dateUtils = require("../src/date-utils.js");

test("projects full profile dates into year and month dropdown values", () => {
  assert.deepEqual(dateUtils.parseDateParts("2024-09"), {
    year: "2024",
    month: "9",
    day: ""
  });
  assert.equal(dateUtils.projectDateComponent("2024年09月", "year"), "2024");
  assert.equal(dateUtils.projectDateComponent("2024年09月", "month"), "9");
});

test("matches numeric date options exactly across common display formats", () => {
  assert.equal(dateUtils.numericChoiceMatches("09", "9"), true);
  assert.equal(dateUtils.numericChoiceMatches("9月", "09"), true);
  assert.equal(dateUtils.numericChoiceMatches("2024年", "2024"), true);
  assert.equal(dateUtils.numericChoiceMatches("2022", "2"), false);
  assert.equal(dateUtils.numericChoiceMatches("12", "2"), false);
});

test("describes four-part date ranges by control order", () => {
  assert.deepEqual(dateUtils.describeSplitDateControl(0, 4, "year"), {
    role: "start",
    part: "year",
    label: "开始时间年"
  });
  assert.deepEqual(dateUtils.describeSplitDateControl(1, 4, "month"), {
    role: "start",
    part: "month",
    label: "开始时间月"
  });
  assert.deepEqual(dateUtils.describeSplitDateControl(2, 4, "year"), {
    role: "end",
    part: "year",
    label: "结束时间年"
  });
  assert.deepEqual(dateUtils.describeSplitDateControl(3, 4, "month"), {
    role: "end",
    part: "month",
    label: "结束时间月"
  });
});

test("infers date components only from explicit split labels", () => {
  assert.deepEqual(dateUtils.inferDateComponent("教育背景 / 开始时间月"), {
    role: "start",
    part: "month"
  });
  assert.deepEqual(dateUtils.inferDateComponent("出生年月"), {
    role: "",
    part: ""
  });
});
