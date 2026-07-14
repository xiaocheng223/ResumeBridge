const trackerApi = globalThis.ResumeBridgeJobTracker;

const els = {
  addApplication: document.getElementById("addApplication"),
  refreshApplications: document.getElementById("refreshApplications"),
  exportApplications: document.getElementById("exportApplications"),
  clearApplications: document.getElementById("clearApplications"),
  applicationSearch: document.getElementById("applicationSearch"),
  applicationStatusFilter: document.getElementById("applicationStatusFilter"),
  applicationRows: document.getElementById("applicationRows"),
  emptyState: document.getElementById("emptyState"),
  resultCount: document.getElementById("resultCount"),
  trackerFeedback: document.getElementById("trackerFeedback"),
  metricTotal: document.getElementById("metricTotal"),
  metricThisMonth: document.getElementById("metricThisMonth"),
  metricActive: document.getElementById("metricActive"),
  metricOffers: document.getElementById("metricOffers")
};

let applications = [];
let editingId = "";

els.addApplication.addEventListener("click", () => {
  editingId = "__new__";
  render();
  document.querySelector('[data-application-id="__new__"] [data-field="companyName"]')?.focus();
});
els.refreshApplications.addEventListener("click", () => void loadApplications());
els.exportApplications.addEventListener("click", exportCsv);
els.clearApplications.addEventListener("click", () => void clearApplications());
els.applicationSearch.addEventListener("input", render);
els.applicationStatusFilter.addEventListener("change", render);
els.applicationRows.addEventListener("click", handleRowAction);

void loadApplications();

async function loadApplications(options = {}) {
  if (!trackerApi?.normalizeJobApplications) {
    setFeedback("投递追踪模块加载失败，请重新加载扩展。", "error");
    return;
  }

  if (!options.silent) {
    setFeedback("正在读取本地投递记录...");
  }
  try {
    const result = await sendRuntimeMessage({ type: "OJAF_GET_JOB_APPLICATIONS" });
    applications = trackerApi.normalizeJobApplications(result.applications);
    render();
    if (!options.silent) {
      setFeedback(`已加载 ${applications.length} 条本地记录。`);
    }
  } catch (error) {
    setFeedback(`读取失败：${error.message}`, "error");
  }
}

function render() {
  const filtered = getFilteredApplications();
  const rows = [];

  if (editingId === "__new__") {
    rows.push(renderEditRow({
      id: "__new__",
      companyName: "",
      jobTitle: "",
      appliedAt: new Date().toISOString(),
      status: "已投递",
      notes: "",
      sourceUrl: "",
      sourceSite: ""
    }));
  }

  for (const application of filtered) {
    rows.push(editingId === application.id ? renderEditRow(application) : renderReadRow(application));
  }

  els.applicationRows.innerHTML = rows.join("");
  els.emptyState.hidden = rows.length > 0;
  els.resultCount.textContent = `显示 ${filtered.length} 条记录${filtered.length !== applications.length ? `，共 ${applications.length} 条` : ""}`;
  renderMetrics();
}

function renderMetrics() {
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  els.metricTotal.textContent = String(applications.length);
  els.metricThisMonth.textContent = String(
    applications.filter((application) => toLocalDateKey(application.appliedAt).startsWith(monthPrefix)).length
  );
  els.metricActive.textContent = String(
    applications.filter((application) => ["笔试", "面试"].includes(application.status)).length
  );
  els.metricOffers.textContent = String(
    applications.filter((application) => application.status === "Offer").length
  );
}

