const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const optionsSource = fs.readFileSync(path.join(root, "src", "options.js"), "utf8");
const sampleBackup = JSON.parse(fs.readFileSync(path.join(root, "sample-profile.json"), "utf8"));

test("exports ResumeBridge backups and accepts the legacy OpenJobAutofill marker", () => {
  assert.match(optionsSource, /PROFILE_BACKUP_FORMAT = "ResumeBridgeProfileBackup"/);
  assert.match(optionsSource, /LEGACY_PROFILE_BACKUP_FORMAT = "OpenJobAutofillProfileBackup"/);
  assert.match(optionsSource, /supportedFormats\.has\(parsed\.format\)/);
  assert.match(optionsSource, /resumebridge-profile-/);
  assert.equal(sampleBackup.format, "ResumeBridgeProfileBackup");
});

test("fork manifest does not poll the upstream release API", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

  assert.match(manifest.name, /ResumeBridge/);
  assert.equal(manifest.version, "0.1.0");
  assert.equal(manifest.permissions.includes("alarms"), false);
  assert.equal(Object.hasOwn(manifest, "host_permissions"), false);
  assert.equal(Object.hasOwn(manifest.background, "type"), false);
});
