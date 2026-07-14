(() => {
  function compact(value) {
    return String(value || "")
      .replace(/\s+/g, "")
      .replace(/[：:，,。．、/\\|()（）【】\[\]<>《》"'“”‘’]/g, "")
      .trim();
  }

  function isProjectSectionText(value) {
    const text = compact(value);
    if (!text) {
      return false;
    }
    if (/项目经历|项目经验/.test(text)) {
      return true;
    }
    if (/竞赛项目|比赛项目|培训项目|申请项目|应聘项目|意向项目/.test(text)) {
      return false;
    }
    return /科研项目|研究项目|工程项目|实践项目|项目实践|课题经历|科研课题|研究课题/.test(text);
  }

  function isProjectFieldText(value) {
    const text = compact(value);
    return /项目名称|项目标题|项目名|课题名称|课题题目|项目所属机构|项目单位|项目类别|项目类型|担任角色|项目角色|项目简介|项目概述|项目描述|项目内容|个人贡献|本人职责|项目职责|主要成果|项目成果|项目链接|项目地址|作品地址/.test(text);
  }

  function isProjectNameLabel(value) {
    return /^(项目名称|项目标题|项目名|课题名称|课题题目|实践名称|实践项目名称)$/.test(compact(value));
  }

  function isProjectAddActionText(value) {
    const text = compact(value).replace(/^[+＋]/, "");
    if (!text || /删除|移除|保存|提交|取消/.test(text)) {
      return false;
    }
    return /^(?:添加|新增|继续添加|再添加)(?:一条)?(?:项目|项目经历|项目经验|科研项目|研究项目|实践项目)(?:记录|经历|经验)?$/.test(text);
  }

  function hasValue(value) {
    return value != null && String(value).trim() !== "";
  }

  function isPopulatedProjectItem(item) {
    if (!item || typeof item !== "object") {
      return false;
    }
    const values = item.values && typeof item.values === "object" ? Object.values(item.values) : [];
    const custom = Array.isArray(item.custom) ? item.custom.map((row) => row?.value) : [];
    return [...values, ...custom].some(hasValue);
  }

  function isProjectProfileSection(sectionKey, section) {
    const key = compact(sectionKey);
    const title = compact(section?.title);
    return key === "project" || isProjectSectionText(key) || isProjectSectionText(title);
  }

  function countPopulatedProjectItems(profileV2) {
    if (!profileV2 || typeof profileV2 !== "object") {
      return 0;
    }

    const sections = [];
    const namedSections = profileV2.sections && typeof profileV2.sections === "object" ? profileV2.sections : {};
    for (const [sectionKey, section] of Object.entries(namedSections)) {
      sections.push({ sectionKey, section });
    }
    for (const [index, section] of (Array.isArray(profileV2.customSections) ? profileV2.customSections : []).entries()) {
      sections.push({ sectionKey: section?.key || `custom-${index}`, section });
    }

    return sections.reduce((total, { sectionKey, section }) => {
      if (!isProjectProfileSection(sectionKey, section) || section?.kind !== "repeat") {
        return total;
      }
      return total + (Array.isArray(section.items) ? section.items.filter(isPopulatedProjectItem).length : 0);
    }, 0);
  }

  const api = {
    countPopulatedProjectItems,
    isProjectAddActionText,
    isProjectFieldText,
    isProjectNameLabel,
    isProjectProfileSection,
    isProjectSectionText
  };

  globalThis.ResumeBridgeProjectUtils = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
