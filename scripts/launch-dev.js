const { spawn } = require('child_process');
const { prepareMacDevRuntime } = require('./mac-dev-runtime');

async function launch(appEntry, options) {
  const runtime = await prepareMacDevRuntime(options.cwd, appEntry);
  const executable = runtime?.executable || require('electron');
  console.log(`[start-dev] Runtime: ${executable}`);
  const child = spawn(executable, [...(runtime?.args || []), appEntry], {
    ...options,
    env: { ...options.env, ...runtime?.env },
  });
  child.on('error', error => {
    console.error(`[start-dev] Launch failed: ${error.message}`);
    process.exitCode = 1;
  });
  child.on('close', (code, signal) => {
    if (code !== 0) console.error(`[start-dev] Runtime exited: code=${code}, signal=${signal}`);
    process.exitCode = code ?? 1;
  });
}

function launchDev(appEntry, options) {
  launch(appEntry, options).catch(error => {
    console.error(`[start-dev] ${error.stack || error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { launchDev };
