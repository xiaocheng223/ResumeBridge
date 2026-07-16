const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const playwrightCorePath = process.env.PLAYWRIGHT_CORE_PATH || "playwright-core";
const { chromium } = require(playwrightCorePath);

const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, "output", "playwright");
const fixtureUrl = process.env.RESUMEBRIDGE_FIXTURE_URL ||
  "http://127.0.0.1:4173/tests/fixtures/job-form.html";
const dateDropdownFixtureUrl = process.env.RESUMEBRIDGE_DATE_DROPDOWN_FIXTURE_URL ||
  "http://127.0.0.1:4173/tests/fixtures/date-dropdown.html";
const projectExperienceFixtureUrl = process.env.RESUMEBRIDGE_PROJECT_EXPERIENCE_FIXTURE_URL ||
  "http://127.0.0.1:4173/tests/fixtures/project-experience.html";

fs.mkdirSync(outputDir, { recursive: true });

function createQaExtensionCopy() {
  const extensionDir = fs.mkdtempSync(path.join(os.tmpdir(), "resumebridge-extension-"));
  for (const name of ["src", "icons", "assets"]) {
    fs.cpSync(path.join(rootDir, name), path.join(extensionDir, name), { recursive: true });
  }
  for (const name of ["manifest.json", "sample-profile.json", "LICENSE", "NOTICE"]) {
    fs.copyFileSync(path.join(rootDir, name), path.join(extensionDir, name));
  }

  const manifestPath = path.join(extensionDir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.host_permissions = ["http://127.0.0.1:4173/*"];
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return extensionDir;
}

async function waitForExtensionWorker(context) {
  const current = context.serviceWorkers().find((worker) => worker.url().startsWith("chrome-extension://"));
  if (current) {
    return current;
  }

  return context.waitForEvent("serviceworker", {
    predicate: (worker) => worker.url().startsWith("chrome-extension://"),
    timeout: 15000
  });
}

async function seedProfile(worker, fillPolicy) {
  await worker.evaluate(async (policy) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const response = await fetch(chrome.runtime.getURL("sample-profile.json"));
    const backup = await response.json();
    await chrome.storage.local.set({
      profileV2: backup.profileV2,
      fillPolicy: policy
    });
  }, fillPolicy);
}

async function setFillPolicy(worker, fillPolicy) {
  await worker.evaluate(
    async (policy) => chrome.storage.local.set({ fillPolicy: policy }),
    fillPolicy
  );
}

async function seedProjectFixtureProfile(worker) {
  await worker.evaluate(async () => {
    const stored = await chrome.storage.local.get(["profileV2"]);
    const profile = structuredClone(stored.profileV2 || {});
    profile.sections = profile.sections || {};
    profile.sections.project = {
      key: "project",
      title: "项目经历/实践活动",
      kind: "repeat",
      items: [
        {
          title: "项目经历 1 可重复使用运载器仿真平台",
          values: {
            开始时间: "2024-03",
            结束时间: "2025-06",
            职位: "技术负责人",
            项目名称: "可重复使用运载器仿真平台",
            项目内容: "构建运载器动力、制导与飞行环境联合仿真模型。",
            本人职责: "负责模型架构、接口定义与回归验证。",
            项目成果: "形成自动化验证流程并完成多工况测试。",
            项目链接: "https://example.com/reusable-launcher"
          },
          custom: [
            { label: "机构名称", value: "示例航天技术实验室" },
            { label: "项目类型", value: "重点研发" }
          ]
        },
        {
          title: "项目经历 2 卫星姿态控制验证系统",
          values: {
            开始时间: "2023-01",
            结束时间: "2024-02",
            职位: "算法负责人",
            项目名称: "卫星姿态控制验证系统",
            项目内容: "开发姿态确定与控制算法的半实物验证系统。",
            本人职责: "负责控制律设计、故障工况构造与数据分析。",
            项目成果: "完成闭环测试并沉淀可复用测试用例。",
            项目链接: "https://example.com/satellite-adcs"
          },
          custom: [
            { label: "机构名称", value: "示例空间系统中心" },
            { label: "项目类型", value: "技术验证" }
          ]
        }
      ]
    };
    await chrome.storage.local.set({ profileV2: profile });
  });
}

async function sendContentMessage(worker, message, options = {}) {
  return worker.evaluate(async ({ request, injectScripts }) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error("Active fixture tab not found");
    }
    if (injectScripts) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [
          "src/safety-policy.js",
          "src/date-utils.js",
          "src/project-utils.js",
          "src/profile-utils.js",
          "src/job-tracker.js",
          "src/content.js"
        ]
      });
    }
    return chrome.tabs.sendMessage(tab.id, request);
  }, { request: message, injectScripts: Boolean(options.injectScripts) });
}

