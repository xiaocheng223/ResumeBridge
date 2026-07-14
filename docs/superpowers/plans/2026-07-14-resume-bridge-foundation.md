# ResumeBridge Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the cloned OpenJobAutofill extension into a safe, independently branded ResumeBridge foundation that keeps upstream profile compatibility and gives users explicit control over sensitive autofill behavior.

**Architecture:** Keep the existing dependency-free Manifest V3 extension and its proven form scanner intact. Add a small pure safety-policy module loaded before the content script, persist fill preferences through the existing background settings boundary, and apply policy after local/AI matching but before any value is written. Keep legacy `OJAF_*` runtime identifiers and storage keys for migration compatibility while exposing only ResumeBridge branding to users.

**Tech Stack:** Chrome Extensions Manifest V3, vanilla HTML/CSS/JavaScript, Node.js built-in test runner, Playwright/Chromium for extension UI smoke tests.

---

## File Map

- `manifest.json`: ResumeBridge product metadata and least-privilege permissions.
- `src/background.js`: default fill policy, trusted storage access, settings persistence, no upstream release polling.
- `src/content.js`: load fill policy with the profile and apply it to local and AI candidate plans.
- `src/safety-policy.js`: pure risk classification and policy enforcement shared by the extension and tests.
- `src/popup.html`, `src/popup.js`, `src/popup.css`: compact ResumeBridge action surface without upstream update controls.
- `src/options.html`, `src/options.js`, `src/options.css`: ResumeBridge profile settings and explicit fill-policy controls.
- `sample-profile.json`: new backup branding while remaining structurally compatible.
- `tests/safety-policy.test.js`: policy classification and enforcement coverage.
- `tests/backup-compat.test.js`: source-level guard for accepting both new and legacy backup formats.
- `package.json`: dependency-free test and syntax-check commands.
- `README.md`, `README.en.md`, `NOTICE`: fork documentation, attribution, privacy boundaries, and development commands.

### Task 1: Establish Fork Identity and Baseline Checks

**Files:**
- Modify: `manifest.json`
- Create: `package.json`
- Create: `NOTICE`
- Modify: `README.md`
- Modify: `README.en.md`

- [ ] **Step 1: Add baseline test commands**

Create scripts using only Node built-ins:

```json
{
  "scripts": {
    "check": "node --check src/background.js && node --check src/content.js && node --check src/options.js && node --check src/popup.js && node --check src/safety-policy.js",
    "test": "node --test tests/*.test.js",
    "verify": "npm run check && npm test"
  }
}
```

- [ ] **Step 2: Run the baseline syntax check**

Run: `npm run check`

Expected: all JavaScript files parse without errors.

- [ ] **Step 3: Replace public product metadata**

Set the extension name to `ResumeBridge - 招聘表单智能补全`, reset the fork version to `0.1.0`, remove the upstream homepage URL, and remove `alarms` plus the GitHub API host permission.

- [ ] **Step 4: Document provenance and development state**

Keep the upstream MIT license unchanged, add `NOTICE` naming OpenJobAutofill as the foundation, and rewrite both READMEs around ResumeBridge's current capabilities and safety model.

### Task 2: Add a Tested Safety Policy

**Files:**
- Create: `src/safety-policy.js`
- Create: `tests/safety-policy.test.js`

- [ ] **Step 1: Write failing classification tests**

Cover these behaviors:

```js
assert.equal(classifyCandidate({ fieldLabel: "姓名" }).risk, "standard");
assert.equal(classifyCandidate({ fieldLabel: "身份证号码" }).risk, "sensitive");
assert.equal(classifyCandidate({ sourceCategory: "家庭信息" }).risk, "sensitive");
assert.equal(classifyCandidate({ sourceCategory: "有关声明" }).risk, "declaration");
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm test`

Expected: FAIL because `src/safety-policy.js` does not exist.

- [ ] **Step 3: Implement the pure policy module**

Expose:

```js
{
  DEFAULT_FILL_POLICY,
  normalizeFillPolicy,
  classifyCandidate,
  applyPolicyToCandidate,
  applyPolicyToPlan
}
```

Default behavior must skip fields with existing values, sensitive identity/family/contact data, and declarations. Skipped candidates remain visible as pending with a concrete policy reason.

- [ ] **Step 4: Add overwrite and opt-in tests**

Verify that each policy switch only unlocks its own category and that file uploads/final-submit controls can never become autofill candidates.

- [ ] **Step 5: Run tests**

Run: `npm test`

Expected: all policy tests pass.

### Task 3: Persist and Apply Fill Preferences

