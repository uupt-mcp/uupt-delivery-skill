#!/usr/bin/env node

/**
 * skill 自更新脚本（静默自动更新，业务脚本检测到新版本时在后台自动调用）
 * 用法:
 *   检查并更新:   node self-update.js
 *   仅检查:       node self-update.js --check
 *   强制重装:     node self-update.js --force
 *
 * 流程: 获取最新版本信息 -> 下载 zip -> 解压校验 -> 备份当前版本 -> 覆盖安装 -> npm install
 * 失败时自动从备份还原。用户配置 (~/.uupt-delivery/config.json) 不受影响。
 */

// 自更新过程中禁用 index.js 的 beforeExit 更新检测，避免重复触发
process.env.UUPT_SKIP_UPDATE_CHECK = '1';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const axios = require('axios');
const {
  CONFIG_DIR,
  UPDATE_DEFAULT_ZIP_URL,
  getCurrentVersion,
  compareVersions,
  readUpdateCache,
  writeUpdateCache,
  fetchLatestInfo
} = require('../index');

const SKILL_DIR = path.resolve(__dirname, '..');

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg === '--check') args.check = true;
    if (arg === '--force') args.force = true;
  });
  return args;
}

/**
 * 递归复制目录，排除顶层的指定目录（如 node_modules）
 */
function copyDir(src, dest, excludeTopDirs = []) {
  fs.cpSync(src, dest, {
    recursive: true,
    filter: (source) => {
      const rel = path.relative(src, source);
      if (!rel) return true;
      const top = rel.split(path.sep)[0];
      return !excludeTopDirs.includes(top);
    }
  });
}

function printUpdateFailed(reason) {
  console.log('\n[UPDATE_FAILED]');
  console.log(`REASON=${reason}`);
  console.log(`\n💡 可手动下载最新安装包重新安装: ${UPDATE_DEFAULT_ZIP_URL}`);
  console.log(`   解压覆盖到 skill 目录 (${SKILL_DIR}) 后执行 npm install 即可。`);
}

async function main() {
  const args = parseArgs();

  const current = getCurrentVersion();
  console.log(`📌 当前版本: ${current}`);

  // 1. 获取最新版本信息
  console.log('🔄 正在获取最新版本信息...');
  let latest;
  try {
    latest = await fetchLatestInfo(10000);
  } catch (error) {
    printUpdateFailed(`获取最新版本信息失败: ${error.message}`);
    process.exit(1);
  }
  console.log(`📌 最新版本: ${latest.version}`);

  if (compareVersions(latest.version, current) <= 0 && !args.force) {
    console.log('\n[ALREADY_LATEST]');
    console.log('当前已是最新版本，无需更新。');
    return;
  }

  if (args.check) {
    console.log('\n[UPDATE_AVAILABLE]');
    console.log(`CURRENT_VERSION=${current}`);
    console.log(`LATEST_VERSION=${latest.version}`);
    if (latest.notes) console.log(`RELEASE_NOTES=${String(latest.notes).replace(/\r?\n/g, ' ')}`);
    console.log('UPDATE_COMMAND=node scripts/self-update.js');
    return;
  }

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'uupt-skill-update-'));

  try {
    // 2. 下载安装包
    console.log(`⬇️ 正在下载新版本: ${latest.zipUrl}`);
    const zipFile = path.join(tmpRoot, 'skill.zip');
    const response = await axios.get(latest.zipUrl, { responseType: 'arraybuffer', timeout: 120000 });
    fs.writeFileSync(zipFile, Buffer.from(response.data));

    // 3. 解压
    console.log('📦 正在解压...');
    const AdmZip = require('adm-zip');
    const extractDir = path.join(tmpRoot, 'extracted');
    new AdmZip(zipFile).extractAllTo(extractDir, true);

    // 定位 skill 根目录（兼容 zip 内多包一层目录的情况）
    let newRoot = extractDir;
    if (!fs.existsSync(path.join(newRoot, 'SKILL.md'))) {
      const subDirs = fs.readdirSync(newRoot).filter(name =>
        fs.statSync(path.join(newRoot, name)).isDirectory()
      );
      if (subDirs.length === 1 && fs.existsSync(path.join(newRoot, subDirs[0], 'SKILL.md'))) {
        newRoot = path.join(newRoot, subDirs[0]);
      } else {
        throw new Error('安装包结构异常: 未找到 SKILL.md');
      }
    }

    // 4. 校验新版本号
    let newVersion;
    try {
      newVersion = JSON.parse(fs.readFileSync(path.join(newRoot, 'package.json'), 'utf8')).version;
    } catch (error) {
      throw new Error('安装包结构异常: 无法读取 package.json 版本号');
    }

    // 5. 备份当前版本（排除 node_modules）
    const backupDir = path.join(CONFIG_DIR, 'backup', current);
    console.log(`💾 正在备份当前版本到: ${backupDir}`);
    fs.rmSync(backupDir, { recursive: true, force: true });
    copyDir(SKILL_DIR, backupDir, ['node_modules']);

    // 6. 覆盖安装，失败时从备份还原
    console.log('🔁 正在覆盖安装新版本...');
    try {
      copyDir(newRoot, SKILL_DIR, ['node_modules']);
    } catch (error) {
      console.error('❌ 覆盖文件失败，正在从备份还原...');
      copyDir(backupDir, SKILL_DIR, []);
      throw new Error(`覆盖文件失败（已还原旧版本）: ${error.message}`);
    }

    // 7. 更新依赖
    console.log('📦 正在安装依赖 (npm install)...');
    const npmResult = spawnSync('npm install --no-audit --no-fund', {
      cwd: SKILL_DIR,
      shell: true,
      stdio: 'inherit',
      timeout: 300000
    });

    // 8. 刷新更新检测缓存，避免更新后仍触发旧信息
    const now = Date.now();
    writeUpdateCache({
      ...readUpdateCache(),
      lastCheck: now,
      lastUpdateAttempt: now,
      latestVersion: latest.version,
      zipUrl: latest.zipUrl,
      notes: latest.notes
    });

    console.log('\n[UPDATE_SUCCESS]');
    console.log(`VERSION=${newVersion}`);
    console.log(`SKILL_FILE=${path.join(SKILL_DIR, 'SKILL.md')}`);
    console.log(`✅ skill 已更新到 ${newVersion}，用户配置不受影响，无需重新注册。`);
    console.log('提示: 新版脚本对后续命令立即生效。Agent 请重新读取上方 SKILL_FILE 指向的 SKILL.md，本会话后续操作按新版使用说明执行。');

    if (npmResult.status !== 0) {
      console.log('\n[UPDATE_DEPS_FAILED]');
      console.log(`⚠️ 代码已更新成功，但依赖安装失败，请在 skill 目录手动执行 npm install: ${SKILL_DIR}`);
    }
  } catch (error) {
    printUpdateFailed(error.message);
    process.exit(1);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

main();
