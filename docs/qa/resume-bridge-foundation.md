# ResumeBridge foundation QA

Date: 2026-07-14

## Scope

This pass validates the first ResumeBridge foundation: local profile storage,
conservative fill policy, profile backup compatibility, field mapping, extension
UI layout, and the guarantee that the extension does not submit an application.

## Automated checks

Run from the repository root:

```powershell
npm run verify
```

The Node test suite covers:

- ResumeBridge and legacy OpenJobAutofill backup formats.
- Safe defaults: existing values, sensitive fields, and declarations are blocked.
- Explicit opt-in behavior for each policy category.
- Submit, file, and button controls remain blocked under every policy.
- Section-context isolation so one declaration does not contaminate the whole form.
- Runtime message authorization and API-secret redaction for content scripts.
- AI URL/value redaction before request construction.

## Browser smoke test

The Chromium extension smoke test is implemented in
`scripts/qa-extension-smoke.js`. It launches a persistent browser context, loads
the extension, opens the options page and popup, and exercises a local fixture.

Production uses `activeTab` and has no permanent localhost permission. The QA
script copies the extension to a temporary directory and adds permission only
for the local fixture origin because Playwright cannot reproduce a real toolbar
click. The repository manifest is not modified.

Validated scenarios:

| Scenario | Expected result | Result |
| --- | --- | --- |
| Default policy | Fill name and degree; keep existing email; block ID, emergency contact, and declaration | Pass |
| Sensitive opt-in | Fill ID and emergency contact; keep declaration blocked | Pass |
| Declaration opt-in | Fill the declaration answer | Pass |
| Overwrite opt-in | Replace the existing email value | Pass |
| Every scenario | Never click or submit the form | Pass, submit count remained 0 |
| AI not configured | Skip AI instead of reporting an empty attempt | Pass, status `idle`, attempted `false` |
| Quick-copy panel | Keep profile values outside page-readable light DOM | Pass, closed shadow root and zero exposed text |

Additional results:

- Desktop options page: no horizontal overflow.
- Mobile options page: no horizontal overflow.
- Popup: no horizontal overflow.
- Browser console/page errors: none.

Machine-readable output is in `output/playwright/qa-results.json`.

## Visual evidence

- `output/playwright/options-desktop.png`
- `output/playwright/options-mobile.png`
- `output/playwright/fill-policy-desktop.png`
- `output/playwright/popup.png`
- `output/playwright/fixture-default-policy.png`
- `output/playwright/fixture-opt-in-policy.png`
- `output/playwright/profile-panel-privacy.png`

## Residual risk

Recruiting sites use inconsistent labels, custom controls, nested iframes, and
dynamic validation. This smoke test proves the safety boundary and representative
mapping behavior, not compatibility with every site. Site-specific adapters and
fixture regression cases should be added as real target systems are prioritized.
