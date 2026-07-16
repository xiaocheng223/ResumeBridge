const test = require("node:test");
const assert = require("node:assert/strict");

const tracker = require("../src/job-tracker.js");

test("prefers JobPosting structured data over lower-confidence page candidates", () => {
  const result = tracker.resolveJobPageInfo({
    url: "https://jobs.example.com/apply/42?candidate_token=secret#form",
    hostname: "jobs.example.com",
    pageTitle: "错误职位 - 错误公司 - 招聘平台",
    jobPostings: [
      {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        title: "液体火箭发动机设计岗",
        hiringOrganization: { "@type": "Organization", name: "示例航天科技有限公司" }
      }
    ],
    companyCandidates: [{ value: "页面中的其他公司", score: 80, source: "selector" }],
    jobTitleCandidates: [{ value: "页面中的其他职位", score: 80, source: "selector" }]
  });

  assert.equal(result.companyName, "示例航天科技有限公司");
  assert.equal(result.jobTitle, "液体火箭发动机设计岗");
  assert.equal(result.sourceUrl, "https://jobs.example.com/apply/42");
  assert.equal(result.confidence.companyName, 0.99);
  assert.equal(result.evidence.jobTitle, "json-ld");
});

test("finds a JobPosting nested inside an @graph JSON-LD document", () => {
  const posting = tracker.findJobPosting({
    "@graph": [
      { "@type": "WebSite", name: "招聘网站" },
      {
        "@type": ["Thing", "JobPosting"],
        name: "控制算法工程师",
        hiringOrganization: "蓝天动力"
      }
    ]
  });

  assert.deepEqual(posting, {
    companyName: "蓝天动力",
    jobTitle: "控制算法工程师"
  });
});

test("uses scored semantic candidates before page-title fallbacks", () => {
  const result = tracker.resolveJobPageInfo({
    pageTitle: "测试工程师 - 标题中的公司 - BOSS直聘",
    companyCandidates: [
      { value: "低分公司", score: 40, source: "generic-selector" },
      { value: "高分公司", score: 88, source: "itemprop" }
    ],
    jobTitleCandidates: [{ value: "飞控测试工程师", score: 85, source: "h1" }]
  });

  assert.equal(result.companyName, "高分公司");
  assert.equal(result.jobTitle, "飞控测试工程师");
  assert.equal(result.evidence.companyName, "itemprop");
});

test("parses common page titles and discards recruitment platform names", () => {
  assert.deepEqual(tracker.parsePageTitle("结构工程师 - 星河航天 - BOSS直聘"), {
    jobTitle: "结构工程师",
    companyName: "星河航天"
  });
  assert.deepEqual(tracker.parsePageTitle("结构工程师-星河航天-BOSS直聘"), {
    jobTitle: "结构工程师",
    companyName: "星河航天"
  });
  assert.deepEqual(tracker.parsePageTitle("算法-工程师"), {
    jobTitle: "算法-工程师",
    companyName: ""
  });
  assert.deepEqual(tracker.parsePageTitle("北方华创招聘"), {
    jobTitle: "",
    companyName: ""
  });
});

test("accepts an unambiguous company and role pair from a page title", () => {
  const result = tracker.resolveJobPageInfo({
    pageTitle: "结构工程师 - 星河航天 - BOSS直聘"
  });

  assert.equal(result.companyName, "星河航天");
  assert.equal(result.jobTitle, "结构工程师");
  assert.equal(result.evidence.companyName, "page-title");
});

test("leaves low-confidence or resume-form noise blank instead of guessing", () => {
  const result = tracker.resolveJobPageInfo({
    pageTitle: "北方华创招聘",
    companyCandidates: [
      { value: "工作单位", score: 88, source: "form-class" },
      { value: "示例公司", score: 40, source: "weak-meta" }
    ],
    jobTitleCandidates: [
      { value: "论文/专著", score: 88, source: "form-heading" },
      { value: "结构工程师", score: 50, source: "weak-meta" }
    ]
  });

  assert.equal(result.companyName, "");
  assert.equal(result.jobTitle, "");
  assert.equal(result.confidence.companyName, 0);
  assert.equal(result.evidence.jobTitle, "");
});

test("extracts the legal employer and role from a Beisen job response", () => {
  const result = tracker.extractBeisenJobPageInfo({
    Code: 200,
    Data: {
      JobAdName: "北方华创微电子-半导体工艺工程师（博士）-2027校园招聘",
      Org: "北京北方华创微电子装备有限公司"
    }
  });

  assert.deepEqual(result, {
    companyName: "北京北方华创微电子装备有限公司",
    jobTitle: "半导体工艺工程师（博士）"
  });
  assert.equal(
    tracker.extractJobTitleFromPostingName(
      "北方华创微电子-半导体工艺工程师（博士）-2027校园招聘",
      "北方华创"
    ),
    "半导体工艺工程师（博士）"
  );
  assert.deepEqual(tracker.extractBeisenJobPageInfo({ Code: 500, Data: {} }), {
    companyName: "",
    jobTitle: ""
  });
});

