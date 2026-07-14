(function attachResumeBridgeDateUtils(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.ResumeBridgeDateUtils = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createResumeBridgeDateUtils() {
  "use strict";

  function parseDateParts(value) {
    const text = String(value == null ? "" : value).trim();
    const match = text.match(/(\d{4})(?:\s*[年./-]\s*(\d{1,2}))?(?:\s*[月./-]\s*(\d{1,2}))?/);
    if (!match) {
      return { year: "", month: "", day: "" };
    }

    return {
      year: normalizeNumber(match[1]),
      month: normalizeNumber(match[2]),
      day: normalizeNumber(match[3])
    };
  }

  function projectDateComponent(value, part) {
    const parts = parseDateParts(value);
    return ["year", "month", "day"].includes(part) ? parts[part] : "";
  }

  function normalizeNumericChoiceToken(value) {
    const text = String(value == null ? "" : value)
      .replace(/\u00a0/g, " ")
      .trim();
    const match = text.match(/^0*(\d{1,4})\s*(?:年|月|月份|日)?$/);
    return match ? normalizeNumber(match[1]) : "";
  }

  function numericChoiceMatches(left, right) {
    const normalizedLeft = normalizeNumericChoiceToken(left);
    const normalizedRight = normalizeNumericChoiceToken(right);
    return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
  }

  function describeSplitDateControl(index, controlCount, partHint = "") {
    const count = Number(controlCount);
    const position = Number(index);
    if (![4, 6].includes(count) || position < 0 || position >= count) {
      return { role: "", part: "", label: "" };
    }

    const half = count / 2;
    const role = position < half ? "start" : "end";
    const offset = position % half;
    const inferredPart = ["year", "month", "day"][offset] || "";
    const part = ["year", "month", "day"].includes(partHint) ? partHint : inferredPart;
    const roleLabel = role === "start" ? "开始时间" : "结束时间";
    const partLabel = part === "year" ? "年" : part === "month" ? "月" : part === "day" ? "日" : "";

    return {
      role,
      part,
      label: partLabel ? `${roleLabel}${partLabel}` : ""
    };
  }

  function inferDateComponent(value) {
    const text = String(value == null ? "" : value)
      .replace(/\s+/g, "")
      .toLowerCase();
    const isStart = /开始|起始|入学|入职/.test(text);
    const isEnd = /结束|截止|毕业|离职/.test(text);
    const role = isStart && !isEnd ? "start" : isEnd && !isStart ? "end" : "";
    if (!role) {
      return { role: "", part: "" };
    }

    let part = "";
    if (/(?:年份|年|year)$/.test(text)) {
      part = "year";
    } else if (/(?:月份|月|month)$/.test(text)) {
      part = "month";
    } else if (/(?:日期|日|day)$/.test(text)) {
      part = "day";
    }

    return { role, part };
  }

  function normalizeNumber(value) {
    if (value == null || value === "") {
      return "";
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? String(parsed) : "";
  }

  return {
    describeSplitDateControl,
    inferDateComponent,
    normalizeNumericChoiceToken,
    numericChoiceMatches,
    parseDateParts,
    projectDateComponent
  };
});
