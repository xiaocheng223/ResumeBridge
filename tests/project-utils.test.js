const test = require("node:test");
const assert = require("node:assert/strict");

const projectUtils = require("../src/project-utils.js");

test("recognizes project sections without confusing competitions and training", () => {
  for (const value of ["项目经历", "项目经验 / 科研项目", "研究项目", "课题经历", "实践项目"]) {
    assert.equal(projectUtils.isProjectSectionText(value), true, value);
  }
  for (const value of ["竞赛项目", "培训项目", "申请项目", "工作经历"]) {
    assert.equal(projectUtils.isProjectSectionText(value), false, value);
  }
});

test("accepts only explicit project add actions", () => {
  for (const value of ["+ 添加项目经验", "新增项目", "继续添加科研项目", "再添加一条项目经历"]) {
    assert.equal(projectUtils.isProjectAddActionText(value), true, value);
  }
  for (const value of ["添加专业名称", "添加教育经历", "删除项目", "提交申请"]) {
    assert.equal(projectUtils.isProjectAddActionText(value), false, value);
  }
});

test("counts only populated project repeat items", () => {
  assert.equal(projectUtils.countPopulatedProjectItems({
    sections: {
      education: {
        key: "education",
        title: "教育经历",
        kind: "repeat",
        items: [{ values: { 学校名称: "示例大学" } }]
      },
      project: {
        key: "project",
        title: "项目经历/实践活动",
        kind: "repeat",
        items: [
          { values: { 项目名称: "项目一" }, custom: [] },
          { values: {}, custom: [{ label: "机构名称", value: "示例机构" }] },
          { values: { 项目名称: "" }, custom: [] }
        ]
      }
    }
  }), 2);
});