function renderReadRow(application) {
  const source = application.sourceUrl
    ? `<a class="cell-secondary" href="${escapeAttribute(application.sourceUrl)}" target="_blank" rel="noreferrer noopener">${escapeHtml(application.sourceSite || "打开来源页面")}</a>`
    : `<span class="cell-secondary">${escapeHtml(application.sourceSite || "手动记录")}</span>`;

  return `
    <tr data-application-id="${escapeAttribute(application.id)}">
      <td data-label="公司">
        <strong class="cell-primary">${escapeHtml(application.companyName)}</strong>
        ${source}
      </td>
      <td data-label="申请职位"><span class="cell-primary">${escapeHtml(application.jobTitle)}</span></td>
      <td data-label="投递时间"><span class="date-cell">${escapeHtml(formatDateTime(application.appliedAt))}</span></td>
      <td data-label="状态"><span class="status-badge ${statusClass(application.status)}">${escapeHtml(application.status)}</span></td>
      <td data-label="备注"><span class="notes-cell">${escapeHtml(application.notes || "-")}</span></td>
      <td data-label="操作">
        <div class="row-actions">
          <button class="secondary small" type="button" data-action="edit">编辑</button>
          <button class="danger small" type="button" data-action="delete">删除</button>
        </div>
      </td>
    </tr>`;
}

function renderEditRow(application) {
  const statusOptions = trackerApi.JOB_APPLICATION_STATUSES.map(
    (status) => `<option value="${escapeAttribute(status)}"${status === application.status ? " selected" : ""}>${escapeHtml(status)}</option>`
  ).join("");

  return `
    <tr data-application-id="${escapeAttribute(application.id)}">
      <td data-label="公司">
        <input class="cell-input" data-field="companyName" type="text" maxlength="180" value="${escapeAttribute(application.companyName)}" aria-label="公司名称" />
        <span class="cell-secondary">${escapeHtml(application.sourceSite || (application.id === "__new__" ? "手动新增" : "本地记录"))}</span>
      </td>
      <td data-label="申请职位"><input class="cell-input" data-field="jobTitle" type="text" maxlength="240" value="${escapeAttribute(application.jobTitle)}" aria-label="申请职位" /></td>
      <td data-label="投递时间"><input class="cell-input" data-field="appliedAt" type="datetime-local" value="${escapeAttribute(toLocalDateTimeInput(application.appliedAt))}" aria-label="投递时间" /></td>
      <td data-label="状态"><select class="cell-select" data-field="status" aria-label="投递状态">${statusOptions}</select></td>
      <td data-label="备注"><textarea class="cell-notes" data-field="notes" maxlength="4000" aria-label="备注">${escapeHtml(application.notes)}</textarea></td>
      <td data-label="操作">
        <div class="row-actions">
          <button class="small" type="button" data-action="save">保存</button>
          <button class="secondary small" type="button" data-action="cancel">取消</button>
        </div>
      </td>
    </tr>`;
}

function handleRowAction(event) {
  const button = event.target.closest("[data-action]");
  const row = button?.closest("[data-application-id]");
  if (!button || !row) {
    return;
  }

  const id = row.dataset.applicationId || "";
  switch (button.dataset.action) {
    case "edit":
      editingId = id;
      render();
      break;
    case "cancel":
      editingId = "";
      render();
      break;
    case "save":
      void saveEditedApplication(row, id, button);
      break;
    case "delete":
      void deleteApplication(id);
      break;
    default:
      break;
  }
}

async function saveEditedApplication(row, id, button) {
  const companyName = row.querySelector('[data-field="companyName"]')?.value.trim() || "";
  const jobTitle = row.querySelector('[data-field="jobTitle"]')?.value.trim() || "";
  const appliedAtValue = row.querySelector('[data-field="appliedAt"]')?.value || "";
  const status = row.querySelector('[data-field="status"]')?.value || "已投递";
  const notes = row.querySelector('[data-field="notes"]')?.value || "";
  const appliedAtDate = new Date(appliedAtValue);

  if (!companyName || !jobTitle) {
    setFeedback("公司名称和申请职位不能为空。", "error");
    (!companyName
      ? row.querySelector('[data-field="companyName"]')
      : row.querySelector('[data-field="jobTitle"]'))?.focus();
    return;
  }
  if (Number.isNaN(appliedAtDate.getTime())) {
    setFeedback("请选择有效的投递时间。", "error");
    row.querySelector('[data-field="appliedAt"]')?.focus();
    return;
  }

  const existing = applications.find((application) => application.id === id);
  button.disabled = true;
  try {
    const result = await sendRuntimeMessage({
      type: "OJAF_SAVE_JOB_APPLICATION",
      payload: {
        application: {
          ...(existing || {}),
          ...(id === "__new__" ? {} : { id }),
          companyName,
          jobTitle,
          appliedAt: appliedAtDate.toISOString(),
          status,
          notes
        }
      }
    });
    editingId = "";
    await loadApplications({ silent: true });
    setFeedback(
      result.duplicate ? "相同公司、职位和日期的记录已存在，未重复添加。" : "投递记录已保存。",
      result.duplicate ? "" : "success"
    );
  } catch (error) {
    setFeedback(`保存失败：${error.message}`, "error");
    button.disabled = false;
  }
}

