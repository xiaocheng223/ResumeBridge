const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const contentSource = fs.readFileSync(path.join(__dirname, "..", "src", "content.js"), "utf8");

test("detects Phoenix ATS forms and reads labels from the field container", () => {
  assert.match(contentSource, /id: "phoenix-ats"/);
  assert.match(contentSource, /career\\\.naura\\\.com/);
  assert.match(contentSource, /\.form-item\.form-item--phoenix,\.fields-col/);
  assert.match(contentSource, /\.form-item__text,\.form-item__title,label/);
  assert.match(contentSource, /\.form-part-head,\.form-part-head-new,\.head-title/);
  assert.match(contentSource, /function getStructuredSectionHeadingText/);
});

test("collects and classifies Phoenix composite controls", () => {
  assert.match(contentSource, /"\.phoenix-radio-group"/);
  assert.match(contentSource, /"\.phoenix-checkbox"/);
  assert.match(contentSource, /element\.matches\?\.\("\.phoenix-radio-group"\)/);
  assert.match(contentSource, /element\.matches\?\.\("\.phoenix-select__input"\)/);
  assert.match(contentSource, /type === "radio"/);
  assert.match(contentSource, /phoenix-radio--checked/);
});

test("keeps Phoenix choice matching inside the component before using the ATS row", () => {
  const functionStart = contentSource.indexOf("function findChoiceFieldContainer");
  const functionEnd = contentSource.indexOf("function findVisibleChoiceOptions", functionStart);
  const functionSource = contentSource.slice(functionStart, functionEnd);

  assert.ok(functionStart >= 0 && functionEnd > functionStart);
  assert.ok(functionSource.indexOf("phoenixContainer") < functionSource.indexOf("adapterSelectors"));
  assert.match(functionSource, /\.phoenix-select,\.phoenix-radio-group,\.phoenix-checkbox/);
  assert.match(contentSource, /\.phoenix-select__option/);
  assert.match(contentSource, /\.phoenix-radio-group__radioItem/);
});

test("expands profile-backed repeat sections and preserves record occurrence order", () => {
  assert.match(contentSource, /function expandKnownProfileRepeatersForScan/);
  assert.match(contentSource, /expandedKnownRepeatItems/);
  assert.match(contentSource, /ResumeBridgeProfileUtils/);
  assert.match(contentSource, /\.items\\\[\(\\d\+\)\\\]/);
  assert.match(contentSource, /\[class\*='addButton'\],span,div/);
  assert.match(contentSource, /const hasExplicitAction = actionConfig\?\.sectionKey === config\?\.sectionKey/);
  assert.match(contentSource, /resolveKnownRepeatClickTarget/);
});

test("uses publication-specific semantics instead of treating paper names as generic names", () => {
  assert.match(contentSource, /publicationAvailable/);
  assert.match(contentSource, /publicationDate/);
  assert.match(contentSource, /paperFirstAuthor/);
  assert.match(contentSource, /category === "论文著作" && directKey === "名称"/);
});

test("verifies Phoenix choices after clicking and handles broad family-relation options", () => {
  assert.match(contentSource, /projectFamilyRelationChoice/);
  assert.match(contentSource, /waitForChoiceSelection/);
  assert.match(contentSource, /点击选项后页面未保留所选值/);
  assert.doesNotMatch(contentSource, /if \(role === "radio"\) \{\s*clickActionElement\(element\);\s*return \{ ok: true \}/);
  assert.match(contentSource, /\.phoenix-selectList__listItem/);
});

test("navigates Phoenix calendars and rejects date-shaped narrative mappings", () => {
  assert.match(contentSource, /function tryFillPhoenixDatePicker/);
  assert.match(contentSource, /\.phoenix-calendar-prev-year-btn/);
  assert.match(contentSource, /\.phoenix-calendar-next-month-btn/);
  assert.match(contentSource, /isFieldValueShapeCompatible/);
  assert.match(contentSource, /STRICT_SEMANTIC_BUCKETS/);
});
