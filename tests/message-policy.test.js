const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isTrustedExtensionPage,
  canHandleRuntimeMessage
} = require("../src/message-policy.js");

const context = {
  runtimeId: "resume-bridge-id",
  extensionBaseUrl: "chrome-extension://resume-bridge-id/"
};

test("recognizes only pages owned by the current extension as trusted", () => {
  assert.equal(
    isTrustedExtensionPage(
      { id: "resume-bridge-id", url: "chrome-extension://resume-bridge-id/src/options.html" },
      context
    ),
    true
  );
  assert.equal(
    isTrustedExtensionPage(
      { id: "resume-bridge-id", url: "https://jobs.example.com/apply" },
      context
    ),
    false
  );
  assert.equal(
    isTrustedExtensionPage(
      { id: "another-extension", url: "chrome-extension://resume-bridge-id/src/options.html" },
      context
    ),
    false
  );
});

test("blocks settings mutations from content-script senders", () => {
  const contentSender = {
    id: "resume-bridge-id",
    url: "https://jobs.example.com/apply"
  };

  for (const type of [
    "OJAF_SAVE_SETTINGS",
    "OJAF_CLEAR_SETTINGS",
    "OJAF_LIST_MODELS",
    "OJAF_TEST_CONNECTION",
    "OJAF_GET_JOB_APPLICATIONS",
    "OJAF_SAVE_JOB_APPLICATION",
    "OJAF_DELETE_JOB_APPLICATION",
    "OJAF_CLEAR_JOB_APPLICATIONS"
  ]) {
    assert.equal(canHandleRuntimeMessage(type, contentSender, context), false, type);
  }

  assert.equal(canHandleRuntimeMessage("OJAF_GET_SETTINGS", contentSender, context), true);
  assert.equal(canHandleRuntimeMessage("OJAF_MAP_FIELDS", contentSender, context), true);
});
