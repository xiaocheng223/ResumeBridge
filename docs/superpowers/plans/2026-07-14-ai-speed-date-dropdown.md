# AI Speed And Split Date Dropdown Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce AI-assisted autofill latency and reliably fill custom start/end year-month dropdown groups.

**Architecture:** The autofill pipeline will perform local matching first, invoke one compact AI mapping request only for unresolved or ambiguous fields, and retain local fallback. Date-range controls will be labeled by grouped position, project full profile dates into year/month values, and use exact numeric dropdown matching with virtual-list scrolling support.

**Tech Stack:** Chrome Manifest V3, plain JavaScript, Node built-in tests, Playwright browser smoke testing.

---

### Task 1: Reduce AI request count and payload

- [x] Remove the automatic pre-mapping page-structure AI request from one-click autofill.
- [x] Select only unresolved or low-confidence fields for AI mapping and bound the field count.
- [x] Limit the profile catalog to likely source entries for those fields.
- [x] Serialize AI schemas and payloads compactly while preserving privacy and prompt-injection rules.
- [x] Add regression coverage for the compact OpenAI-compatible request.

### Task 2: Recognize split date ranges

- [x] Detect grouped year/month controls by parent context and visible order.
- [x] Label four-part groups as start year, start month, end year, and end month.
- [x] Project profile values such as `2024-09` into the correct numeric component.
- [x] Preserve date-role context for local and AI mapping.

### Task 3: Fill numeric custom dropdowns reliably

- [x] Match numeric options before text normalization so `09`, `9`, and `9月` are equivalent without matching `2` to `2022`.
- [x] Open each custom dropdown only once and wait for its popup instead of toggling it closed.
- [x] Search visible and scrollable option lists, then close failed popups before continuing.
- [x] Keep native date inputs and native selects on their direct fast paths.

### Task 4: Regression and browser QA

- [x] Add a four-control year/month recruitment fixture.
- [x] Verify the fixture fills the expected start/end values using local rules.
- [x] Run the full unit suite and browser extension smoke test.
- [x] Inspect popup and fixture screenshots and confirm no browser errors or layout regressions.
