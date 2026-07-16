const test = require("node:test");
const assert = require("node:assert/strict");

const profileUtils = require("../src/profile-utils.js");

function populated(values) {
  return { values, custom: [] };
}

test("counts only populated repeat items and respects the configured cap", () => {
  const profile = {
    sections: {
      papers: {
        items: [
          populated({ 论文名称: "论文 A" }),
          populated({ 论文名称: "" }),
          { values: {}, custom: [{ label: "补充", value: "论文 B" }] },
          populated({ 论文名称: "论文 C" })
        ]
      }
    }
  };

  assert.equal(profileUtils.countPopulatedItems(profile, "papers"), 3);
  assert.equal(profileUtils.countPopulatedItems(profile, "papers", 2), 2);
});

test("resolves explicit and section-scoped generic add actions", () => {
  assert.equal(profileUtils.getConfigForActionText("新增教育经历")?.sectionKey, "education");
  assert.equal(profileUtils.getConfigForActionText("添加论文/专著")?.sectionKey, "papers");
  assert.equal(profileUtils.getConfigForActionText("＋ 添加", "论文/专著")?.sectionKey, "papers");
  assert.equal(profileUtils.getConfigForActionText("添加", "家庭情况")?.sectionKey, "family");
  assert.equal(profileUtils.getConfigForActionText("添加", "获奖情况"), null);
  assert.equal(profileUtils.getRepeatConfigs().some((config) => config.sectionKey === "awards"), false);
});

test("projects exact family relations into the broad categories used by Phoenix ATS", () => {
  const options = ["父母", "兄弟", "配偶", "姐妹", "子女", "祖父母"];
  assert.equal(profileUtils.projectFamilyRelationChoice("父亲", options), "父母");
  assert.equal(profileUtils.projectFamilyRelationChoice("母亲", options), "父母");
  assert.equal(profileUtils.projectFamilyRelationChoice("姐姐", options), "姐妹");
  assert.equal(profileUtils.familyRelationsMatch("父母", "父亲"), true);
  assert.equal(profileUtils.familyRelationsMatch("父亲", "母亲"), false);
  assert.equal(profileUtils.familyRelationsMatch("父亲", "配偶"), false);
});

test("repairs date values mislabeled as first-author data without inventing authorship", () => {
  assert.equal(
    profileUtils.normalizeProfileEntryLabel("论文著作", "第一作者", "2026.03.24"),
    "发表日期"
  );
  assert.equal(profileUtils.normalizeProfileEntryLabel("论文著作", "第一作者", "是"), "第一作者");
});

test("rejects date-shaped values for narrative and first-author fields", () => {
  assert.equal(profileUtils.isFieldValueShapeCompatible("实习内容", "开始时间", "2025-03"), false);
  assert.equal(profileUtils.isFieldValueShapeCompatible("是否第一作者", "第一作者", "2026.03.24"), false);
  assert.equal(profileUtils.isFieldValueShapeCompatible("项目内容", "项目内容", "完成实验平台搭建"), true);
});

test("derives publication availability only from existing paper or patent records", () => {
  assert.equal(profileUtils.getPublicationAvailability({ sections: {} }), "");
  assert.equal(
    profileUtils.getPublicationAvailability({
      sections: { patent: { items: [populated({ 专利名称: "专利 A" })] } }
    }),
    "是"
  );
});

test("finds the highest recognized education record without relying on array order", () => {
  const profile = {
    sections: {
      education: {
        items: [
          populated({ 学历: "本科", 学位: "学士" }),
          populated({ 学历: "博士研究生", 学位: "博士" }),
          populated({ 学历: "硕士研究生", 学位: "硕士" })
        ]
      }
    }
  };

  assert.equal(profileUtils.getHighestEducationIndex(profile), 1);
  assert.equal(profileUtils.getHighestEducationIndex({ sections: { education: { items: [populated({ 学校: "A" })] } } }), -1);
});
