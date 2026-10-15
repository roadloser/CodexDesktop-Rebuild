const fs = require('fs');

async function withRuntimeLock(lockPath, prepare) {
  if (fs.existsSync(lockPath)) {
    const pid = Number(fs.readFileSync(lockPath, 'utf-8'));
    let active = true;
    try { process.kill(pid, 0); } catch (error) {
      if (error.code === 'ESRCH') active = false;
    }
    if (active) throw new Error(`Another dev process (${pid}) is preparing Owl. Wait for it to finish.`);
    fs.rmSync(lockPath);
  }
  fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
  try {
    return await prepare();
  } finally {
    fs.rmSync(lockPath, { force: true });
  }
}

module.exports = { withRuntimeLock };
