(function attachResumeBridgeJobTracker(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.ResumeBridgeJobTracker = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createResumeBridgeJobTracker() {
  "use strict";

  const JOB_APPLICATION_STATUSES = Object.freeze([
    "待投递",
    "已投递",
    "笔试",
    "面试",
    "Offer",
    "已拒绝",
    "已撤回"
  ]);

  const PLATFORM_NAMES = [
    "boss直聘",
    "智联招聘",
    "前程无忧",
    "猎聘",
    "拉勾",
    "牛客",
    "实习僧",
    "脉脉",
    "moka",
    "北森",
    "linkedin",
    "indeed",
    "glassdoor",
    "workday",
    "greenhouse",
    "lever"
  ];

  const GENERIC_JOB_TITLES = new Set([
    "职位详情",
    "职位申请",
    "申请职位",
    "招聘职位",
    "招聘详情",
    "校园招聘",
    "社会招聘",
    "人才招聘",
    "招聘官网",
    "job details",
    "job application",
    "apply for a job",
    "careers",
    "career opportunities"
  ]);

  function normalizeJobApplication(input = {}, options = {}) {
    const now = normalizeIsoDate(options.now) || new Date().toISOString();
    const appliedAt = normalizeIsoDate(input.appliedAt) || now;
    const createdAt = normalizeIsoDate(input.createdAt) || now;
    const sourceUrl = normalizeSourceUrl(input.sourceUrl);
    const sourceSite = normalizeText(input.sourceSite, 160) || hostnameFromUrl(sourceUrl);
    const requestedStatus = normalizeText(input.status, 40);

    return {
      id: normalizeText(input.id, 160),
      companyName: normalizeText(input.companyName, 180),
      jobTitle: normalizeText(input.jobTitle, 240),
      appliedAt,
      status: JOB_APPLICATION_STATUSES.includes(requestedStatus) ? requestedStatus : "已投递",
      notes: normalizeMultilineText(input.notes, 4000),
      sourceUrl,
      sourceSite,
      createdAt,
      updatedAt: normalizeIsoDate(input.updatedAt) || now
    };
  }

  function normalizeJobApplications(input, options = {}) {
    if (!Array.isArray(input)) {
      return [];
    }

    const seenIds = new Set();
    return input
      .map((item) => normalizeJobApplication(item, options))
      .filter((item) => {
        if (!item.id || !item.companyName || !item.jobTitle || seenIds.has(item.id)) {
          return false;
        }
        seenIds.add(item.id);
        return true;
      })
      .sort((left, right) => Date.parse(right.appliedAt) - Date.parse(left.appliedAt));
  }

  function buildApplicationFingerprint(input = {}) {
    const sourceUrl = normalizeSourceUrl(input.sourceUrl);
    const companyName = canonicalText(input.companyName);
    const jobTitle = canonicalText(input.jobTitle);
    const appliedDay = normalizeIsoDate(input.appliedAt).slice(0, 10);
    return [companyName, jobTitle, sourceUrl.toLowerCase(), appliedDay].join("|");
  }

  function normalizeSourceUrl(value) {
    try {
      const url = new URL(String(value || "").trim());
      if (!['http:', 'https:'].includes(url.protocol)) {
        return "";
      }
      const pathname = url.pathname.replace(/\/{2,}/g, "/") || "/";
      return `${url.origin}${pathname}`;
    } catch {
      return "";
    }
  }

  function resolveJobPageInfo(signals = {}) {
    const structured = findJobPosting(signals.jobPostings || signals.jsonLd || []);
    const titleFallback = parsePageTitle(signals.pageTitle || signals.metaTitle || "");
    const companyCandidates = normalizeCandidates(signals.companyCandidates, "company");
    const jobTitleCandidates = normalizeCandidates(signals.jobTitleCandidates, "jobTitle");

    if (structured?.companyName) {
      companyCandidates.push({ value: structured.companyName, score: 100, source: "json-ld" });
    }
    if (structured?.jobTitle) {
      jobTitleCandidates.push({ value: structured.jobTitle, score: 100, source: "json-ld" });
    }
    if (titleFallback.companyName) {
      companyCandidates.push({ value: titleFallback.companyName, score: 28, source: "page-title" });
    }
    if (titleFallback.jobTitle) {
      jobTitleCandidates.push({ value: titleFallback.jobTitle, score: 34, source: "page-title" });
    }

    const company = chooseCandidate(companyCandidates, "company");
    const jobTitle = chooseCandidate(jobTitleCandidates, "jobTitle");
    const sourceUrl = normalizeSourceUrl(signals.url);

    return {
      companyName: company.value,
      jobTitle: jobTitle.value,
      sourceUrl,
      sourceSite: normalizeText(signals.hostname, 160) || hostnameFromUrl(sourceUrl),
      confidence: {
        companyName: confidenceFromScore(company.score),
        jobTitle: confidenceFromScore(jobTitle.score)
      },
      evidence: {
        companyName: company.source,
        jobTitle: jobTitle.source
      }
    };
  }

  function findJobPosting(input) {
    const queue = Array.isArray(input) ? [...input] : [input];
    let visited = 0;

    while (queue.length > 0 && visited < 500) {
      const value = queue.shift();
      visited += 1;

      if (typeof value === "string") {
        try {
          queue.push(JSON.parse(value));
        } catch {
          continue;
        }
        continue;
      }

      if (Array.isArray(value)) {
        queue.push(...value);
        continue;
      }

      if (!isPlainObject(value)) {
        continue;
      }

      const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
      if (types.some((type) => String(type || "").toLowerCase() === "jobposting")) {
        return {
          companyName: extractOrganizationName(value.hiringOrganization),
          jobTitle: cleanCandidate(value.title || value.name, "jobTitle")
        };
      }

      if (value["@graph"]) {
        queue.push(value["@graph"]);
      }
      if (value.mainEntity) {
        queue.push(value.mainEntity);
      }
      if (value.itemListElement) {
        queue.push(value.itemListElement);
      }
    }

    return null;
  }

  function extractOrganizationName(value) {
    if (typeof value === "string") {
      return cleanCandidate(value, "company");
    }
    if (!isPlainObject(value)) {
      return "";
    }
    return cleanCandidate(value.name || value.legalName || value.alternateName, "company");
  }

  function normalizeCandidates(input, kind) {
    if (!Array.isArray(input)) {
      return [];
    }

    return input
      .map((candidate) => {
        const source = isPlainObject(candidate) ? normalizeText(candidate.source, 80) : "page";
        const scoreValue = isPlainObject(candidate) ? Number(candidate.score) : 50;
        const value = cleanCandidate(isPlainObject(candidate) ? candidate.value : candidate, kind);
        return {
          value,
          source,
          score: Number.isFinite(scoreValue) ? Math.max(0, Math.min(100, scoreValue)) : 0
        };
      })
      .filter((candidate) => candidate.value);
  }

  function chooseCandidate(candidates, kind) {
    const bestByValue = new Map();
    for (const candidate of candidates) {
      const value = cleanCandidate(candidate.value, kind);
      if (!value) {
        continue;
      }
      const key = canonicalText(value);
      const existing = bestByValue.get(key);
      if (!existing || candidate.score > existing.score) {
        bestByValue.set(key, { ...candidate, value });
      }
    }

    return [...bestByValue.values()].sort((left, right) => right.score - left.score)[0] || {
      value: "",
      score: 0,
      source: ""
    };
  }

  function parsePageTitle(value) {
    const pageTitle = normalizeText(value, 500);
    if (!pageTitle) {
      return { companyName: "", jobTitle: "" };
    }

    let parts = pageTitle
      .split(/(?:\s+-\s+|\s*(?:\||｜|—|–|·|•|_)\s*)/)
      .map((part) => normalizeText(part, 180))
      .filter(Boolean)
      .slice(0, 6);

    if (parts.length === 1 && pageTitle.includes("-")) {
      const hyphenParts = pageTitle
        .split(/\s*-\s*/)
        .map((part) => normalizeText(part, 180))
        .filter(Boolean)
        .slice(0, 6);
      const hasKnownPlatformSuffix = hyphenParts.length >= 3 && isPlatformName(hyphenParts.at(-1));
      if (hasKnownPlatformSuffix || looksLikeCompanyTitlePart(hyphenParts[1])) {
        parts = hyphenParts;
      }
    }
    const meaningful = parts.filter((part) => !isPlatformName(part));

    return {
      jobTitle: cleanCandidate(meaningful[0] || pageTitle, "jobTitle"),
      companyName: cleanCandidate(meaningful[1] || "", "company")
    };
  }

  function cleanCandidate(value, kind) {
    const text = normalizeText(value, kind === "jobTitle" ? 240 : 180)
      .replace(/^(?:公司|企业|雇主|职位|岗位)\s*[：:]\s*/i, "")
      .trim();
    if (!text || text.length < 2) {
      return "";
    }
    if (kind === "company" && isPlatformName(text)) {
      return "";
    }
    if (kind === "jobTitle" && GENERIC_JOB_TITLES.has(text.toLowerCase())) {
      return "";
    }
    return text;
  }

  function isPlatformName(value) {
    const canonical = canonicalText(value);
    return PLATFORM_NAMES.some((name) => canonical === canonicalText(name) || canonical.includes(canonicalText(name)));
  }

  function looksLikeCompanyTitlePart(value) {
    const text = normalizeText(value, 180);
    return /(?:公司|集团|科技|股份|有限|银行|证券|保险|研究院|研究所|实验室|大学|学院|中心|航天|航空|电子)$/i.test(text);
  }

  function confidenceFromScore(score) {
    if (!score) {
      return 0;
    }
    return Math.round(Math.min(0.99, Math.max(0.2, score / 100)) * 100) / 100;
  }

  function normalizeText(value, maxLength = 240) {
    return String(value == null ? "" : value)
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength);
  }

  function normalizeMultilineText(value, maxLength = 4000) {
    return String(value == null ? "" : value)
      .replace(/\r\n?/g, "\n")
      .replace(/[\t\f\v]+/g, " ")
      .replace(/ {2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, maxLength);
  }

  function canonicalText(value) {
    return normalizeText(value, 500)
      .toLocaleLowerCase()
      .replace(/[\s\p{P}\p{S}]+/gu, "");
  }

  function normalizeIsoDate(value) {
    if (!value) {
      return "";
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
  }

  function hostnameFromUrl(value) {
    try {
      return new URL(value).hostname;
    } catch {
      return "";
    }
  }

  function isPlainObject(value) {
    return Object.prototype.toString.call(value) === "[object Object]";
  }

  return {
    JOB_APPLICATION_STATUSES,
    buildApplicationFingerprint,
    findJobPosting,
    normalizeJobApplication,
    normalizeJobApplications,
    normalizeSourceUrl,
    parsePageTitle,
    resolveJobPageInfo
  };
});
