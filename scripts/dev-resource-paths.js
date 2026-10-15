const fs = require('fs');
const path = require('path');

function resolveDevResources(platformDir, platform) {
  function resolve(macPath, legacyPath) {
    const bundledPath = path.join(platformDir, macPath);
    return platform === 'darwin' && fs.existsSync(bundledPath)
      ? bundledPath
      : path.join(platformDir, legacyPath);
  }

  return {
    cli: resolve('codex-cli/bin/codex', platform === 'win32' ? 'codex.exe' : 'codex'),
    node: resolve('cua_node/bin/node', 'node'),
    nodeRepl: resolve('cua_node/bin/node_repl', 'node_repl'),
  };
}

module.exports = { resolveDevResources };
