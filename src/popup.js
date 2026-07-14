const els = {
  status: document.getElementById("status"),
  openOptions: document.getElementById("openOptions"),
  startAutofillBtn: document.getElementById("startAutofillBtn"),
  showProfilePanelBtn: document.getElementById("showProfilePanelBtn"),
  clearMarksBtn: document.getElementById("clearMarksBtn"),
  openTracker: document.getElementById("openTracker"),
  applicationCaptureForm: document.getElementById("applicationCaptureForm"),
  captureFeedback: document.getElementById("captureFeedback"),
  captureCompanyName: document.getElementById("captureCompanyName"),
  captureJobTitle: document.getElementById("captureJobTitle"),
  captureAppliedAt: document.getElementById("captureAppliedAt"),
  captureStatus: document.getElementById("captureStatus"),
  captureNotes: document.getElementById("captureNotes"),
  saveApplication: document.getElementById("saveApplication")
};

const DEFAULT_START_LABEL = els.startAutofillBtn.textContent;
const CONTENT_SCRIPT_FILES = ["src/safety-policy.js", "src/date-utils.js", "src/project-utils.js", "src/job-tracker.js", "src/content.js"];
let capturedJobPageInfo = null;

els.openOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());
els.startAutofillBtn.addEventListener("click", () => {
  void startAutofill();
});
els.showProfilePanelBtn.addEventListener("click", () => {
  void showProfilePanel();
});
els.clearMarksBtn.addEventListener("click", () => {
  void clearMarks();
});
els.openTracker.addEventListener("click", openTrackerPage);
els.applicationCaptureForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void saveCurrentApplication();
});
initialize();

async function initialize() {
  setStatus("点击开始填写后，右下角会实时显示当前是本地规则还是 AI；AI 不可用也能继续用本地规则填写。");
  els.captureAppliedAt.value = toLocalDateTimeInput(new Date());
  await Promise.allSettled([syncRuntimeState(), loadCurrentJobPageInfo()]);
}

async function loadCurrentJobPageInfo() {
  setCaptureFeedback("正在识别当前页面...");
  try {
    const response = await sendToActiveTab({ type: "OJAF_GET_JOB_PAGE_INFO" });
    capturedJobPageInfo = response?.data || {};
    els.captureCompanyName.value = capturedJobPageInfo.companyName || "";
    els.captureJobTitle.value = capturedJobPageInfo.jobTitle || "";

    if (capturedJobPageInfo.companyName && capturedJobPageInfo.jobTitle) {
      setCaptureFeedback("已从当前页面识别公司和职位，请核对后记录。", "success");
    } else if (capturedJobPageInfo.companyName || capturedJobPageInfo.jobTitle) {
      setCaptureFeedback("已识别部分信息，请补充缺失项后记录。", "");
    } else {
      setCaptureFeedback("未能可靠识别公司和职位，可手动填写后记录。", "");
    }
  } catch {
    capturedJobPageInfo = null;
    setCaptureFeedback("当前页面无法自动识别，可手动填写后记录。", "");
  }
}

async function saveCurrentApplication() {
  if (!els.applicationCaptureForm.reportValidity()) {
    return;
  }

  els.saveApplication.disabled = true;
  els.saveApplication.textContent = "保存中...";
  try {
    const result = await sendRuntimeMessage({
      type: "OJAF_SAVE_JOB_APPLICATION",
      payload: {
        application: {
          companyName: els.captureCompanyName.value,
          jobTitle: els.captureJobTitle.value,
          appliedAt: new Date(els.captureAppliedAt.value).toISOString(),
          status: els.captureStatus.value,
          notes: els.captureNotes.value,
          sourceUrl: capturedJobPageInfo?.sourceUrl || "",
          sourceSite: capturedJobPageInfo?.sourceSite || ""
        }
      }
    });

    if (result.duplicate) {
      setCaptureFeedback("今天已记录过相同公司、职位和页面，未重复添加。", "");
    } else {
      setCaptureFeedback("投递记录已保存到本机。", "success");
    }
  } catch (error) {
    setCaptureFeedback(`保存失败：${error.message}`, "error");
  } finally {
    els.saveApplication.disabled = false;
    els.saveApplication.textContent = "记录本次投递";
  }
}

function openTrackerPage() {
  chrome.tabs.create({ url: chrome.runtime.getURL("src/tracker.html") });
}

function setCaptureFeedback(message, state = "") {
  els.captureFeedback.textContent = message;
  els.captureFeedback.classList.toggle("success", state === "success");
  els.captureFeedback.classList.toggle("error", state === "error");
}