async function runAutofill(worker, formPage) {
  await formPage.bringToFront();
  const response = await sendContentMessage(
    worker,
    { type: "OJAF_START_AUTOFILL" },
    { injectScripts: true }
  );

  return {
    ok: Boolean(response?.ok && response?.data?.ok),
    data: response?.data || response
  };
}

async function readForm(page) {
  return page.evaluate(() => ({
    name: document.getElementById("candidateName").value,
    email: document.getElementById("email").value,
    idNumber: document.getElementById("idNumber").value,
    emergencyContact: document.getElementById("emergencyContact").value,
    degree: document.getElementById("degree").value,
    backgroundCheck: document.querySelector('input[name="backgroundCheck"]:checked')?.value || "",
    submitCount: window.__resumeBridgeSubmitCount,
    markedFilled: document.querySelectorAll('[data-ojaf-mark="filled"]').length,
    markedPending: document.querySelectorAll('[data-ojaf-mark="uncertain"]').length
  }));
}

async function collectDiagnostics(worker) {
  return worker.evaluate(async () => {
    const stored = await chrome.storage.local.get(["profileV2", "fillPolicy", "apiConfig"]);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let debug = null;
    if (tab?.id) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: "OJAF_GET_DEBUG_SNAPSHOT" });
        debug = response?.data || response;
      } catch (error) {
        debug = { error: error.message };
      }
    }
    return {
      activeTab: tab ? { id: tab.id, url: tab.url, title: tab.title } : null,
      profileSections: Object.keys(stored.profileV2?.sections || {}),
      basicValues: stored.profileV2?.sections?.basic?.values || null,
      fillPolicy: stored.fillPolicy || null,
      apiConfig: stored.apiConfig || null,
      debug
    };
  });
}

async function inspectLayout(page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const horizontalOverflow = document.documentElement.scrollWidth - viewportWidth;
    const overflowingElements = Array.from(document.querySelectorAll("body *"))
      .filter((element) => {
        if (element.matches("input,textarea,pre")) {
          return false;
        }
        const style = getComputedStyle(element);
        if (["auto", "scroll"].includes(style.overflowX)) {
          return false;
        }
        return element.scrollWidth - element.clientWidth > 3;
      })
      .slice(0, 10)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        id: element.id,
        className: String(element.className || "").slice(0, 120)
      }));

    return {
      viewportWidth,
      documentWidth: document.documentElement.scrollWidth,
      horizontalOverflow,
      overflowingElements
    };
  });
}

