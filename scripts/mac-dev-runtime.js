const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');
const { findMacApp } = require('./find-mac-app');
const { withRuntimeLock } = require('./dev-runtime-lock');

function readPlist(app, key) {
  return execFileSync('plutil', ['-extract', key, 'raw', path.join(app, 'Contents/Info.plist')], {
    encoding: 'utf-8',
  }).trim();
}

async function prepareMacDevRuntime(projectRoot, appEntry) {
  const platformDir = path.dirname(appEntry);
  const metadataPath = path.join(platformDir, 'owl-electron-app.json');
  if (process.platform !== 'darwin' || !fs.existsSync(metadataPath)) return null;

  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  if (metadata.runtimeName !== 'owl') return null;
  const variant = os.arch() === 'arm64' ? 'arm64' : 'x64';
  const cache = path.join(os.tmpdir(), 'codex-sync', `${variant}-extract`);
  const sourceApp = fs.existsSync(cache) ? findMacApp(cache) : null;
  if (!sourceApp) throw new Error('Owl cache is missing. Run pnpm sync --skip-win first.');
  const appPackage = JSON.parse(fs.readFileSync(path.join(appEntry, 'package.json'), 'utf-8'));
  const version = appPackage.version;
  const sourceMetadata = JSON.parse(fs.readFileSync(path.join(sourceApp, 'Contents/Resources/owl-electron-app.json'), 'utf-8'));
  if (readPlist(sourceApp, 'CFBundleShortVersionString') !== version ||
      sourceMetadata.runtimeArchiveSha !== metadata.runtimeArchiveSha) {
    throw new Error('Owl cache and extracted application versions do not match. Run pnpm sync --skip-win.');
  }

  const runtimeDir = path.join(projectRoot, 'out/dev-runtime', `mac-${variant}`);
  fs.mkdirSync(runtimeDir, { recursive: true });
  return withRuntimeLock(path.join(runtimeDir, 'prepare.lock'), async () => {
  const runtimeApp = path.join(runtimeDir, 'Codex.app');
  const executable = path.join(runtimeApp, 'Contents/MacOS', readPlist(sourceApp, 'CFBundleExecutable'));
  const stampPath = path.join(runtimeDir, 'ready.json');
  const stamp = JSON.stringify({ revision: 3, version, runtime: metadata.runtimeArchiveSha });
  if (!fs.existsSync(executable) || !fs.existsSync(stampPath) || fs.readFileSync(stampPath, 'utf-8') !== stamp) {
    console.log('[start-dev] Preparing local Owl development runtime (no download)...');
    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.rmSync(stampPath, { force: true });
    fs.rmSync(runtimeApp, { recursive: true, force: true });
    // APFS copy-on-write avoids duplicating the complete 1.6 GB runtime.
    execFileSync('cp', ['-cR', sourceApp, runtimeApp]);
    const frameworkDir = path.join(runtimeApp, 'Contents/Frameworks');
    const frameworkName = fs.readdirSync(frameworkDir).find(name => name.endsWith(' Framework.framework'));
    if (!frameworkName) throw new Error('Owl framework not found in the development runtime');
    const framework = path.join(frameworkDir, frameworkName, frameworkName.replace('.framework', ''));
    // @electron/fuses assumes the standard framework name for paths containing .app.
    const stagingBinary = path.join(runtimeDir, 'framework-fuses');
    try {
      fs.copyFileSync(framework, stagingBinary);
      await flipFuses(stagingBinary, {
        version: FuseVersion.V1,
        [FuseV1Options.OnlyLoadAppFromAsar]: false,
      });
      fs.copyFileSync(stagingBinary, framework);
    } finally {
      fs.rmSync(stagingBinary, { force: true });
    }
    execFileSync('codesign', ['--sign', '-', '--force', '--deep', '--options', 'runtime',
      '--entitlements', path.join(__dirname, 'mac-dev-entitlements.plist'), runtimeApp], {
      stdio: 'inherit',
    });
    fs.writeFileSync(stampPath, stamp);
  }
  return {
    executable,
    args: [`--user-data-dir=${path.join(runtimeDir, 'profile')}`],
    env: {
      OWL_ELECTRON_SPEC_APP_ROOT: appEntry,
      BUILD_FLAVOR: process.env.BUILD_FLAVOR || appPackage.codexBuildFlavor,
      CODEX_SPARKLE_ENABLED: 'false',
    },
  };
  });
}

module.exports = { prepareMacDevRuntime };