function toLocalDateTimeInput(date) {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

async function syncRuntimeState(options = {}) {
  try {
    const response = await sendToActiveTab({ type: "OJAF_GET_RUNTIME_STATE" });
    applyRuntimeState(response?.data || {}, options);
  } catch {
    els.startAutofillBtn.disabled = false;
    els.startAutofillBtn.textContent = DEFAULT_START_LABEL;
  }
}

function applyRuntimeState(state = {}, options = {}) {
  const busy = Boolean(state.autofillInProgress);
  els.startAutofillBtn.disabled = busy;
  els.startAutofillBtn.textContent = busy ? "扫描中..." : DEFAULT_START_LABEL;

  if (options.updateStatus === false) {
    return;
  }

  if (busy) {
    const progress = state.autofillProgress || {};
    const stageLabel = progress.stepLabel || progress.stage || "处理当前页面";
    const stage = /^正在/.test(stageLabel) ? stageLabel : `正在${stageLabel}`;
    const elapsed = formatElapsedTime(progress.stageStartedAt);
    const aiNote = formatRuntimeAiNote(state.autofillAi || {}, elapsed);
    setStatus(`当前${stage}，请勿重复点击。页面右下角会显示进度。${aiNote}`);
    return;
  }

  if (state.autofillSummary) {
    const summary = state.autofillSummary;
    setStatus(`上次填写：已填写 ${summary.filled || 0} 项，待处理 ${getPendingCount(summary)} 项。${formatAiCompletionNote(summary.aiUsage || state.autofillAi || {})}`);
  }
}

async function showProfilePanel() {
  try {
    await sendToActiveTab({ type: "OJAF_SHOW_PROFILE_PANEL" });
    setStatus("已打开资料面板。");
    await syncRuntimeState({ updateStatus: false });
  } catch (error) {
    setStatus(`打开失败：${error.message}`, true);
  }
}

async function startAutofill() {
  try {
    els.startAutofillBtn.disabled = true;
    els.startAutofillBtn.textContent = "扫描中...";
    setStatus("正在开始填写；右下角会显示当前是本地规则还是 AI。");
    const response = await sendToActiveTab({ type: "OJAF_START_AUTOFILL" });
    const data = response?.data || {};
    if (data.ok) {
      if (data.filled != null) {
        setStatus(`已完成一键填写：已填写 ${data.filled || 0} 项，待处理 ${getPendingCount(data)} 项。${formatAiCompletionNote(data.aiUsage || {})}`);
      } else {
        setStatus("已完成扫描处理。页面上的橙色标记需要手动处理，也可以打开资料面板查看和复制资料。");
      }
    } else if (data.reason === "cancelled") {
      setStatus("已取消填写。");
    } else if (data.reason === "no candidates") {
      setStatus(`没有找到可自动填写的字段。橙色标记需要手动处理，也可以打开资料面板查看和复制资料。${formatAiCompletionNote(data.aiUsage || {})}`);
    } else if (data.reason === "busy") {
      setStatus("当前已有扫描任务在运行，请稍候。", true);
    } else if (data.reason) {
      setStatus(`开始填写未完成：${data.reason}`, true);
    } else {
      setStatus("已开始处理一键填写。");
    }
    await syncRuntimeState({ updateStatus: false });
  } catch (error) {
    setStatus(`开始填写失败：${error.message}`, true);
    await syncRuntimeState({ updateStatus: false });
  }
}

async function clearMarks() {
  try {
    await sendToActiveTab({ type: "OJAF_CLEAR_MARKS" });
    setStatus("已清除颜色标记，不会修改表单内容。");
    await syncRuntimeState({ updateStatus: false });
  } catch (error) {
    setStatus(`清除失败：${error.message}`, true);
  }
}

function formatRuntimeAiNote(aiUsage = {}, elapsed = "") {
  const status = aiUsage.status || "";
  if (status === "trying") {
    return ` 正在用 AI 辅助识别字段，资料值不会发送${elapsed ? `，已等待 ${elapsed}` : ""}。`;
  }
  if (aiUsage.used && aiUsage.fallback) {
    return " AI 辅助识别了部分字段，其余已用本地规则继续。";
  }
  if (aiUsage.used) {
    return " AI 已辅助识别字段，具体填写仍在本机完成。";
  }
  if (aiUsage.fallback) {
    return " AI 不可用，已使用本地规则继续。";
  }
  if (status === "no-result" || aiUsage.attempted) {
    return " AI 没有提供可用建议，继续使用本地规则。";
  }
  return " 如果配置了 AI，会辅助识别字段；否则使用本地规则。";
}

function formatAiCompletionNote(aiUsage = {}) {
  if (aiUsage.used && aiUsage.fallback) {
    return "本次 AI 辅助识别了部分字段，其余使用本地规则完成。";
  }
  if (aiUsage.used) {
    return "本次 AI 辅助识别字段，具体填写在本机完成。";
  }
  if (aiUsage.fallback) {
    return "本次使用本地规则完成；AI 不可用。";
  }
  if (aiUsage.status === "no-result" || aiUsage.attempted) {
    return "本次 AI 没有提供可用建议，实际使用本地规则。";
  }
  return "本次使用本地规则。";
}

function getPendingCount(summary = {}) {
  return Number(summary.pending ?? Number(summary.skipped || 0) + Number(summary.failed || 0));
}

function formatElapsedTime(startedAt) {
  const start = Number(startedAt || 0);
  if (!start) {
    return "";
  }
  const seconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
  if (seconds < 1) {
    return "";
  }
  if (seconds < 60) {
    return `${seconds} 秒`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分钟`;
}

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("error", isError);
}

async function sendToActiveTab(message) {
  const [tab] = await queryTabs({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("No active tab found.");
  }

  await executeScript(tab.id, CONTENT_SCRIPT_FILES);

  try {
    return await sendTabMessage(tab.id, message);
  } catch (firstError) {
    try {
      await executeScript(tab.id, CONTENT_SCRIPT_FILES);
      return await sendTabMessage(tab.id, message);
    } catch {
      throw firstError;
    }
  }
}

function queryTabs(query) {
  return new Promise((resolve) => {
    chrome.tabs.query(query, resolve);
  });
}

function executeScript(tabId, files) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript({ target: { tabId }, files: Array.isArray(files) ? files : [files] }, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
      } else {
        resolve();
      }
    });
  });
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "Tab message failed."));
        return;
      }
      resolve(response);
    });
  });
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "Runtime message failed."));
        return;
      }
      resolve(response.data);
    });
  });
}
