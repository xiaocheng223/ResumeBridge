const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const optionsSource = fs.readFileSync(path.join(root, "src", "options.js"), "utf8");
const popupSource = fs.readFileSync(path.join(root, "src", "popup.js"), "utf8");
const smokeSource = fs.readFileSync(path.join(root, "scripts", "qa-extension-smoke.js"), "utf8");

test("exposes missing Phoenix application fields in the local profile editor", () => {
  for (const label of [
    "一级学科",
    "发表日期",
    "是否第一作者",
    "对目标公司的期望",
    "求职过程中最困扰的问题",
    "个人优缺点",
    "岗位相关突出技能",
    "获取招聘信息途径"
  ]) {
    assert.match(optionsSource, new RegExp(label));
  }
  assert.match(optionsSource, /key: "questionnaire"/);
});

test("injects profile utilities before the content script", () => {
  for (const source of [popupSource, smokeSource]) {
    const utilityIndex = source.indexOf("src/profile-utils.js");
    const contentIndex = source.indexOf("src/content.js");
    assert.ok(utilityIndex >= 0 && contentIndex > utilityIndex);
  }
});