async function deleteApplication(id) {
  const application = applications.find((item) => item.id === id);
  if (!application) {
    return;
  }
  if (!window.confirm(`删除“${application.companyName} / ${application.jobTitle}”的投递记录？`)) {
    return;
  }

  try {
    await sendRuntimeMessage({ type: "OJAF_DELETE_JOB_APPLICATION", payload: { id } });
    applications = applications.filter((item) => item.id !== id);
    if (editingId === id) {
      editingId = "";
    }
    render();
    setFeedback("投递记录已删除。", "success");
  } catch (error) {
    setFeedback(`删除失败：${error.message}`, "error");
  }
}

async function clearApplications() {
  if (applications.length === 0) {
    setFeedback("当前没有可清空的投递记录。");
    return;
  }
  if (!window.confirm(`将永久删除当前浏览器中的 ${applications.length} 条投递记录。是否继续？`)) {
    return;
  }

  try {
    await sendRuntimeMessage({ type: "OJAF_CLEAR_JOB_APPLICATIONS" });
    applications = [];
    editingId = "";
    render();
    setFeedback("本地投递记录已清空。", "success");
  } catch (error) {
    setFeedback(`清空失败：${error.message}`, "error");
  }
}

function getFilteredApplications() {
  const query = els.applicationSearch.value.trim().toLocaleLowerCase();
  const status = els.applicationStatusFilter.value;
  return applications.filter((application) => {
    if (status && application.status !== status) {
      return false;
    }
    if (!query) {
      return true;
    }
    return [
      application.companyName,
      application.jobTitle,
      application.notes,
      application.sourceSite
    ].some((value) => String(value || "").toLocaleLowerCase().includes(query));
  });
}

function exportCsv() {
  const filtered = getFilteredApplications();
  if (filtered.length === 0) {
    setFeedback("当前筛选条件下没有可导出的记录。", "error");
    return;
  }

  const headers = ["公司名称", "申请职位", "投递时间", "投递状态", "备注", "来源网站", "来源页面"];
  const rows = filtered.map((application) => [
    application.companyName,
    application.jobTitle,
    formatDateTime(application.appliedAt),
    application.status,
    application.notes,
    application.sourceSite,
    application.sourceUrl
  ]);
  const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(toCsvCell).join(",")).join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `resumebridge-applications-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setFeedback(`已导出 ${filtered.length} 条记录。`, "success");
}

function toCsvCell(value) {
  let text = String(value == null ? "" : value).replace(/\r\n?/g, "\n");
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

function statusClass(status) {
  if (["笔试", "面试"].includes(status)) {
    return "active";
  }
  if (status === "Offer") {
    return "offer";
  }
  if (status === "待投递") {
    return "pending";
  }
  if (["已拒绝", "已撤回"].includes(status)) {
    return "closed";
  }
  return "";
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function toLocalDateTimeInput(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toLocalDateKey(value) {
  return toLocalDateTimeInput(value).slice(0, 10);
}

function setFeedback(message, state = "") {
  els.trackerFeedback.textContent = message;
  els.trackerFeedback.classList.toggle("success", state === "success");
  els.trackerFeedback.classList.toggle("error", state === "error");
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

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
