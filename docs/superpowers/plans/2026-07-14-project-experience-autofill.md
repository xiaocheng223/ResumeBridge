# Project Experience Autofill Implementation Plan

**Goal:** Reliably fill project-experience sections, including common field-name variants and multiple inline project records.

**Architecture:** Keep local-first matching. Add explicit project-section classification before internship fallbacks, expand only clearly identified inline project repeaters up to the number of populated local project records, and preserve per-record mapping by visible order. Stop structural expansion immediately when an add action does not create another project form.

**Tech Stack:** Chrome Manifest V3, plain JavaScript, Node built-in tests, Playwright extension smoke testing.

---

### Task 1: Reproduce the project-section failure

- [x] Add a recruitment-form fixture using project-experience naming variants.
- [x] Seed multiple fictional project records for the fixture.
- [x] Confirm the current implementation misses or misclassifies the fields.

### Task 2: Improve project semantics

- [x] Recognize project experience, project history, research projects, and practice-project headings before internship rules.
- [x] Add aliases for project title, organization, role, description, contribution, result, type, and URL fields.
- [x] Keep project organization and role mappings distinct from internship and employment fields.

### Task 3: Support multiple inline project records

- [x] Count populated local project records without reading or sending their values.
- [x] Identify only explicit or project-scoped generic add controls inside a verified project section.
- [x] Add records up to a conservative bound and stop unless each click increases the visible project count.
- [x] Rescan after expansion and map repeated fields to the matching project occurrence.

### Task 4: Regression and browser QA

- [x] Verify all expected fields for two project records are filled locally without AI.
- [x] Verify add controls are not over-clicked and submission controls remain untouched.
- [x] Run the unit suite, syntax checks, and Edge extension smoke test.
- [x] Inspect the filled fixture screenshot and browser error log.
