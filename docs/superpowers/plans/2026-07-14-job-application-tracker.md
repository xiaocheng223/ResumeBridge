# Job Application Tracker Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local job-application tracker that detects company and role data from the active recruitment page, lets the user confirm it, and manages saved applications in an editable table.

**Architecture:** A shared `job-tracker.js` module owns normalization, URL privacy, status values, page-signal resolution, and duplicate fingerprints. The content script gathers page signals without sending page content to an AI; the popup presents an editable capture form; the background service worker is the only writer to local storage; a dedicated tracker extension page provides table management and CSV export.

**Tech Stack:** Chrome Manifest V3, plain JavaScript, HTML/CSS, `chrome.storage.local`, Node built-in test runner.

---

### Task 1: Shared tracker model and extraction logic

**Files:**
- Create: `src/job-tracker.js`
- Create: `tests/job-tracker.test.js`

- [x] Define application statuses, normalized record shape, safe source URL handling, and duplicate fingerprints.
- [x] Implement deterministic page-signal resolution with priority for `JobPosting` JSON-LD, semantic selectors, metadata, and title fallbacks.
- [x] Add unit tests for structured-data extraction, fallback selection, URL query removal, normalization, and fingerprints.
- [x] Run `node --test tests/job-tracker.test.js` and confirm all tests pass.

### Task 2: Trusted persistence boundary

**Files:**
- Modify: `src/background.js`
- Modify: `src/message-policy.js`
- Modify: `tests/background-boundary.test.js`
- Modify: `tests/message-policy.test.js`

- [x] Register `job-tracker.js` in the background service worker and initialize the `jobApplications` storage collection.
- [x] Add trusted messages to list, save, update, and delete tracker records.
- [x] Keep tracker history unavailable to content-script senders and preserve unrelated settings when tracker data changes.
- [x] Add boundary tests for create/update/delete, duplicate detection, sorting, and untrusted sender rejection.

### Task 3: Active-page capture flow

**Files:**
- Modify: `src/content.js`
- Modify: `src/popup.html`
- Modify: `src/popup.css`
- Modify: `src/popup.js`

- [x] Gather bounded DOM signals and expose them through `OJAF_GET_JOB_PAGE_INFO`.
- [x] Add an editable capture form for company, role, application time, status, and notes.
- [x] Require explicit confirmation before saving, retain the source site, and display duplicate/save feedback.
- [x] Add a button that opens the full tracker page.

### Task 4: Tracker table

**Files:**
- Create: `src/tracker.html`
- Create: `src/tracker.css`
- Create: `src/tracker.js`

- [x] Build summary counts, text search, status filtering, and a responsive application table.
- [x] Add inline editing and deletion with confirmation.
- [x] Export the filtered records as UTF-8 CSV with spreadsheet-safe cells.
- [x] Provide an empty state and resilient error/status feedback.

### Task 5: Integration, documentation, and QA

**Files:**
- Modify: `scripts/qa-extension-smoke.js`
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `package.json`

- [x] Include `job-tracker.js` whenever the content script is injected.
- [x] Document capture behavior, local storage, privacy boundaries, and tracker usage.
- [x] Add syntax checking for new JavaScript files.
- [x] Run `npm run verify`, inspect `git diff --check`, and review the final diff for accidental changes.
- [x] Reload the unpacked extension and confirm capture plus table management manually.