async function main() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "resumebridge-qa-"));
  const extensionDir = createQaExtensionCopy();
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || chromium.executablePath();
  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath,
    headless: false,
    viewport: { width: 1440, height: 1000 },
    args: [
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`
    ]
  });

  const browserErrors = [];
  context.on("page", (page) => {
    page.on("pageerror", (error) => browserErrors.push(`${page.url()}: ${error.message}`));
  });

  try {
    const worker = await waitForExtensionWorker(context);
    const extensionId = new URL(worker.url()).host;
    const defaultPolicy = {
      overwriteExisting: false,
      fillSensitive: false,
      fillDeclarations: false
    };
    await seedProfile(worker, defaultPolicy);

    const optionsPage = await context.newPage();
    await optionsPage.goto(`chrome-extension://${extensionId}/src/options.html`);
    await optionsPage.waitForSelector("#profileSectionEditor .profile-edit-section");
    await optionsPage.screenshot({
      path: path.join(outputDir, "options-desktop.png")
    });
    await optionsPage.locator(".fill-policy-section").screenshot({
      path: path.join(outputDir, "fill-policy-desktop.png")
    });
    const desktopLayout = await inspectLayout(optionsPage);
    assert.equal(desktopLayout.horizontalOverflow <= 1, true, "desktop options page overflows horizontally");

    await optionsPage.setViewportSize({ width: 390, height: 844 });
    await optionsPage.screenshot({
      path: path.join(outputDir, "options-mobile.png")
    });
    const mobileLayout = await inspectLayout(optionsPage);
    assert.equal(mobileLayout.horizontalOverflow <= 1, true, "mobile options page overflows horizontally");

    const popupPage = await context.newPage();
    await popupPage.setViewportSize({ width: 390, height: 620 });
    await popupPage.goto(`chrome-extension://${extensionId}/src/popup.html`);
    await popupPage.waitForSelector("#startAutofillBtn");
    await popupPage.screenshot({ path: path.join(outputDir, "popup.png") });
    const popupLayout = await inspectLayout(popupPage);
    assert.equal(popupLayout.horizontalOverflow <= 1, true, "popup overflows horizontally");
    await popupPage.close();

    const formPage = await context.newPage();
    await formPage.setViewportSize({ width: 1280, height: 900 });
    await formPage.goto(fixtureUrl);
    await formPage.bringToFront();

    const captureResponse = await sendContentMessage(
      worker,
      { type: "OJAF_GET_JOB_PAGE_INFO" },
      { injectScripts: true }
    );
    assert.equal(captureResponse?.ok, true, "job page capture failed");
    assert.equal(captureResponse.data.companyName, "ResumeBridge 示例科技");
    assert.equal(captureResponse.data.jobTitle, "软件开发工程师");
    assert.equal(captureResponse.data.sourceUrl, fixtureUrl);

    const defaultRun = await runAutofill(worker, formPage);
    if (!defaultRun.ok) {
      const diagnostics = await collectDiagnostics(worker);
      throw new Error(`default autofill failed: ${JSON.stringify({ defaultRun, diagnostics }, null, 2)}`);
    }
    const defaultForm = await readForm(formPage);
    if (defaultForm.name !== "张三") {
      const diagnostics = await collectDiagnostics(worker);
      throw new Error(`default values did not match: ${JSON.stringify({ defaultRun, defaultForm, diagnostics }, null, 2)}`);
    }
    assert.equal(defaultForm.email, "keep@example.com");
    assert.equal(defaultForm.idNumber, "");
    assert.equal(defaultForm.emergencyContact, "");
    assert.equal(defaultForm.degree, "硕士研究生");
    assert.equal(defaultForm.backgroundCheck, "");
    assert.equal(defaultForm.submitCount, 0);
    assert.equal(defaultRun.data?.aiUsage?.attempted, false, "unconfigured AI should not be marked attempted");
    assert.equal(defaultRun.data?.aiUsage?.status, "idle");
    await formPage.screenshot({ path: path.join(outputDir, "fixture-default-policy.png"), fullPage: true });

    await setFillPolicy(worker, {
      overwriteExisting: false,
      fillSensitive: true,
      fillDeclarations: false
    });
    const sensitiveRun = await runAutofill(worker, formPage);
    assert.equal(sensitiveRun.ok, true, `sensitive autofill failed: ${JSON.stringify(sensitiveRun)}`);
    const sensitiveForm = await readForm(formPage);
    assert.equal(sensitiveForm.idNumber, "FAKE-ID-0001");
    assert.equal(sensitiveForm.emergencyContact, "示例联系人");
    assert.equal(sensitiveForm.backgroundCheck, "");
    assert.equal(sensitiveForm.submitCount, 0);

    await setFillPolicy(worker, {
      overwriteExisting: false,
      fillSensitive: true,
      fillDeclarations: true
    });
    const declarationRun = await runAutofill(worker, formPage);
    assert.equal(declarationRun.ok, true, `declaration autofill failed: ${JSON.stringify(declarationRun)}`);
    const declarationForm = await readForm(formPage);
    assert.equal(declarationForm.backgroundCheck, "是");
    assert.equal(declarationForm.submitCount, 0);

    await setFillPolicy(worker, {
      overwriteExisting: true,
      fillSensitive: true,
      fillDeclarations: true
    });
    const overwriteRun = await runAutofill(worker, formPage);
    assert.equal(overwriteRun.ok, true, `overwrite autofill failed: ${JSON.stringify(overwriteRun)}`);
    const overwriteForm = await readForm(formPage);
    assert.equal(overwriteForm.email, "demo@example.com");
    assert.equal(overwriteForm.submitCount, 0);
    await formPage.screenshot({ path: path.join(outputDir, "fixture-opt-in-policy.png"), fullPage: true });

    const panelResponse = await sendContentMessage(worker, { type: "OJAF_SHOW_PROFILE_PANEL" });
    assert.equal(panelResponse?.ok, true, "profile panel did not open");
    await formPage.waitForSelector("#ojaf-profile-panel");
    const panelPrivacy = await formPage.evaluate(() => {
      const host = document.getElementById("ojaf-profile-panel");
      return {
        hostPresent: Boolean(host),
        shadowRootAccessible: Boolean(host?.shadowRoot),
        lightDomChildCount: host?.childNodes?.length ?? -1,
        exposedTextLength: String(host?.textContent || "").trim().length
      };
    });
    assert.equal(panelPrivacy.hostPresent, true);
    assert.equal(panelPrivacy.shadowRootAccessible, false, "profile panel shadow root must stay closed");
    assert.equal(panelPrivacy.lightDomChildCount, 0, "profile values leaked into the page light DOM");
    assert.equal(panelPrivacy.exposedTextLength, 0, "profile panel text is readable from the page DOM");
    await formPage.screenshot({ path: path.join(outputDir, "profile-panel-privacy.png"), fullPage: true });

    const trackerPage = await context.newPage();
    await trackerPage.setViewportSize({ width: 1440, height: 1000 });
    await trackerPage.goto(`chrome-extension://${extensionId}/src/tracker.html`);
    await trackerPage.waitForFunction(() => document.getElementById("trackerFeedback")?.textContent.includes("已加载"));
    await trackerPage.click("#addApplication");
    const editor = trackerPage.locator('[data-application-id="__new__"]');
    await editor.locator('[data-field="companyName"]').fill(captureResponse.data.companyName);
    await editor.locator('[data-field="jobTitle"]').fill(captureResponse.data.jobTitle);
    await editor.locator('[data-field="appliedAt"]').fill("2026-07-14T10:30");
    await editor.locator('[data-field="status"]').selectOption("面试");
    await editor.locator('[data-field="notes"]').fill("浏览器追踪回归测试");
    await editor.locator('[data-action="save"]').click();
    await trackerPage.waitForFunction(() => document.getElementById("metricActive")?.textContent === "1");
    assert.equal(await trackerPage.locator("#applicationRows tr").count(), 1);
    assert.match(await trackerPage.locator("#applicationRows").innerText(), /ResumeBridge 示例科技/);
    assert.match(await trackerPage.locator("#applicationRows").innerText(), /软件开发工程师/);
    await trackerPage.screenshot({ path: path.join(outputDir, "tracker-desktop.png"), fullPage: true });
    const trackerDesktopLayout = await inspectLayout(trackerPage);
    assert.equal(trackerDesktopLayout.horizontalOverflow <= 1, true, "desktop tracker page overflows horizontally");

    await trackerPage.setViewportSize({ width: 390, height: 844 });
    await trackerPage.screenshot({ path: path.join(outputDir, "tracker-mobile.png"), fullPage: true });
    const trackerMobileLayout = await inspectLayout(trackerPage);
    assert.equal(trackerMobileLayout.horizontalOverflow <= 1, true, "mobile tracker page overflows horizontally");

    const trackerStorage = await worker.evaluate(async () => {
      const result = await chrome.storage.local.get(["jobApplications"]);
      return result.jobApplications || [];
    });
    assert.equal(trackerStorage.length, 1);
    assert.equal(trackerStorage[0].status, "面试");

    const dateDropdownPage = await context.newPage();
    await dateDropdownPage.setViewportSize({ width: 960, height: 720 });
    await dateDropdownPage.goto(dateDropdownFixtureUrl);
    const dateDropdownRun = await runAutofill(worker, dateDropdownPage);
    assert.equal(dateDropdownRun.ok, true, `split date dropdown autofill failed: ${JSON.stringify(dateDropdownRun)}`);
    const dateDropdownValues = await dateDropdownPage.evaluate(() => ({
      startYear: document.getElementById("startYear").dataset.value || "",
      startMonth: document.getElementById("startMonth").dataset.value || "",
      endYear: document.getElementById("endYear").dataset.value || "",
      endMonth: document.getElementById("endMonth").dataset.value || ""
    }));
    assert.deepEqual(dateDropdownValues, {
      startYear: "2024",
      startMonth: "9",
      endYear: "2027",
      endMonth: "6"
    });
    await dateDropdownPage.screenshot({
      path: path.join(outputDir, "date-dropdown-filled.png"),
      fullPage: true
    });
    const dateDropdownLayout = await inspectLayout(dateDropdownPage);
    assert.equal(dateDropdownLayout.horizontalOverflow <= 1, true, "date dropdown fixture overflows horizontally");

    await seedProjectFixtureProfile(worker);
    const projectExperiencePage = await context.newPage();
    await projectExperiencePage.setViewportSize({ width: 1180, height: 900 });
    await projectExperiencePage.goto(projectExperienceFixtureUrl);
    const projectExperienceRun = await runAutofill(worker, projectExperiencePage);
    assert.equal(projectExperienceRun.ok, true, `project experience autofill failed: ${JSON.stringify(projectExperienceRun)}`);
    const projectDebugResponse = await sendContentMessage(worker, { type: "OJAF_GET_DEBUG_SNAPSHOT" });
    const projectCandidateById = new Map(
      (projectDebugResponse?.data?.candidates || []).map((candidate) => [candidate.id || `candidate_${candidate.fieldId}`, candidate])
    );
    const projectExperienceFailures = (projectDebugResponse?.data?.results || [])
      .filter((result) => !result.ok)
      .map((result) => ({ ...projectCandidateById.get(result.id), note: result.note }));
    const projectExperienceValues = await projectExperiencePage.evaluate(() => {
      const read = (index, key) => document.getElementById(`${key}-${index}`)?.value || "";
      return {
        itemCount: document.querySelectorAll(".project-record-item").length,
        addCount: window.__projectAddCount,
        unrelatedAddCount: window.__unrelatedAddCount,
        submitCount: window.__projectSubmitCount,
        first: {
          title: read(1, "title"),
          organization: read(1, "organization"),
          role: read(1, "role"),
          startDate: read(1, "startDate"),
          endDate: read(1, "endDate"),
          projectType: read(1, "projectType"),
          summary: read(1, "summary"),
          contribution: read(1, "contribution"),
          result: read(1, "result"),
          url: read(1, "url")
        },
        second: {
          title: read(2, "title"),
          organization: read(2, "organization"),
          role: read(2, "role"),
          startDate: read(2, "startDate"),
          endDate: read(2, "endDate"),
          projectType: read(2, "projectType"),
          summary: read(2, "summary"),
          contribution: read(2, "contribution"),
          result: read(2, "result"),
          url: read(2, "url")
        }
      };
    });
    assert.equal(projectExperienceValues.itemCount, 2);
    assert.equal(projectExperienceValues.addCount, 1);
    assert.equal(projectExperienceValues.unrelatedAddCount, 0);
    assert.equal(projectExperienceValues.submitCount, 0);
    assert.equal(projectExperienceRun.data?.failed, 0, `project fields reported failures: ${JSON.stringify(projectExperienceFailures)}`);
    assert.deepEqual(projectExperienceValues.first, {
      title: "可重复使用运载器仿真平台",
      organization: "示例航天技术实验室",
      role: "技术负责人",
      startDate: "2024-03",
      endDate: "2025-06",
      projectType: "重点研发",
      summary: "构建运载器动力、制导与飞行环境联合仿真模型。",
      contribution: "负责模型架构、接口定义与回归验证。",
      result: "形成自动化验证流程并完成多工况测试。",
      url: "https://example.com/reusable-launcher"
    });
    assert.deepEqual(projectExperienceValues.second, {
      title: "卫星姿态控制验证系统",
      organization: "示例空间系统中心",
      role: "算法负责人",
      startDate: "2023-01",
      endDate: "2024-02",
      projectType: "技术验证",
      summary: "开发姿态确定与控制算法的半实物验证系统。",
      contribution: "负责控制律设计、故障工况构造与数据分析。",
      result: "完成闭环测试并沉淀可复用测试用例。",
      url: "https://example.com/satellite-adcs"
    });
    assert.equal(projectExperienceRun.data?.aiUsage?.attempted, false, "project fixture should use local matching only");
    await projectExperiencePage.screenshot({
      path: path.join(outputDir, "project-experience-filled.png"),
      fullPage: true
    });
    const projectExperienceLayout = await inspectLayout(projectExperiencePage);
    assert.equal(projectExperienceLayout.horizontalOverflow <= 1, true, "project experience fixture overflows horizontally");

    const result = {
      extensionId,
      workerUrl: worker.url(),
      desktopLayout,
      mobileLayout,
      popupLayout,
      trackerDesktopLayout,
      trackerMobileLayout,
      capture: captureResponse.data,
      trackerRecord: trackerStorage[0],
      dateDropdownRun: dateDropdownRun.data || dateDropdownRun,
      dateDropdownValues,
      dateDropdownLayout,
      projectExperienceRun: projectExperienceRun.data || projectExperienceRun,
      projectExperienceValues,
      projectExperienceFailures,
      projectExperienceLayout,
      defaultRun: defaultRun.data || defaultRun,
      defaultForm,
      sensitiveRun: sensitiveRun.data || sensitiveRun,
      sensitiveForm,
      declarationRun: declarationRun.data || declarationRun,
      declarationForm,
      overwriteRun: overwriteRun.data || overwriteRun,
      overwriteForm,
      panelPrivacy,
      browserErrors
    };

    fs.writeFileSync(
      path.join(outputDir, "qa-results.json"),
      `${JSON.stringify(result, null, 2)}\n`,
      "utf8"
    );
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
