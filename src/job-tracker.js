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

  const JOB_APPLICATION_STATUS_META = Object.freeze([
    { value: "待投递", tone: "pending" },
    { value: "已投递", tone: "submitted" },
    { value: "已查看", tone: "submitted" },
    { value: "等待回复", tone: "waiting" },
    { value: "简历筛选中", tone: "submitted" },
    { value: "测评 / 笔试", tone: "assessment" },
    { value: "笔试", tone: "assessment" },
    { value: "等待面试", tone: "waiting" },
    { value: "面试", tone: "interview" },
    { value: "一面 / 初面", tone: "interview" },
    { value: "技术二面", tone: "interview" },
    { value: "终面", tone: "interview" },
    { value: "HR 面", tone: "interview" },
    { value: "等待面试结果", tone: "waiting" },
    { value: "Offer 沟通中", tone: "offer" },
    { value: "Offer", tone: "offer" },
    { value: "已拒绝", tone: "closed" },
    { value: "已撤回", tone: "closed" },
    { value: "已放弃", tone: "closed" },
    { value: "无回应归档", tone: "archived" }
  ].map((item) => Object.freeze(item)));

  const JOB_APPLICATION_STATUSES = Object.freeze(
    JOB_APPLICATION_STATUS_META.map((item) => item.value)
  );

  const JOB_APPLICATION_STATUS_ALIASES = Object.freeze({
    "准备投递": "待投递",
    "等待一面": "等待面试",
    "技术一面": "一面 / 初面",
    "技术三面": "终面",
    "部门负责人面": "终面",
    "已 Offer": "Offer",
    "已挂": "已拒绝"
  });

  const JOB_APPLICATION_SORT_MODES = Object.freeze([
    "applied-desc",
    "applied-asc",
    "status-updated-desc",
    "status-updated-asc",
    "pipeline"
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
    "应聘岗位",
    "意向岗位",
    "目标岗位",
    "投递职位",
    "职位名称",
    "岗位名称",
    "岗位信息",
    "职位信息",
    "职位类别",
    "招聘职位",
    "招聘详情",
    "校园招聘",
    "社会招聘",
    "人才招聘",
    "招聘官网",
    "在线简历",
    "简历填写",
    "申请信息",
    "申请意向",
    "求职意向",
    "基本信息",
    "教育背景",
    "工作经历",
    "项目经历",
    "项目经验",
    "论文/专著",
    "论文专著",
    "家庭情况",
    "job details",
    "job application",
    "apply for a job",
    "careers",
    "career opportunities"
  ]);

  const GENERIC_COMPANY_NAMES = new Set([
    "公司",
    "单位",
    "公司名称",
    "企业名称",
    "单位名称",
    "工作单位",
    "招聘单位",
    "用人单位",
    "申请公司",
    "雇主名称"
  ]);

  const MIN_ACCEPTED_SCORE = Object.freeze({
    company: 55,
    jobTitle: 58
  });

  function normalizeJobApplication(input = {}, options = {}) {
    const now = normalizeIsoDate(options.now) || new Date().toISOString();
    const appliedAt = normalizeIsoDate(input.appliedAt) || now;
    const createdAt = normalizeIsoDate(input.createdAt) || now;
    const sourceUrl = normalizeSourceUrl(input.sourceUrl);
    const statusUrl = normalizeSourceUrl(input.statusUrl || input.statusLink);
    const sourceSite = normalizeText(input.sourceSite, 160) || hostnameFromUrl(sourceUrl);
    const requestedStatus = normalizeJobApplicationStatus(input.status);
    const updatedAt = normalizeIsoDate(input.updatedAt) || now;

    return {
      id: normalizeText(input.id, 160),
      companyName: normalizeText(input.companyName, 180),
      jobTitle: normalizeText(input.jobTitle, 240),
      appliedAt,
      channel: normalizeText(input.channel, 120) || inferApplicationChannel(sourceUrl || statusUrl, sourceSite),
      statusUrl,
      status: requestedStatus,
      statusUpdatedAt: normalizeIsoDate(input.statusUpdatedAt || input.statusUpdatedDate || input.updatedAt) || now,
      notes: normalizeMultilineText(input.notes, 4000),
      sourceUrl,
      sourceSite,
      createdAt,
      updatedAt
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

  function normalizeJobApplicationStatus(value) {
    const requested = normalizeText(value, 40);
    if (JOB_APPLICATION_STATUSES.includes(requested)) {
      return requested;
    }
    return JOB_APPLICATION_STATUS_ALIASES[requested] || "已投递";
  }

  function statusTone(value) {
    const status = normalizeJobApplicationStatus(value);
    return JOB_APPLICATION_STATUS_META.find((item) => item.value === status)?.tone || "submitted";
  }

  function statusRank(value) {
    const status = normalizeJobApplicationStatus(value);
    const index = JOB_APPLICATION_STATUSES.indexOf(status);
    return index >= 0 ? index : JOB_APPLICATION_STATUSES.length;
  }

  function sortJobApplications(input, mode = "applied-desc") {
    const selectedMode = JOB_APPLICATION_SORT_MODES.includes(mode) ? mode : "applied-desc";
    const applications = Array.isArray(input) ? input.slice() : [];
    applications.sort((left, right) => {
      if (selectedMode === "applied-asc") {
        return compareDate(left.appliedAt, right.appliedAt) || compareApplicationText(left, right);
      }
      if (selectedMode === "status-updated-desc") {
        return compareDate(right.statusUpdatedAt || right.updatedAt, left.statusUpdatedAt || left.updatedAt)
          || compareDate(right.appliedAt, left.appliedAt)
          || compareApplicationText(left, right);
      }
      if (selectedMode === "status-updated-asc") {
        return compareDate(left.statusUpdatedAt || left.updatedAt, right.statusUpdatedAt || right.updatedAt)
          || compareDate(right.appliedAt, left.appliedAt)
          || compareApplicationText(left, right);
      }
      if (selectedMode === "pipeline") {
        return statusRank(left.status) - statusRank(right.status)
          || compareDate(right.statusUpdatedAt || right.updatedAt, left.statusUpdatedAt || left.updatedAt)
          || compareApplicationText(left, right);
      }
      return compareDate(right.appliedAt, left.appliedAt) || compareApplicationText(left, right);
    });
    return applications;
  }

  function inferApplicationChannel(value, hint = "") {
    const context = `${normalizeText(hint, 200)} ${normalizeText(value, 2048)}`.toLocaleLowerCase();
    if (!context.trim()) {
      return "";
    }

    const knownChannels = [
      [/内推|referral/, "内推"],
      [/zhipin|boss直聘/, "BOSS直聘"],
      [/liepin|猎聘/, "猎聘"],
      [/zhaopin|智联招聘/, "智联招聘"],
      [/(?:51job|前程无忧)/, "前程无忧"],
      [/lagou|拉勾/, "拉勾"],
      [/nowcoder|牛客/, "牛客"],
      [/shixiseng|实习僧/, "实习僧"],
      [/linkedin/, "LinkedIn"],
      [/indeed/, "Indeed"],
      [/glassdoor/, "Glassdoor"],
      [/mokahr|\bmoka\b/, "Moka"],
      [/myworkdayjobs|workday/, "Workday"],
      [/successfactors/, "SuccessFactors"],
      [/greenhouse/, "Greenhouse"],
      [/lever\.co|\blever\b/, "Lever"]
    ];
    for (const [pattern, channel] of knownChannels) {
      if (pattern.test(context)) {
        return channel;
      }
    }

    return /^https?:\/\//i.test(String(value || "").trim()) ? "公司官网" : "";
  }

  function extractApplicationListCandidates(input = {}) {
    const lines = (Array.isArray(input.lines) ? input.lines : [])
      .slice(0, 1500)
      .map((line) => normalizeText(line, 500))
      .filter(Boolean);
    if (!lines.some((line) => /投递时间|申请时间|提交时间|Requisition ID:|Applied On:/i.test(line))) {
      return [];
    }

    const sourceUrl = normalizeSourceUrl(input.sourceUrl);
    const sourceSite = normalizeText(input.sourceSite, 160) || hostnameFromUrl(sourceUrl);
    const companyName = cleanCandidate(input.companyName, "company");
    const channel = normalizeText(input.channel, 120) || inferApplicationChannel(sourceUrl, sourceSite);
    const candidates = [];

    lines.forEach((line, index) => {
      const dateText = extractChineseApplicationDate(line);
      if (!dateText) {
        return;
      }
      const role = findPreviousApplicationRole(lines, index);
      if (!role) {
        return;
      }
      const scopeEnd = findNextApplicationMarker(lines, index + 1);
      candidates.push(buildApplicationListCandidate({
        companyName,
        role,
        appliedAt: dateText,
        channel,
        sourceUrl,
        sourceSite,
        scope: lines.slice(index, scopeEnd),
        notes: extractRoleReference(lines[index - 1])
      }));
    });

    lines.forEach((line, index) => {
      const requisitionMatch = line.match(/^Requisition ID:\s*(.+)$/i);
      if (!requisitionMatch) {
        return;
      }
      const role = findPreviousApplicationRole(lines, index);
      const appliedLine = lines.slice(index + 1, index + 9).find((item) => /^Applied On:/i.test(item));
      const appliedAt = parseEnglishApplicationDate(appliedLine);
      if (!role || !appliedAt) {
        return;
      }
      const scopeEnd = findNextApplicationMarker(lines, index + 1);
      candidates.push(buildApplicationListCandidate({
        companyName,
        role,
        appliedAt,
        channel,
        sourceUrl,
        sourceSite,
        scope: lines.slice(index, scopeEnd),
        notes: requisitionMatch[1] ? `Requisition ID: ${normalizeText(requisitionMatch[1], 80)}` : ""
      }));
    });

    const seen = new Set();
    return candidates.filter((candidate) => {
      const key = [
        canonicalText(candidate.companyName),
        canonicalText(candidate.jobTitle),
        candidate.appliedAt.slice(0, 10)
      ].join("|");
      if (!candidate.jobTitle || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function buildApplicationListCandidate(input) {
    const appliedAt = normalizeIsoDate(input.appliedAt) || new Date().toISOString();
    return {
      companyName: input.companyName || "",
      jobTitle: input.role,
      appliedAt,
      channel: input.channel || "",
      statusUrl: input.sourceUrl || "",
      status: inferObservedApplicationStatus(input.scope),
      statusUpdatedAt: appliedAt,
      notes: normalizeMultilineText(input.notes, 4000),
      sourceUrl: input.sourceUrl || "",
      sourceSite: input.sourceSite || "",
      confidence: {
        companyName: input.companyName ? 0.9 : 0,
        jobTitle: 0.92
      },
      evidence: {
        companyName: input.companyName ? "application-list-context" : "",
        jobTitle: "application-list-card"
      }
    };
  }

  function extractChineseApplicationDate(line) {
    const match = String(line || "").match(/(?:投递|申请|提交)(?:时间|日期)?\s*[：:]\s*(\d{4}[-\/]\d{1,2}[-\/]\d{1,2}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?)/);
    return match ? normalizeImportedDate(match[1]) : "";
  }

  function parseEnglishApplicationDate(line) {
    const match = String(line || "").match(/^Applied On:\s*(.+)$/i);
    if (!match) {
      return "";
    }
    return normalizeIsoDate(match[1]);
  }

  function findPreviousApplicationRole(lines, markerIndex) {
    for (let index = markerIndex - 1; index >= Math.max(0, markerIndex - 5); index -= 1) {
      const role = normalizeApplicationRole(lines[index]);
      if (role) {
        return role;
      }
    }
    return "";
  }

  function normalizeApplicationRole(value) {
    const text = normalizeText(value, 240)
      .replace(/\s*[（(]\s*(?:职位|岗位|Job|Req(?:uisition)?\s*)?(?:ID\s*[：:]?\s*)?[A-Z]?\d{4,}\s*[）)]\s*$/i, "")
      .trim();
    if (!text || !/[\p{L}\p{N}]/u.test(text)) {
      return "";
    }
    if (/投递|申请|提交|个人中心|我的(?:投递|申请)|Requisition|Applied On|Date Submitted|Privacy|隐私|状态|查看|修改简历/i.test(text)) {
      return "";
    }
    if (/^(?:已投递|已查看|等待回复|简历筛选中|测评|笔试|面试|Offer|已拒绝|已撤回|Under Consideration|Submitted|Application Received|In Review)$/i.test(text)) {
      return "";
    }
    return cleanCandidate(text, "jobTitle");
  }

  function findNextApplicationMarker(lines, startIndex) {
    for (let index = startIndex; index < Math.min(lines.length, startIndex + 20); index += 1) {
      if (/投递时间|申请时间|提交时间|Requisition ID:/i.test(lines[index])) {
        return index;
      }
    }
    return Math.min(lines.length, startIndex + 12);
  }

  function inferObservedApplicationStatus(lines) {
    const text = (Array.isArray(lines) ? lines : []).join(" ");
    if (/已撤回|撤销申请|Withdrawn/i.test(text)) return "已撤回";
    if (/已放弃|放弃申请/i.test(text)) return "已放弃";
    if (/已拒绝|未通过|不合适|Rejected|Not Selected|Unsuccessful/i.test(text)) return "已拒绝";
    if (/Offer|录用/i.test(text)) return "Offer";
    if (/HR\s*面|人力面/i.test(text)) return "HR 面";
    if (/终面|Final Interview/i.test(text)) return "终面";
    if (/二面|Second Interview|2nd Interview/i.test(text)) return "技术二面";
    if (/进入面试|一面|初面|Interview/i.test(text)) return "面试";
    if (/测评|笔试|Assessment|Online Test/i.test(text)) return "测评 / 笔试";
    if (/简历筛选|处理中|Under Consideration|In Review|In Progress/i.test(text)) return "简历筛选中";
    if (/已查看|Viewed/i.test(text)) return "已查看";
    if (/等待回复|Awaiting/i.test(text)) return "等待回复";
    return "已投递";
  }

  function extractRoleReference(value) {
    const match = normalizeText(value, 240).match(/[（(]\s*([A-Z]?\d{4,})\s*[）)]\s*$/i);
    return match ? `职位编号：${match[1]}` : "";
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

  function parseJobApplicationsCsv(csvText, options = {}) {
    const rows = parseCsvRows(csvText);
    if (rows.length === 0) {
      return { applications: [], invalidCount: 0, totalRows: 0 };
    }

    const fields = rows[0].map(resolveCsvHeader);
    const applications = [];
    let invalidCount = 0;
    let totalRows = 0;

    for (const row of rows.slice(1)) {
      if (!row.some((cell) => String(cell || "").trim())) {
        continue;
      }
      totalRows += 1;
      const source = {};
      fields.forEach((field, index) => {
        if (field) {
          source[field] = row[index] == null ? "" : row[index];
        }
      });

      source.appliedAt = normalizeImportedDate(source.appliedAt);
      source.statusUpdatedAt = normalizeImportedDate(source.statusUpdatedAt);
      const application = normalizeJobApplication(source, options);
      if (!application.companyName || !application.jobTitle) {
        invalidCount += 1;
        continue;
      }
      applications.push(application);
    }

    return { applications, invalidCount, totalRows };
  }

  function exportJobApplicationsToCsv(input) {
    const headers = [
      "公司名称",
      "申请职位",
      "投递时间",
      "投递渠道",
      "职位链接/JD链接",
      "查看投递状态界面",
      "投递状态",
      "状态更新时间",
      "备注",
      "来源网站"
    ];
    const rows = (Array.isArray(input) ? input : []).map((source) => {
      const application = normalizeJobApplication(source);
      return [
        application.companyName,
        application.jobTitle,
        formatCsvDate(application.appliedAt),
        application.channel,
        application.sourceUrl,
        application.statusUrl,
        application.status,
        formatCsvDate(application.statusUpdatedAt),
        application.notes,
        application.sourceSite
      ];
    });

    const csvRows = [
      headers.join(","),
      ...rows.map((row) => row.map(escapeCsvValue).join(","))
    ];
    return `\ufeff${csvRows.join("\r\n")}`;
  }

  function parseCsvRows(value) {
    const text = String(value || "").replace(/^\ufeff/, "");
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      const next = text[index + 1];
      if (character === '"' && quoted && next === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = !quoted;
      } else if (character === "," && !quoted) {
        row.push(cell);
        cell = "";
      } else if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && next === "\n") {
          index += 1;
        }
        row.push(cell);
        if (row.some((valuePart) => String(valuePart || "").trim())) {
          rows.push(row);
        }
        row = [];
        cell = "";
      } else {
        cell += character;
      }
    }

    row.push(cell);
    if (row.some((valuePart) => String(valuePart || "").trim())) {
      rows.push(row);
    }
    return rows;
  }

  function resolveCsvHeader(value) {
    const header = String(value || "")
      .replace(/^\ufeff/, "")
      .replace(/[\s_]+/g, "")
      .toLocaleLowerCase();
    const aliases = {
      "公司名称": "companyName",
      "公司": "companyName",
      "company": "companyName",
      "companyname": "companyName",
      "申请职位": "jobTitle",
      "职位": "jobTitle",
      "岗位": "jobTitle",
      "role": "jobTitle",
      "jobtitle": "jobTitle",
      "投递时间": "appliedAt",
      "投递日期": "appliedAt",
      "appliedat": "appliedAt",
      "applieddate": "appliedAt",
      "投递渠道": "channel",
      "渠道": "channel",
      "channel": "channel",
      "职位链接/jd链接": "sourceUrl",
      "职位链接": "sourceUrl",
      "jd链接": "sourceUrl",
      "来源页面": "sourceUrl",
      "sourceurl": "sourceUrl",
      "joblink": "sourceUrl",
      "查看投递状态界面": "statusUrl",
      "状态页链接": "statusUrl",
      "statusurl": "statusUrl",
      "statuslink": "statusUrl",
      "投递状态": "status",
      "status": "status",
      "状态更新时间": "statusUpdatedAt",
      "statusupdatedat": "statusUpdatedAt",
      "statusupdateddate": "statusUpdatedAt",
      "备注": "notes",
      "notes": "notes",
      "来源网站": "sourceSite",
      "sourcesite": "sourceSite"
    };
    return aliases[header] || "";
  }

  function normalizeImportedDate(value) {
    const text = normalizeText(value, 80);
    if (!text) {
      return "";
    }
    const localMatch = text.match(/^(\d{4})[-\/]([01]?\d)[-\/]([0-3]?\d)(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (localMatch) {
      const localDate = new Date(
        Number(localMatch[1]),
        Number(localMatch[2]) - 1,
        Number(localMatch[3]),
        Number(localMatch[4] || 0),
        Number(localMatch[5] || 0),
        Number(localMatch[6] || 0)
      );
      return Number.isNaN(localDate.getTime()) ? "" : localDate.toISOString();
    }
    return normalizeIsoDate(text);
  }

  function formatCsvDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    const parts = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ];
    const time = [
      String(date.getHours()).padStart(2, "0"),
      String(date.getMinutes()).padStart(2, "0")
    ];
    return `${parts.join("-")} ${time.join(":")}`;
  }

  function escapeCsvValue(value) {
    let text = String(value == null ? "" : value).replace(/\r\n?/g, "\n");
    if (/^[=+\-@\t\r]/.test(text)) {
      text = `'${text}`;
    }
    return `"${text.replace(/"/g, '""')}"`;
  }

  function resolveJobPageInfo(signals = {}) {
    const structured = findJobPosting(signals.jobPostings || signals.jsonLd || []);
    const titleFallback = parsePageTitle(signals.pageTitle || signals.metaTitle || "");
    const companyCandidates = normalizeCandidates(signals.companyCandidates, "company");
    const jobTitleCandidates = normalizeCandidates(signals.jobTitleCandidates, "jobTitle");
    const hasTitlePair = Boolean(titleFallback.companyName && titleFallback.jobTitle);

    if (structured?.companyName) {
      companyCandidates.push({ value: structured.companyName, score: 100, source: "json-ld" });
    }
    if (structured?.jobTitle) {
      jobTitleCandidates.push({ value: structured.jobTitle, score: 100, source: "json-ld" });
    }
    if (titleFallback.companyName) {
      companyCandidates.push({
        value: titleFallback.companyName,
        score: hasTitlePair ? 60 : 28,
        source: "page-title"
      });
    }
    if (titleFallback.jobTitle) {
      jobTitleCandidates.push({
        value: titleFallback.jobTitle,
        score: hasTitlePair ? 62 : 34,
        source: "page-title"
      });
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

  function extractBeisenJobPageInfo(payload) {
    if (!isPlainObject(payload) || Number(payload.Code ?? payload.code) !== 200) {
      return { companyName: "", jobTitle: "" };
    }

    const data = isPlainObject(payload.Data) ? payload.Data : isPlainObject(payload.data) ? payload.data : null;
    if (!data) {
      return { companyName: "", jobTitle: "" };
    }

    const hiringOrganization = isPlainObject(data.hiringOrganization)
      ? data.hiringOrganization.name || data.hiringOrganization.legalName
      : data.hiringOrganization;
    const companyName = cleanCandidate(
      data.Org || data.OrganizationName || data.CompanyName || hiringOrganization,
      "company"
    );
    const jobTitle = extractJobTitleFromPostingName(
      data.JobAdName || data.JobName || data.PositionName || data.Title,
      companyName
    );

    return { companyName, jobTitle };
  }

  function extractJobTitleFromPostingName(value, organizationName = "") {
    const rawTitle = cleanCandidate(value, "jobTitle");
    if (!rawTitle) {
      return "";
    }

    const parts = rawTitle
      .split(/\s*(?:-|－|—|–|\||｜)\s*/)
      .map((part) => normalizeText(part, 180))
      .filter(Boolean);

    while (parts.length > 1 && looksLikeRecruitmentCampaign(parts.at(-1))) {
      parts.pop();
    }

    if (parts.length > 1 && isOrganizationAlias(parts[0], organizationName)) {
      parts.shift();
    }

    return cleanCandidate(parts.join("-") || rawTitle, "jobTitle");
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

    const best = [...bestByValue.values()].sort((left, right) => right.score - left.score)[0];
    if (!best || best.score < MIN_ACCEPTED_SCORE[kind]) {
      return {
        value: "",
        score: 0,
        source: ""
      };
    }

    return best;
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
    if (kind === "company") {
      if (text.length > 100 || isPlatformName(text) || GENERIC_COMPANY_NAMES.has(text.toLowerCase())) {
        return "";
      }
      if (/^(?:招聘|公司|企业|单位|雇主|机构)(?:名称|信息)?$/i.test(text)) {
        return "";
      }
    }
    if (kind === "jobTitle") {
      if (text.length > 120 || GENERIC_JOB_TITLES.has(text.toLowerCase())) {
        return "";
      }
      const hasJobRoleWord = /(?:工程师|经理|总监|主管|专员|顾问|实习生|研究员|设计师|分析师|科学家|技术员|操作员|博士后)/i.test(text);
      if (/(?:招聘|求职|应聘|人才)(?:官网|网站|平台|系统|表单|中心)?$/i.test(text) && !hasJobRoleWord) {
        return "";
      }
    }
    return text;
  }

  function looksLikeRecruitmentCampaign(value) {
    const text = normalizeText(value, 120);
    return /^(?:20\d{2}(?:届|年)?\s*)?(?:(?:春季|秋季|春招|秋招)\s*)?(?:校园招聘|社会招聘|校招|社招|招聘专场|招聘)$/i.test(text);
  }

  function isOrganizationAlias(value, organizationName) {
    const alias = canonicalText(value);
    const organization = canonicalText(organizationName);
    return alias.length >= 4 && organization.length >= 4 && (
      organization.includes(alias) || alias.includes(organization)
    );
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

  function compareDate(left, right) {
    const leftTime = Date.parse(left || "");
    const rightTime = Date.parse(right || "");
    return (Number.isNaN(leftTime) ? 0 : leftTime) - (Number.isNaN(rightTime) ? 0 : rightTime);
  }

  function compareApplicationText(left, right) {
    return `${left?.companyName || ""} ${left?.jobTitle || ""}`.localeCompare(
      `${right?.companyName || ""} ${right?.jobTitle || ""}`,
      "zh-Hans-CN"
    );
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
    JOB_APPLICATION_SORT_MODES,
    JOB_APPLICATION_STATUS_META,
    JOB_APPLICATION_STATUSES,
    buildApplicationFingerprint,
    exportJobApplicationsToCsv,
    extractApplicationListCandidates,
    extractBeisenJobPageInfo,
    extractJobTitleFromPostingName,
    findJobPosting,
    inferApplicationChannel,
    normalizeJobApplication,
    normalizeJobApplications,
    normalizeJobApplicationStatus,
    normalizeSourceUrl,
    parsePageTitle,
    parseJobApplicationsCsv,
    resolveJobPageInfo,
    sortJobApplications,
    statusRank,
    statusTone
  };
});