test("normalizes tracker records and strips private URL components", () => {
  const record = tracker.normalizeJobApplication(
    {
      id: " application-1 ",
      companyName: "  示例  公司 ",
      jobTitle: "  软件工程师 ",
      appliedAt: "2026-07-14T09:30:00+08:00",
      status: "unknown",
      notes: "第一轮\r\n\r\n\r\n等待反馈",
      sourceUrl: "https://careers.example.com/jobs/1?token=secret#apply"
    },
    { now: "2026-07-14T02:00:00.000Z" }
  );

  assert.equal(record.id, "application-1");
  assert.equal(record.companyName, "示例 公司");
  assert.equal(record.jobTitle, "软件工程师");
  assert.equal(record.status, "已投递");
  assert.equal(record.notes, "第一轮\n\n等待反馈");
  assert.equal(record.sourceUrl, "https://careers.example.com/jobs/1");
  assert.equal(record.sourceSite, "careers.example.com");
});

test("builds stable same-day fingerprints but permits a later reapplication", () => {
  const base = {
    companyName: "示例 航天",
    jobTitle: "研发-工程师",
    sourceUrl: "https://jobs.example.com/position/1?token=a",
    appliedAt: "2026-07-14T04:00:00.000Z"
  };
  const same = {
    ...base,
    companyName: "示例航天",
    jobTitle: "研发工程师",
    sourceUrl: "https://jobs.example.com/position/1?token=b"
  };
  const later = { ...base, appliedAt: "2026-08-14T04:00:00.000Z" };

  assert.equal(tracker.buildApplicationFingerprint(base), tracker.buildApplicationFingerprint(same));
  assert.notEqual(tracker.buildApplicationFingerprint(base), tracker.buildApplicationFingerprint(later));
});

test("keeps legacy statuses while exposing a richer pipeline", () => {
  const legacy = tracker.normalizeJobApplication(
    {
      id: "legacy-1",
      companyName: "示例公司",
      jobTitle: "研发工程师",
      appliedAt: "2026-07-01T02:00:00.000Z",
      status: "面试",
      sourceUrl: "https://jobs.example.com/position/1",
      updatedAt: "2026-07-03T02:00:00.000Z"
    },
    { now: "2026-07-16T02:00:00.000Z" }
  );
  const imported = tracker.normalizeJobApplication({
    companyName: "示例公司",
    jobTitle: "测试工程师",
    appliedAt: "2026-07-02T02:00:00.000Z",
    status: "准备投递"
  });

  assert.equal(legacy.status, "面试");
  assert.equal(legacy.statusUpdatedAt, "2026-07-03T02:00:00.000Z");
  assert.equal(imported.status, "待投递");
  assert.equal(tracker.statusTone("测评 / 笔试"), "assessment");
  assert.equal(tracker.statusTone("Offer"), "offer");
  assert.ok(tracker.statusRank("终面") > tracker.statusRank("已投递"));
  assert.ok(tracker.JOB_APPLICATION_STATUSES.includes("等待面试结果"));
});

test("normalizes channel and independent status-page metadata", () => {
  const record = tracker.normalizeJobApplication(
    {
      companyName: "示例公司",
      jobTitle: "控制工程师",
      appliedAt: "2026-07-16T02:00:00.000Z",
      sourceUrl: "https://www.zhipin.com/job_detail/abc?token=private",
      statusUrl: "https://www.zhipin.com/web/geek/recommend?session=private",
      channel: ""
    },
    { now: "2026-07-16T03:00:00.000Z" }
  );

  assert.equal(record.channel, "BOSS直聘");
  assert.equal(record.statusUrl, "https://www.zhipin.com/web/geek/recommend");
  assert.equal(record.statusUpdatedAt, "2026-07-16T03:00:00.000Z");
  assert.equal(tracker.inferApplicationChannel("https://jobs.example.com/apply"), "公司官网");
  assert.equal(tracker.inferApplicationChannel("https://tenant.wd3.myworkdayjobs.com/job/1"), "Workday");
});

