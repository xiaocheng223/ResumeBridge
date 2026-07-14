(function attachResumeBridgeSafetyPolicy(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.ResumeBridgeSafetyPolicy = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createSafetyPolicy() {
  "use strict";

  const DEFAULT_FILL_POLICY = Object.freeze({
    overwriteExisting: false,
    fillSensitive: false,
    fillDeclarations: false
  });

  const BLOCKED_CONTROL_TYPES = new Set(["file", "submit", "button", "reset", "image"]);
  const BLOCKED_ACTION_PATTERN = /提交申请|最终提交|确认投递|立即申请|确认申请|submitapplication|applynow/i;
  const DECLARATION_PATTERN =
    /有关声明|本人声明|诚信声明|背景调查|背调|合规问答|违法|犯罪|不良行为|纪律处分|竞业限制|利益冲突|亲属回避|是否同意|真实性承诺|签字确认/i;
  const SENSITIVE_PATTERN =
    /身份证|护照|证件号码|证件号|证件类型|社会保障|社保号码|家庭信息|家庭情况|家庭成员|社会关系|亲属|父亲|母亲|配偶|子女|紧急联系人|政治面貌|健康状况|疾病|婚姻状况|户籍|户口|籍贯|生源地/i;

  function normalizeFillPolicy(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    return {
      overwriteExisting: Boolean(source.overwriteExisting),
      fillSensitive: Boolean(source.fillSensitive),
      fillDeclarations: Boolean(source.fillDeclarations)
    };
  }

  function candidateText(candidate = {}) {
    const field = candidate.field || {};
    return [
      candidate.fieldLabel,
      candidate.fieldCategory,
      candidate.sourceLabel,
      candidate.sourceCategory,
      candidate.sourceSubsection,
      field.label,
      field.placeholder,
      field.name,
      field.id,
      field.type
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  function classifyCandidate(candidate = {}) {
    const field = candidate.field || {};
    const type = String(field.type || "").trim().toLowerCase();
    const text = candidateText(candidate);

    if (BLOCKED_CONTROL_TYPES.has(type) || BLOCKED_ACTION_PATTERN.test(text)) {
      return {
        risk: "blocked",
        reason: "文件上传和提交类控件必须由你手动操作"
      };
    }

    if (
      candidate.sourceCategory === "有关声明" ||
      candidate.fieldCategory === "有关声明" ||
      DECLARATION_PATTERN.test(text)
    ) {
      return {
        risk: "declaration",
        reason: "声明、背景调查和合规问答默认需要人工确认"
      };
    }

    if (
      candidate.sourceCategory === "家庭信息" ||
      candidate.fieldCategory === "家庭信息" ||
      SENSITIVE_PATTERN.test(text)
    ) {
      return {
        risk: "sensitive",
        reason: "证件、家庭或其他敏感字段默认需要人工确认"
      };
    }

    return {
      risk: "standard",
      reason: ""
    };
  }

  function joinWarning(current, next) {
    const parts = [current, next].map((value) => String(value || "").trim()).filter(Boolean);
    return Array.from(new Set(parts)).join("；");
  }

  function applyPolicyToCandidate(candidate = {}, policyInput = {}) {
    const policy = normalizeFillPolicy(policyInput);
    const classification = classifyCandidate(candidate);
    const field = candidate.field || {};
    let policyReason = "";

    if (classification.risk === "blocked") {
      policyReason = classification.reason;
    } else if (field.hasCurrentValue && !candidate.alreadyMatches && !policy.overwriteExisting) {
      policyReason = "网页字段已有内容，默认不覆盖";
    } else if (classification.risk === "sensitive" && !policy.fillSensitive) {
      policyReason = classification.reason;
    } else if (classification.risk === "declaration" && !policy.fillDeclarations) {
      policyReason = classification.reason;
    }

    const policyAllowed = !policyReason;
    const canAutoFill =
      classification.risk === "blocked" ? false : Boolean(candidate.canAutoFill);

    return {
      ...candidate,
      shouldAutoFill: Boolean(candidate.shouldAutoFill) && policyAllowed,
      canAutoFill,
      warning: joinWarning(candidate.warning, policyReason),
      policy: {
        risk: classification.risk,
        allowed: policyAllowed,
        reason: policyReason
      }
    };
  }

  function applyPolicyToPlan(plan = {}, policyInput = {}) {
    const policy = normalizeFillPolicy(policyInput);
    const candidates = Array.isArray(plan.candidates)
      ? plan.candidates.map((candidate) => applyPolicyToCandidate(candidate, policy))
      : [];
    const autoFillIds = new Set(
      candidates.filter((candidate) => candidate.shouldAutoFill).map((candidate) => candidate.id)
    );

    return {
      ...plan,
      candidates,
      autoFillIds,
      fillPolicy: policy,
      policySummary: {
        allowed: autoFillIds.size,
        pending: candidates.length - autoFillIds.size,
        sensitive: candidates.filter((candidate) => candidate.policy?.risk === "sensitive").length,
        declarations: candidates.filter((candidate) => candidate.policy?.risk === "declaration").length,
        blocked: candidates.filter((candidate) => candidate.policy?.risk === "blocked").length
      }
    };
  }

  return {
    DEFAULT_FILL_POLICY,
    normalizeFillPolicy,
    classifyCandidate,
    applyPolicyToCandidate,
    applyPolicyToPlan
  };
});
