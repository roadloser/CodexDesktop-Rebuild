const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function findMacApp(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.name.endsWith(".app")) {
      const plist = path.join(fullPath, "Contents", "Info.plist");
      if (!fs.existsSync(plist)) continue;
      const bundleId = execFileSync("plutil", ["-extract", "CFBundleIdentifier", "raw", plist], {
        encoding: "utf-8",
      }).trim();
      if (bundleId === "com.openai.codex") return fullPath;
      continue;
    }
    const found = findMacApp(fullPath);
    if (found) return found;
  }
  return null;
}

module.exports = { findMacApp };