test("sorts applications by dates and pipeline rank without mutating input", () => {
  const records = [
    {
      id: "offer",
      companyName: "甲公司",
      jobTitle: "岗位甲",
      appliedAt: "2026-07-01T00:00:00.000Z",
      status: "Offer",
      statusUpdatedAt: "2026-07-15T00:00:00.000Z"
    },
    {
      id: "submitted",
      companyName: "乙公司",
      jobTitle: "岗位乙",
      appliedAt: "2026-07-12T00:00:00.000Z",
      status: "已投递",
      statusUpdatedAt: "2026-07-12T00:00:00.000Z"
    }
  ];

  assert.deepEqual(tracker.sortJobApplications(records, "applied-desc").map((item) => item.id), [
    "submitted",
    "offer"
  ]);
  assert.deepEqual(tracker.sortJobApplications(records, "status-updated-desc").map((item) => item.id), [
    "offer",
    "submitted"
  ]);
  assert.deepEqual(tracker.sortJobApplications(records, "pipeline").map((item) => item.id), [
    "submitted",
    "offer"
  ]);
  assert.equal(records[0].id, "offer");
});

test("imports compatible quoted CSV records and normalizes reference-project headers", () => {
  const csv = [
    "\ufeff公司名称,申请职位,投递时间,投递渠道,职位链接/JD链接,查看投递状态界面,投递状态,状态更新时间,备注",
    '"星河,航天",结构工程师,2026-07-16 10:30,内推,https://jobs.example.com/42?token=x,https://jobs.example.com/status?token=x,准备投递,2026-07-16 11:00,"第一行',
    '第二行"'
  ].join("\r\n");

  const result = tracker.parseJobApplicationsCsv(csv, { now: "2026-07-16T12:00:00.000Z" });

  assert.equal(result.applications.length, 1);
  assert.equal(result.invalidCount, 0);
  assert.equal(result.applications[0].companyName, "星河,航天");
  assert.equal(result.applications[0].status, "待投递");
  assert.equal(result.applications[0].notes, "第一行\n第二行");
  assert.equal(result.applications[0].sourceUrl, "https://jobs.example.com/42");
  assert.equal(result.applications[0].statusUrl, "https://jobs.example.com/status");
});

test("exports spreadsheet-safe UTF-8 CSV with the expanded tracker fields", () => {
  const csv = tracker.exportJobApplicationsToCsv([
    {
      id: "csv-1",
      companyName: "=HYPERLINK(\"https://bad.example\")",
      jobTitle: "测试工程师",
      appliedAt: "2026-07-16T02:30:00.000Z",
      channel: "公司官网",
      sourceUrl: "https://jobs.example.com/1",
      statusUrl: "https://jobs.example.com/applications",
      status: "已投递",
      statusUpdatedAt: "2026-07-16T03:30:00.000Z",
      notes: "等待反馈"
    }
  ]);

  assert.ok(csv.startsWith("\ufeff公司名称,申请职位,投递时间,投递渠道"));
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/bad\.example""\)"/);
  assert.match(csv, /查看投递状态界面/);
  assert.match(csv, /状态更新时间/);
});

test("extracts bounded candidates from Chinese application-history cards", () => {
  const candidates = tracker.extractApplicationListCandidates({
    lines: [
      "我的投递",
      "液体火箭发动机设计岗（4341535）",
      "投递时间：2026-07-15 09:30:00",
      "简历筛选中",
      "结构强度工程师（4341888）",
      "投递时间：2026-07-16 10:15:00",
      "进入面试环节"
    ],
    companyName: "示例航天科技有限公司",
    sourceUrl: "https://jobs.example.com/personal/applications?token=private",
    sourceSite: "jobs.example.com"
  });

  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].jobTitle, "液体火箭发动机设计岗");
  assert.equal(candidates[0].status, "简历筛选中");
  assert.equal(candidates[1].jobTitle, "结构强度工程师");
  assert.equal(candidates[1].status, "面试");
  assert.equal(candidates[1].statusUrl, "https://jobs.example.com/personal/applications");
});

test("extracts a SuccessFactors application card only when requisition and date evidence exist", () => {
  const candidates = tracker.extractApplicationListCandidates({
    lines: [
      "My Applications",
      "Senior Process Engineer",
      "Requisition ID: 139166",
      "Applied On: Jun 26, 2026",
      "Under Consideration"
    ],
    companyName: "Example Materials",
    sourceUrl: "https://career5.successfactors.eu/career?company=example#applications"
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].jobTitle, "Senior Process Engineer");
  assert.equal(candidates[0].status, "简历筛选中");
  assert.equal(candidates[0].channel, "SuccessFactors");
  assert.deepEqual(
    tracker.extractApplicationListCandidates({ lines: ["个人中心", "隐私政策"] }),
    []
  );
});
