(function attachResumeBridgeAiPrivacy(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.ResumeBridgeAiPrivacy = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createAiPrivacy() {
  "use strict";

  const REDACTION_TOKEN = "【已有值已隐藏】";
  const MAX_KNOWN_VALUES = 120;

  function normalizeKnownValues(values = []) {
    const normalized = Array.isArray(values)
      ? values
          .map((value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim())
          .filter((value) => value.length >= 2)
          .filter((value) => !/^(请选择|请先选择|无数据|undefined|null)$/i.test(value))
      : [];

    return Array.from(new Set(normalized))
      .sort((left, right) => right.length - left.length)
      .slice(0, MAX_KNOWN_VALUES);
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function createKnownValueRedactor(knownValues = []) {
    const normalized = normalizeKnownValues(knownValues);
    if (normalized.length === 0) {
      return (value) => String(value == null ? "" : value);
    }

    const pattern = new RegExp(normalized.map(escapeRegExp).join("|"), "gi");
    return (value) => String(value == null ? "" : value).replace(pattern, REDACTION_TOKEN);
  }

  function redactKnownValues(value, knownValues = []) {
    return createKnownValueRedactor(knownValues)(value);
  }

  function sanitizePageOrigin(value) {
    try {
      const url = new URL(String(value || ""));
      if (!['http:', 'https:'].includes(url.protocol)) {
        return "";
      }
      return `${url.protocol}//${url.host}/`;
    } catch {
      return "";
    }
  }

  return {
    REDACTION_TOKEN,
    normalizeKnownValues,
    createKnownValueRedactor,
    redactKnownValues,
    sanitizePageOrigin
  };
});