**Files:**
- Modify: `src/background.js`
- Modify: `src/content.js`
- Modify: `src/popup.js`

- [ ] **Step 1: Add `fillPolicy` to background settings**

Store normalized policy under the existing extension storage boundary, return it from `OJAF_GET_SETTINGS`, and preserve it when profile or API settings are saved independently.

- [ ] **Step 2: Restrict storage access**

Call `chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })` when supported so injected page scripts cannot read the profile store directly. Continue passing only required data through runtime messages.

- [ ] **Step 3: Remove upstream release polling**

Delete the alarm and GitHub release handlers so the fork no longer contacts or reports updates from `Br1an67/OpenJobAutofill`.

- [ ] **Step 4: Inject safety policy before the content script**

Change popup injection to:

```js
files: ["src/safety-policy.js", "src/content.js"]
```

- [ ] **Step 5: Apply policy after every plan merge**

Load `fillPolicy` alongside `profileV2`, apply it to local plans and AI-first plans, rebuild `autoFillIds`, and expose skip reasons in the existing pending-field UI and debug snapshot.

- [ ] **Step 6: Run syntax and unit tests**

Run: `npm run verify`

Expected: PASS.

### Task 4: Build ResumeBridge Settings and Popup UX

**Files:**
- Modify: `src/popup.html`
- Modify: `src/popup.js`
- Modify: `src/popup.css`
- Modify: `src/options.html`
- Modify: `src/options.js`
- Modify: `src/options.css`

- [ ] **Step 1: Replace upstream branding and links**

Use the user-facing name `履历桥 ResumeBridge` and tagline `一份履历，连接不同招聘系统`. Keep internal message IDs unchanged.

- [ ] **Step 2: Remove update controls**

Remove update status panels, listeners, and related formatting functions from popup and options pages.

- [ ] **Step 3: Add fill-policy controls**

Add checkboxes for:

```text
覆盖网页已有内容
自动填写证件、家庭与紧急联系人等敏感字段
自动填写声明、背景调查与合规问答
```

Each control must explain its effect without implying that local storage is encrypted.

- [ ] **Step 4: Save policy independently**

Track dirty state, save only `fillPolicy`, and confirm persistence without resaving the profile or API key.

- [ ] **Step 5: Restyle as a restrained work tool**

Remove gradients and decorative blobs, use neutral surfaces, 6-8px radii, stable button dimensions, accessible focus styles, and responsive columns without nested card decoration.

- [ ] **Step 6: Check small and large layouts**

Verify popup at 390px width and options at 390px, 768px, and 1440px without clipped labels or overlapping controls.

### Task 5: Preserve Backup Compatibility

**Files:**
- Modify: `src/options.js`
- Modify: `sample-profile.json`
- Create: `tests/backup-compat.test.js`

- [ ] **Step 1: Write a failing compatibility guard**

Assert that source declares both:

```js
"ResumeBridgeProfileBackup"
"OpenJobAutofillProfileBackup"
```

- [ ] **Step 2: Export the new format**

Use `ResumeBridgeProfileBackup` and filenames beginning with `resumebridge-profile-`.

- [ ] **Step 3: Accept legacy backups**

Import both ResumeBridge and OpenJobAutofill formats and show a clear error for unrelated JSON.

- [ ] **Step 4: Update sample data and run tests**

Run: `npm run verify`

Expected: all syntax, policy, and compatibility checks pass.

### Task 6: Browser Verification

**Files:**
- Create: `tests/fixtures/job-form.html`
- Create or update: `docs/qa/resume-bridge-foundation.md`

- [ ] **Step 1: Create a deterministic recruitment form fixture**

Include ordinary text, an existing value, an ID field, a family field, a declaration radio group, a select, and a submit button. The submit handler must record accidental submissions for assertion.

- [ ] **Step 2: Load the unpacked extension in Chromium**

Open the options page and fixture with `D:\ResumeBridge` loaded as the extension directory.

- [ ] **Step 3: Verify default policy**

Confirm ordinary fields fill while existing, sensitive, and declaration fields remain pending and the submit handler is never invoked.

- [ ] **Step 4: Verify explicit opt-ins**

Enable each setting separately and confirm only the expected category becomes eligible.

- [ ] **Step 5: Capture desktop and narrow screenshots**

Record viewport, visible defects, and the final pass/fail result in `docs/qa/resume-bridge-foundation.md`.

- [ ] **Step 6: Final verification**

Run: `npm run verify`

Expected: PASS with a clean `git status` except intentional implementation files.
