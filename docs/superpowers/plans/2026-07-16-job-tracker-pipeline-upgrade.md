# Job Tracker Pipeline Upgrade Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade ResumeBridge's local application tracker with a compatible hiring pipeline, channel and status-page metadata, reliable CSV import/export, and faster status management.

**Architecture:** Keep `job-tracker.js` as the pure shared domain module and the background service worker as the only writer to `chrome.storage.local`. Extension pages parse local CSV data, but bulk persistence remains behind the trusted runtime-message boundary. Existing records are normalized lazily, so users do not need a destructive migration.

**Tech Stack:** Chrome Manifest V3, plain JavaScript, HTML/CSS, `chrome.storage.local`, Node built-in test runner.

---

### Task 1: Extend the shared tracker domain model

**Files:**
- Modify: `src/job-tracker.js`
- Modify: `tests/job-tracker.test.js`

- [x] Add backward-compatible pipeline statuses, status tones, ranks, and aliases.
- [x] Add `channel`, `statusUrl`, and `statusUpdatedAt` normalization.
- [x] Add deterministic sorting modes and channel inference.
- [x] Add RFC 4180-style CSV parsing, compatible headers, safe export, and import deduplication helpers.
- [x] Run `node --test tests/job-tracker.test.js`.

### Task 2: Add a trusted bulk-import boundary

**Files:**
- Modify: `src/background.js`
- Modify: `src/message-policy.js`
- Modify: `tests/background-boundary.test.js`
- Modify: `tests/message-policy.test.js`

- [x] Add a privileged `OJAF_IMPORT_JOB_APPLICATIONS` message.
- [x] Assign IDs in the service worker, validate required fields, cap storage, and return import/skip/error counts.
- [x] Update `statusUpdatedAt` automatically when a saved record changes pipeline status.
- [x] Verify that content scripts cannot read or mutate tracker history.

### Task 3: Upgrade capture and tracker interfaces

**Files:**
- Modify: `src/popup.html`
- Modify: `src/popup.js`
- Modify: `src/tracker.html`
- Modify: `src/tracker.css`
- Modify: `src/tracker.js`

- [x] Populate status controls from the shared model and capture the inferred application channel.
- [x] Show channel and status-page links without adding new table columns.
- [x] Add sorting, CSV import, and inline status updates with visible status-update dates.
- [x] Preserve mobile table behavior and keyboard-accessible controls.

### Task 4: Documentation and verification

**Files:**
- Modify: `README.md`
- Modify: `README.en.md`

- [x] Document the expanded tracker workflow, local-only import/export, and compatibility behavior.
- [x] Run `npm run verify` and `git diff --check`.
- [x] Run extension-page smoke checks or report any local browser-runtime limitation.
