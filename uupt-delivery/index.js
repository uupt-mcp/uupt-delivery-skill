const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');

// 配置文件保存在用户主目录，不受 skill 更新/重装影响，且始终可写
const CONFIG_DIR = path.join(os.homedir(), '.uupt-delivery');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const DEFAULTS_FILE = path.join(__dirname, 'defaults.json');

/**
 * 读取配置文件
 */
function readConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('读取配置文件失败:', error.message);
  }
  return {};
}

/**
 * 读取预制默认配置
 */
function readDefaults() {
  try {
    if (fs.existsSync(DEFAULTS_FILE)) {
      const data = fs.readFileSync(DEFAULTS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('读取默认配置失败:', error.message);
  }
  return {};
}

/**
 * 保存配置文件（合并写入）
 */
function saveConfig(config) {
  try {
    const existing = readConfig();
    const merged = { ...existing, ...config };
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf8');
    console.log('配置已保存到:', CONFIG_FILE);
    return true;
  } catch (error) {
    console.error('保存配置文件失败:', error.message);
    return false;
  }
}

/**
 * 获取配置（优先级：环境变量 > config.json > defaults.json）
 */
function getConfig() {
  const defaults = readDefaults();
  const config = readConfig();
  
  return {
    appId: process.env.UUPT_APP_ID || config.appId || defaults.appId || null,
    appSecret: process.env.UUPT_APP_SECRET || config.appSecret || defaults.appSecret || null,
    openId: process.env.UUPT_OPEN_ID || config.openId || defaults.openId || null,
    apiUrl: process.env.UUPT_API_URL || config.apiUrl || defaults.apiUrl || 'https://api-open.uupt.com/openapi/v3/'
  };
}

/**
 * 检查并确保配置完整
 */
function ensureConfig() {
  const config = getConfig();
  
  if (!config.appId || !config.appSecret) {
    console.log('\n[FATAL] 缺少应用凭证，请确认 defaults.json 文件完整');
    throw new Error('[FATAL] 缺少应用凭证 (appId/appSecret)，请确认 defaults.json 文件存在且内容完整');
  }
  
  if (!config.openId) {
    console.log('\n[REGISTRATION_REQUIRED]');
    console.log('尚未注册，请先完成手机号验证获取授权。');
    console.log('请运行注册脚本: node scripts/register.js --mobile="您的手机号"');
    throw new Error('[REGISTRATION_REQUIRED] 尚未注册，请先完成手机号验证获取授权');
  }
  
  return config;
}

/**
 * 生成 MD5 签名
 */
function generateMd5(input) {
  return crypto.createHash('md5').update(input, 'utf8').digest('hex').toUpperCase();
}

/**
 * 发送 API 请求（需要 openId 的业务接口）
 */
async function postRequest(bizParams, apiPath) {
  const config = ensureConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const bizJson = JSON.stringify(bizParams);
  
  const signStr = bizJson + config.appSecret + timestamp;
  const sign = generateMd5(signStr);
  
  const payload = {
    openId: config.openId,
    timestamp: timestamp,
    biz: bizJson,
    sign: sign
  };
  
  const url = config.apiUrl + apiPath;
  
  try {
    console.log(`🔄 正在请求: ${apiPath}...`);
    
    const response = await axios.post(url, payload, {
      headers: {
        'X-App-Id': config.appId,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status === 200) {
      console.log('✅ 请求成功\n');
      return response.data;
    } else {
      console.error('❌ 请求失败:', response.status);
      return null;
    }
  } catch (error) {
    console.error('❌ 请求异常:', error.message);
    return null;
  }
}

/**
 * 发送无需 openId 的 API 请求（用于注册/授权接口）
 */
async function postUnauthorizedRequest(bizParams, apiPath) {
  const config = getConfig();
  
  if (!config.appId || !config.appSecret) {
    throw new Error('[FATAL] 缺少应用凭证 (appId/appSecret)，请确认 defaults.json 文件存在且内容完整');
  }
  
  const timestamp = Math.floor(Date.now() / 1000);
  const bizJson = JSON.stringify(bizParams);
  
  const signStr = bizJson + config.appSecret + timestamp;
  const sign = generateMd5(signStr);
  
  const payload = {
    timestamp: timestamp,
    biz: bizJson,
    sign: sign
  };
  
  const url = config.apiUrl + apiPath;
  
  try {
    console.log(`🔄 正在请求: ${apiPath}...`);
    
    const response = await axios.post(url, payload, {
      headers: {
        'X-App-Id': config.appId,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status === 200) {
      console.log('✅ 请求成功\n');
      return response.data;
    } else {
      console.error('❌ 请求失败:', response.status);
      return null;
    }
  } catch (error) {
    console.error('❌ 请求异常:', error.message);
    return null;
  }
}

/**
 * 获取用户公网 IP
 * 使用多个备用服务，提高成功率
 */
async function getPublicIp() {
  const ipServices = [
    { url: 'https://httpbin.org/ip', extract: (data) => data.origin },
    { url: 'https://ipinfo.io/json', extract: (data) => data.ip },
    { url: 'https://api64.ipify.org?format=json', extract: (data) => data.ip },
    { url: 'https://api.ipify.org?format=json', extract: (data) => data.ip }
  ];

  for (const service of ipServices) {
    try {
      const response = await axios.get(service.url, { timeout: 5000 });
      const ip = service.extract(response.data);
      if (ip) {
        // 处理可能的逗号分隔的多个IP
        const cleanIp = ip.split(',')[0].trim();
        return cleanIp;
      }
    } catch (error) {
      console.log(`[IP查询] ${service.url} 失败: ${error.message}`);
      continue;
    }
  }

  console.error('[错误] 所有IP查询服务均不可用');
  return '';
}

/**
 * 发送短信验证码
 * @param {Object} params
 * @param {string} params.userMobile - 用户手机号（必填）
 * @param {string} params.userIp - 用户公网 IP（必填）
 * @param {string} params.imageCode - 图片验证码（可选）
 */
async function sendSmsCode(params) {
  const { userMobile, userIp, imageCode } = params;
  
  if (!userMobile) {
    throw new Error('手机号为必填项');
  }
  if (!userIp) {
    throw new Error('用户公网 IP 为必填项');
  }
  
  const biz = {
    userMobile: userMobile,
    userIp: userIp,
    imageCode: imageCode || ''
  };
  
  console.log('📱 正在发送短信验证码...');
  return await postUnauthorizedRequest(biz, 'user/unauthorized/sendSmsCode');
}

/**
 * 商户授权（获取 openId）
 * @param {Object} params
 * @param {string} params.userMobile - 用户手机号（必填）
 * @param {string} params.userIp - 用户公网 IP（必填）
 * @param {string} params.smsCode - 短信验证码（必填）
 */
async function auth(params) {
  const { userMobile, userIp, smsCode } = params;
  
  if (!userMobile) {
    throw new Error('手机号为必填项');
  }
  if (!userIp) {
    throw new Error('用户公网 IP 为必填项');
  }
  if (!smsCode) {
    throw new Error('短信验证码为必填项');
  }
  
  const biz = {
    userMobile: userMobile,
    userIp: userIp,
    smsCode: smsCode,
    cityName: '郑州市',
    countyName: ''
  };
  
  console.log('🔐 正在进行商户授权...');
  const result = await postUnauthorizedRequest(biz, 'user/unauthorized/auth');
  
  if (result && result.body && result.body.openId) {
    result.configSaved = saveConfig({ openId: result.body.openId });
    if (result.configSaved) {
      console.log('✅ 授权成功，openId 已保存');
    } else {
      console.error('⚠️ 授权成功，但 openId 保存失败');
    }
  }
  
  return result;
}

/**
 * 订单询价
 * @param {Object} params - 询价参数
 * @param {string} params.fromAddress - 起始地址（必填，帮帮订单时为帮帮地点）
 * @param {string} params.toAddress - 目的地址（必填，帮帮订单时与fromAddress相同）
 * @param {string} params.cityName - 城市名称（可选，默认郑州市）
 * @param {string} [params.orderType='send'] - 订单类型，'send'为跑腿配送，'help'为帮帮服务
 */
async function orderPrice(params) {
  const { fromAddress, toAddress, cityName = '郑州市', orderType = 'send' } = params;
  
  if (!fromAddress || !toAddress) {
    throw new Error('起始地址和目的地址为必填项');
  }
  
  // 确保城市名带"市"
  let city = cityName;
  if (city && !city.endsWith('市')) {
    city = city + '市';
  }
  
  const isHelp = orderType && orderType.toLowerCase() === 'help';
  
  const biz = {
    fromAddress: fromAddress,
    toAddress: isHelp ? fromAddress : toAddress,
    sendType: isHelp ? 'HELP' : 'SEND',
    cityName: city,
    specialChannel: 2
  };
  
  if (isHelp) {
    biz.goodsType = 'ALLHELP';
  }
  
  const typeLabel = isHelp ? '帮帮服务' : '配送';
  console.log(`💰 正在查询${typeLabel}价格...`);
  return await postRequest(biz, 'order/orderPrice');
}

/**
 * 创建订单
 * @param {Object} params - 订单参数
 * @param {string} params.priceToken - 询价返回的 token（必填）
 * @param {string} params.receiverPhone - 收件人电话（必填）
 * @param {string} [params.channel] - 聊天渠道（wechat 渠道 specialChannel=4，其他渠道=2）
 * @param {string} [params.note] - 帮帮内容描述（帮帮订单时必填，描述具体需要跑男提供的帮助服务）
 */
async function createOrder(params) {
  const { priceToken, receiverPhone, channel, note } = params;
  
  if (!priceToken) {
    throw new Error('priceToken 为必填项，请先调用订单询价接口');
  }
  
  if (!receiverPhone) {
    throw new Error('收件人电话为必填项');
  }
  
  // 微信渠道 specialChannel=4，其他渠道=2
  const isWechat = channel && channel.toLowerCase() === 'wechat';
  const specialChannel = isWechat ? 4 : 2;
  
  const biz = {
    priceToken: priceToken,
    receiver_phone: receiverPhone,
    pushType: 'OPEN_ORDER',
    payType: 'BALANCE_PAY',
    specialChannel: specialChannel,
    specialType: 'NOT_NEED_WARM'
  };
  
  if (note) {
    biz.note = note;
  }
  
  console.log('📦 正在创建订单...');
  return await postRequest(biz, 'order/addOrder');
}

/**
 * 查询订单详情
 * @param {Object} params - 查询参数
 * @param {string} params.orderCode - 订单编号（必填）
 */
async function orderDetail(params) {
  const { orderCode } = params;
  
  if (!orderCode) {
    throw new Error('订单编号为必填项');
  }
  
  const biz = {
    order_code: orderCode
  };
  
  console.log('📋 正在查询订单详情...');
  return await postRequest(biz, 'order/orderDetail');
}

/**
 * 取消订单
 * @param {Object} params - 取消参数
 * @param {string} params.orderCode - 订单编号（必填）
 * @param {string} params.reason - 取消原因（可选）
 */
async function cancelOrder(params) {
  const { orderCode, reason } = params;
  
  if (!orderCode) {
    throw new Error('订单编号为必填项');
  }
  
  const biz = {
    order_code: orderCode,
    reason: reason || ''
  };
  
  console.log('❌ 正在取消订单...');
  return await postRequest(biz, 'order/cancelOrder');
}

/**
 * 跑男实时追踪
 * @param {Object} params - 追踪参数
 * @param {string} params.orderCode - 订单编号（必填）
 */
async function driverTrack(params) {
  const { orderCode } = params;
  
  if (!orderCode) {
    throw new Error('订单编号为必填项');
  }
  
  const biz = {
    order_code: orderCode
  };
  
  console.log('🏃 正在查询跑男信息...');
  return await postRequest(biz, 'order/driverTrack');
}

/**
 * 格式化价格（分转元）
 */
function formatPrice(priceInFen) {
  return (priceInFen / 100).toFixed(2);
}

// ============ 版本更新检测 ============

const UPDATE_LATEST_URL = process.env.UUPT_UPDATE_LATEST_URL || 'https://otherfiles.uupt.com/skills/uupt-delivery-latest.json';
const UPDATE_DEFAULT_ZIP_URL = 'https://otherfiles.uupt.com/skills/uupt-delivery.zip';
const UPDATE_CACHE_FILE = path.join(CONFIG_DIR, 'update-check.json');
// 网络检测与提醒的最小间隔：24 小时
const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000;

/**
 * 读取当前安装的版本号（以 package.json 为唯一来源）
 */
function getCurrentVersion() {
  try {
    return require('./package.json').version || '0.0.0';
  } catch (error) {
    return '0.0.0';
  }
}

/**
 * 比较语义化版本号，a > b 返回 1，a < b 返回 -1，相等返回 0
 */
function compareVersions(a, b) {
  const parse = (v) => String(v).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function readUpdateCache() {
  try {
    if (fs.existsSync(UPDATE_CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(UPDATE_CACHE_FILE, 'utf8'));
    }
  } catch (error) { /* 缓存损坏时当作不存在 */ }
  return {};
}

function writeUpdateCache(cache) {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(UPDATE_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (error) { /* 写缓存失败静默忽略 */ }
}

/**
 * 从版本发布服务器获取最新版本信息
 * @returns {Promise<{version: string, zipUrl: string, notes: string}>}
 */
async function fetchLatestInfo(timeout = 3000) {
  const response = await axios.get(UPDATE_LATEST_URL, { timeout });
  const data = response.data;
  if (!data || !data.version) {
    throw new Error('版本信息文件格式无效（缺少 version 字段）');
  }
  return {
    version: String(data.version),
    zipUrl: data.zipUrl || UPDATE_DEFAULT_ZIP_URL,
    notes: data.notes || ''
  };
}

/**
 * 更新检测：带缓存节流（24h 最多请求一次），发现新版本时输出 [UPDATE_AVAILABLE] 标记。
 * 任何异常都静默忽略，绝不影响主功能。
 */
async function maybeNotifyUpdate() {
  if (process.env.UUPT_SKIP_UPDATE_CHECK === '1') return;
  try {
    const now = Date.now();
    let cache = readUpdateCache();

    if (!cache.lastCheck || now - cache.lastCheck > UPDATE_CHECK_INTERVAL) {
      // 无论成功失败都记录 lastCheck，避免服务器不可达时每次运行都发起网络请求
      cache.lastCheck = now;
      try {
        const latest = await fetchLatestInfo();
        cache.latestVersion = latest.version;
        cache.zipUrl = latest.zipUrl;
        cache.notes = latest.notes;
      } catch (error) { /* 获取失败保留旧缓存 */ }
      writeUpdateCache(cache);
    }

    const current = getCurrentVersion();
    const hasNewer = cache.latestVersion && compareVersions(cache.latestVersion, current) > 0;
    const notifiedRecently = cache.lastNotified && now - cache.lastNotified <= UPDATE_CHECK_INTERVAL;

    if (hasNewer && !notifiedRecently) {
      cache.lastNotified = now;
      writeUpdateCache(cache);
      console.log('\n[UPDATE_AVAILABLE]');
      console.log(`CURRENT_VERSION=${current}`);
      console.log(`LATEST_VERSION=${cache.latestVersion}`);
      if (cache.notes) {
        console.log(`RELEASE_NOTES=${String(cache.notes).replace(/\r?\n/g, ' ')}`);
      }
      console.log('UPDATE_COMMAND=node scripts/self-update.js');
      console.log('提示: skill 有新版本。请先完成用户当前任务，再询问用户是否更新（未经用户同意不要执行更新）。');
    }
  } catch (error) { /* 更新检测失败静默忽略 */ }
}

// 进程正常结束（事件循环排空）时触发一次更新检测。
// 通过 process.exit() 退出的错误路径不会触发，天然只在主功能正常完成后检测。
let updateCheckStarted = false;
process.on('beforeExit', () => {
  if (updateCheckStarted) return;
  updateCheckStarted = true;
  maybeNotifyUpdate();
});

// 导出函数
module.exports = {
  CONFIG_DIR,
  CONFIG_FILE,
  readConfig,
  readDefaults,
  saveConfig,
  getConfig,
  ensureConfig,
  postUnauthorizedRequest,
  getPublicIp,
  sendSmsCode,
  auth,
  orderPrice,
  createOrder,
  orderDetail,
  cancelOrder,
  driverTrack,
  formatPrice,
  UPDATE_LATEST_URL,
  UPDATE_DEFAULT_ZIP_URL,
  UPDATE_CACHE_FILE,
  getCurrentVersion,
  compareVersions,
  readUpdateCache,
  writeUpdateCache,
  fetchLatestInfo
};

// 如果直接运行此文件，显示帮助信息
if (require.main === module) {
  console.log(`
🚚 UU跑腿同城配送服务
支持跑腿配送(SEND)和帮帮服务(HELP)两种订单类型。

可用命令:
  node scripts/register.js       - 手机号注册/获取授权
  node scripts/order-price.js    - 订单询价（支持跑腿配送和帮帮服务）
  node scripts/create-order.js   - 创建订单
  node scripts/order-detail.js   - 查询订单详情
  node scripts/cancel-order.js   - 取消订单
  node scripts/driver-track.js   - 跑男实时追踪

首次使用:
  运行任何命令时会自动检测是否需要注册。
  如需手动注册: node scripts/register.js --mobile="您的手机号"
`);
}
