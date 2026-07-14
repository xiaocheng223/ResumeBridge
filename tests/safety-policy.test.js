const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_FILL_POLICY,
  normalizeFillPolicy,
  classifyCandidate,
  applyPolicyToCandidate,
  applyPolicyToPlan
} = require("../src/safety-policy.js");

function candidate(overrides = {}) {
  return {
    id: "candidate_field_1",
    fieldLabel: "姓名",
    fieldCategory: "基本信息",
    sourceLabel: "姓名",
    sourceCategory: "基本信息",
    shouldAutoFill: true,
    canAutoFill: true,
    alreadyMatches: false,
    field: {
      type: "text",
      hasCurrentValue: false,
      canFill: true,
      label: "姓名"
    },
    warning: "",
    ...overrides
  };
}

test("normalizes fill policy with conservative defaults", () => {
  assert.deepEqual(normalizeFillPolicy(), DEFAULT_FILL_POLICY);
  assert.deepEqual(normalizeFillPolicy({ overwriteExisting: 1, fillSensitive: true }), {
    overwriteExisting: true,
    fillSensitive: true,
    fillDeclarations: false
  });
});

test("classifies standard, sensitive, declaration, and blocked candidates", () => {
  assert.equal(classifyCandidate(candidate()).risk, "standard");
  assert.equal(classifyCandidate(candidate({ fieldLabel: "身份证号码" })).risk, "sensitive");
  assert.equal(classifyCandidate(candidate({ sourceCategory: "家庭信息" })).risk, "sensitive");
  assert.equal(classifyCandidate(candidate({ sourceCategory: "有关声明" })).risk, "declaration");
  assert.equal(
    classifyCandidate(candidate({ field: { type: "file", canFill: true, label: "上传简历" } })).risk,
    "blocked"
  );
  assert.equal(
    classifyCandidate(candidate({ field: { type: "submit", canFill: true, label: "提交申请" } })).risk,
    "blocked"
  );
});

test("does not let sibling field context taint an ordinary candidate", () => {
  const result = classifyCandidate(
    candidate({
      fieldLabel: "最高学历",
      sourceLabel: "最高学历",
      fieldCategory: "教育经历",
      sourceCategory: "教育经历",
      field: {
        type: "select",
        canFill: true,
        label: "最高学历",
        nearbyText: "紧急联系人",
        section: "身份证号码 | 紧急联系人 | 最高学历"
      }
    })
  );

  assert.equal(result.risk, "standard");
});

test("default policy leaves risky and existing values pending", () => {
  const existing = applyPolicyToCandidate(
    candidate({ field: { type: "text", hasCurrentValue: true, canFill: true, label: "姓名" } })
  );
  const sensitive = applyPolicyToCandidate(candidate({ fieldLabel: "身份证号码" }));
  const declaration = applyPolicyToCandidate(candidate({ sourceCategory: "有关声明" }));

  assert.equal(existing.shouldAutoFill, false);
  assert.match(existing.policy.reason, /已有内容/);
  assert.equal(sensitive.shouldAutoFill, false);
  assert.match(sensitive.policy.reason, /敏感字段/);
  assert.equal(declaration.shouldAutoFill, false);
  assert.match(declaration.policy.reason, /声明/);
  assert.equal(sensitive.canAutoFill, true);
});

test("each opt-in unlocks only its own policy category", () => {
  const existing = candidate({ field: { type: "text", hasCurrentValue: true, canFill: true, label: "姓名" } });
  const sensitive = candidate({ fieldLabel: "护照号码" });
  const declaration = candidate({ sourceCategory: "有关声明" });

  assert.equal(applyPolicyToCandidate(existing, { overwriteExisting: true }).shouldAutoFill, true);
  assert.equal(applyPolicyToCandidate(sensitive, { overwriteExisting: true }).shouldAutoFill, false);
  assert.equal(applyPolicyToCandidate(sensitive, { fillSensitive: true }).shouldAutoFill, true);
  assert.equal(applyPolicyToCandidate(declaration, { fillSensitive: true }).shouldAutoFill, false);
  assert.equal(applyPolicyToCandidate(declaration, { fillDeclarations: true }).shouldAutoFill, true);
});

test("matching existing values remain eligible because no overwrite occurs", () => {
  const result = applyPolicyToCandidate(
    candidate({
      alreadyMatches: true,
      field: { type: "text", hasCurrentValue: true, canFill: true, label: "姓名" }
    })
  );

  assert.equal(result.shouldAutoFill, true);
  assert.equal(result.policy.allowed, true);
});

test("applies policy to a complete plan and rebuilds autofill ids", () => {
  const standard = candidate({ id: "standard" });
  const sensitive = candidate({ id: "sensitive", fieldLabel: "身份证号" });
  const declaration = candidate({ id: "declaration", sourceCategory: "有关声明" });
  const plan = applyPolicyToPlan({ candidates: [standard, sensitive, declaration] });

  assert.deepEqual([...plan.autoFillIds], ["standard"]);
  assert.equal(plan.policySummary.allowed, 1);
  assert.equal(plan.policySummary.pending, 2);
});

test("blocked controls cannot be unlocked by any preference", () => {
  const result = applyPolicyToCandidate(
    candidate({ field: { type: "submit", hasCurrentValue: false, canFill: true, label: "提交申请" } }),
    { overwriteExisting: true, fillSensitive: true, fillDeclarations: true }
  );

  assert.equal(result.shouldAutoFill, false);
  assert.equal(result.canAutoFill, false);
  assert.equal(result.policy.risk, "blocked");
});
