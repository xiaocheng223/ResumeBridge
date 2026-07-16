(function attachResumeBridgeProfileUtils(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.ResumeBridgeProfileUtils = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createResumeBridgeProfileUtils() {
  "use strict";

  const REPEAT_CONFIGS = [
    {
      sectionKey: "education",
      sectionLabels: ["教育经历", "教育背景"],
      actionLabels: ["添加教育经历", "新增教育经历", "继续添加教育经历"],
      anchorLabels: ["学校名称", "学校", "毕业院校"],
      maxItems: 6
    },
    {
      sectionKey: "internship",
      sectionLabels: ["实习经历", "工作实习经历", "实践经历"],
      actionLabels: ["添加实习经历", "新增实习经历", "继续添加实习经历"],
      anchorLabels: ["单位名称", "公司", "公司名称"],
      maxItems: 6
    },
    {
      sectionKey: "work",
      sectionLabels: ["工作经历", "正式工作经历"],
      actionLabels: ["添加工作经历", "新增工作经历", "继续添加工作经历"],
      anchorLabels: ["公司", "公司名称", "单位名称"],
      maxItems: 8
    },
    {
      sectionKey: "language",
      sectionLabels: ["语言能力", "外语能力"],
      actionLabels: ["添加语言能力", "新增语言能力", "添加外语能力", "新增外语能力"],
      anchorLabels: ["证书名称", "证书名称技能名称", "外语种类", "语言类型"],
      maxItems: 6
    },
    {
      sectionKey: "family",
      sectionLabels: ["家庭情况", "家庭信息", "家庭及社会关系"],
      actionLabels: ["添加家庭情况", "新增家庭情况", "添加家庭信息", "新增家庭信息"],
      anchorLabels: ["姓名"],
      maxItems: 8
    },
    {
      sectionKey: "training",
      sectionLabels: ["培训经历", "培训"],
      actionLabels: ["添加培训经历", "新增培训经历", "继续添加培训经历"],
      anchorLabels: ["培训名称", "培训机构"],
      maxItems: 6
    },
    {
      sectionKey: "papers",
      sectionLabels: ["论文专著", "论文著作", "论文和著作", "论文和专著"],
      actionLabels: ["添加论文专著", "新增论文专著", "添加论文著作", "添加论文和著作"],
      anchorLabels: ["论文名称", "名称"],
      maxItems: 10
    },
    {
      sectionKey: "patent",
      sectionLabels: ["专利", "专利成果"],
      actionLabels: ["添加专利", "新增专利", "添加专利成果"],
      anchorLabels: ["专利名称", "名称"],
      maxItems: 8
    },
    {
      sectionKey: "certificates",
      sectionLabels: ["证书", "证书信息", "资格证书"],
      actionLabels: ["添加证书", "新增证书", "添加证书信息"],
      anchorLabels: ["证书名称", "证书名称技能名称"],
      maxItems: 8
    }
  ];

  function normalizeActionText(value) {
    return String(value == null ? "" : value)
      .replace(/\s+/g, "")
      .replace(/^[+＋]/, "")
      .replace(/[()（）【】\[\]:：/\\_-]/g, "")
      .trim();
  }

  function isGenericAddAction(value) {
    return /^(?:添加|新增|继续添加)(?:一条)?$/.test(normalizeActionText(value));
  }

  function textIncludesAny(value, candidates) {
    const normalized = normalizeActionText(value);
    return Boolean(normalized && (candidates || []).some((candidate) => normalized.includes(normalizeActionText(candidate))));
  }

  function getConfigForActionText(actionText, sectionText = "") {
    const normalizedAction = normalizeActionText(actionText);
    if (!normalizedAction) {
      return null;
    }

    const explicit = REPEAT_CONFIGS.find((config) =>
      config.actionLabels.some((label) => normalizeActionText(label) === normalizedAction)
    );
    if (explicit) {
      return explicit;
    }

    if (!isGenericAddAction(normalizedAction)) {
      return null;
    }
    return REPEAT_CONFIGS.find((config) => textIncludesAny(sectionText, config.sectionLabels)) || null;
  }

  function isPopulatedItem(item) {
    if (!item || typeof item !== "object") {
      return false;
    }

    const values = item.values && typeof item.values === "object" ? Object.values(item.values) : [];
    const customValues = Array.isArray(item.custom) ? item.custom.map((row) => row?.value) : [];
    return [...values, ...customValues].some((value) => String(value == null ? "" : value).trim() !== "");
  }

  function countPopulatedItems(profileV2, sectionKey, maxItems = Number.POSITIVE_INFINITY) {
    const section = profileV2?.sections?.[sectionKey];
    const items = Array.isArray(section?.items) ? section.items : [];
    const limit = Number.isFinite(Number(maxItems)) ? Math.max(0, Number(maxItems)) : Number.POSITIVE_INFINITY;
    return Math.min(limit, items.filter(isPopulatedItem).length);
  }

  function getDesiredRepeatItemCount(profileV2, config) {
    if (!config?.sectionKey) {
      return 0;
    }
    return countPopulatedItems(profileV2, config.sectionKey, config.maxItems);
  }

  function getPublicationAvailability(profileV2) {
    const paperCount = countPopulatedItems(profileV2, "papers");
    const patentCount = countPopulatedItems(profileV2, "patent");
    return paperCount + patentCount > 0 ? "是" : "";
  }

  function getEducationRank(item) {
    if (!isPopulatedItem(item)) {
      return 0;
    }
    const values = item?.values && typeof item.values === "object" ? item.values : {};
    const text = Object.entries(values)
      .filter(([label]) => /学历|学位|教育层次/.test(String(label)))
      .map(([, value]) => String(value == null ? "" : value))
      .join(" ");
    if (/博士后/.test(text)) {
      return 60;
    }
    if (/博士/.test(text)) {
      return 50;
    }
    if (/硕士|研究生/.test(text)) {
      return 40;
    }
    if (/本科|学士/.test(text)) {
      return 30;
    }
    if (/大专|专科/.test(text)) {
      return 20;
    }
    if (/高中|中专|中技|职高/.test(text)) {
      return 10;
    }
    return 0;
  }

  function getHighestEducationIndex(profileV2) {
    const items = Array.isArray(profileV2?.sections?.education?.items)
      ? profileV2.sections.education.items
      : [];
    let bestIndex = -1;
    let bestRank = 0;
    items.forEach((item, index) => {
      const rank = getEducationRank(item);
      if (rank > bestRank) {
        bestRank = rank;
        bestIndex = index;
      }
    });
    return bestIndex;
  }

  function normalizeFamilyRelation(value) {
    const text = String(value == null ? "" : value).replace(/\s+/g, "");
    if (!text) {
      return "";
    }
    if (/父亲|爸爸/.test(text)) {
      return "父亲";
    }
    if (/母亲|妈妈/.test(text)) {
      return "母亲";
    }
    if (/父母|双亲/.test(text)) {
      return "父母";
    }
    if (/配偶|爱人|丈夫|妻子/.test(text)) {
      return "配偶";
    }
    if (/哥哥|弟弟|兄弟/.test(text) && !/姐妹/.test(text)) {
      return "兄弟";
    }
    if (/姐姐|妹妹|姐妹/.test(text) && !/兄弟/.test(text)) {
      return "姐妹";
    }
    if (/兄弟姐妹/.test(text)) {
      return "兄弟姐妹";
    }
    if (/儿子|女儿|子女/.test(text)) {
      return "子女";
    }
    if (/祖父|祖母|爷爷|奶奶|外公|外婆|祖父母/.test(text)) {
      return "祖父母";
    }
    return "";
  }

  function getFamilyRelationGroup(value) {
    const relation = normalizeFamilyRelation(value);
    if (["父亲", "母亲", "父母"].includes(relation)) {
      return "父母";
    }
    if (["兄弟", "姐妹", "兄弟姐妹"].includes(relation)) {
      return relation;
    }
    return relation;
  }

  function familyRelationsMatch(left, right) {
    const normalizedLeft = normalizeFamilyRelation(left);
    const normalizedRight = normalizeFamilyRelation(right);
    if (!normalizedLeft || !normalizedRight) {
      return false;
    }
    if (normalizedLeft === normalizedRight) {
      return true;
    }
    if (
      (normalizedLeft === "父母" && getFamilyRelationGroup(normalizedRight) === "父母") ||
      (normalizedRight === "父母" && getFamilyRelationGroup(normalizedLeft) === "父母")
    ) {
      return true;
    }
    return Boolean(
      (normalizedLeft === "兄弟姐妹" && ["兄弟", "姐妹"].includes(normalizedRight)) ||
      (normalizedRight === "兄弟姐妹" && ["兄弟", "姐妹"].includes(normalizedLeft))
    );
  }

  function projectFamilyRelationChoice(value, optionLabels = []) {
    const rawValue = String(value == null ? "" : value).trim();
    const options = (optionLabels || [])
      .map((option) => String(option == null ? "" : option).trim())
      .filter(Boolean);
    const exact = options.find((option) => normalizeFamilyRelation(option) === normalizeFamilyRelation(rawValue));
    if (exact) {
      return exact;
    }

    const group = getFamilyRelationGroup(rawValue);
    if (!group) {
      return rawValue;
    }
    const grouped = options.find((option) => normalizeFamilyRelation(option) === group);
    return grouped || rawValue;
  }

  function isDateOnlyValue(value) {
    const text = String(value == null ? "" : value).trim();
    return /^(?:19|20)\d{2}(?:[-./年](?:0?[1-9]|1[0-2])(?:[-./月](?:0?[1-9]|[12]\d|3[01])日?)?)?$/.test(text);
  }

  function normalizeProfileEntryLabel(category, label, value) {
    const rawLabel = String(label == null ? "" : label).trim();
    if (
      category === "论文著作" &&
      /^(?:是否)?第一作者$|^一作$/.test(rawLabel.replace(/\s+/g, "")) &&
      isDateOnlyValue(value)
    ) {
      return "发表日期";
    }
    return rawLabel;
  }

  function isFieldValueShapeCompatible(fieldLabel, entryLabel, value) {
    const field = String(fieldLabel == null ? "" : fieldLabel).replace(/\s+/g, "");
    const source = String(entryLabel == null ? "" : entryLabel).replace(/\s+/g, "");
    const text = String(value == null ? "" : value).trim();
    const narrativeField = /实习内容|工作内容|项目内容|项目描述|项目简介|职责描述|工作职责|本人职责|个人贡献|主要成果|成果描述/.test(field);
    const dateSource = /开始时间|结束时间|起始日期|截止日期|发表时间|发表日期|发布时间|出版日期|获得时间|获奖时间|日期|年月/.test(source);
    if (narrativeField && (dateSource || isDateOnlyValue(text))) {
      return false;
    }
    if (/是否第一作者|第一作者|是否一作/.test(field) && isDateOnlyValue(text)) {
      return false;
    }
    return true;
  }

  function getRepeatConfigs() {
    return REPEAT_CONFIGS.map((config) => ({
      ...config,
      sectionLabels: [...config.sectionLabels],
      actionLabels: [...config.actionLabels],
      anchorLabels: [...config.anchorLabels]
    }));
  }

  return {
    countPopulatedItems,
    familyRelationsMatch,
    getConfigForActionText,
    getDesiredRepeatItemCount,
    getFamilyRelationGroup,
    getHighestEducationIndex,
    getPublicationAvailability,
    getRepeatConfigs,
    isDateOnlyValue,
    isFieldValueShapeCompatible,
    isGenericAddAction,
    isPopulatedItem,
    normalizeActionText,
    normalizeFamilyRelation,
    normalizeProfileEntryLabel,
    projectFamilyRelationChoice
  };
});
