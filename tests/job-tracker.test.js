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
