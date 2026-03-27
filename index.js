const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');

// 配置文件路径
const CONFIG_FILE = path.join(__dirname, 'config.json');

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
 * 保存配置文件
 */
function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    console.log('配置已保存到:', CONFIG_FILE);
    return true;
  } catch (error) {
    console.error('保存配置文件失败:', error.message);
    return false;
  }
}

/**
 * 获取配置（优先从环境变量读取）
 */
function getConfig() {
  const config = readConfig();
  
  return {
    appId: process.env.UUPT_APP_ID || config.appId || null,
    appSecret: process.env.UUPT_APP_SECRET || config.appSecret || null,
    openId: process.env.UUPT_OPEN_ID || config.openId || null,
    apiUrl: process.env.UUPT_API_URL || config.apiUrl || 'https://api-open.uupt.com/openapi/v3/'
  };
}

/**
 * 检查并确保配置完整
 */
function ensureConfig() {
  const config = getConfig();
  const missing = [];
  
  if (!config.appId) missing.push('UUPT_APP_ID');
  if (!config.appSecret) missing.push('UUPT_APP_SECRET');
  if (!config.openId) missing.push('UUPT_OPEN_ID');
  
  if (missing.length > 0) {
    console.log('\n⚠️  缺少配置信息');
    console.log('请设置以下环境变量或编辑 config.json:');
    missing.forEach(key => console.log(`  - ${key}`));
    console.log('\n访问 https://open.uupt.com 获取 API 认证信息\n');
    throw new Error(`缺少配置: ${missing.join(', ')}`);
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
 * 发送 API 请求
 */
async function postRequest(bizParams, path) {
  const config = ensureConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const bizJson = JSON.stringify(bizParams);
  
  // 生成签名: MD5(bizJson + appSecret + timestamp)
  const signStr = bizJson + config.appSecret + timestamp;
  const sign = generateMd5(signStr);
  
  const payload = {
    openId: config.openId,
    timestamp: timestamp,
    biz: bizJson,
    sign: sign
  };
  
  const url = config.apiUrl + path;
  
  try {
    console.log(`🔄 正在请求: ${path}...`);
    
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
 * 订单询价
 * @param {Object} params - 询价参数
 * @param {string} params.fromAddress - 起始地址（必填）
 * @param {string} params.toAddress - 目的地址（必填）
 * @param {string} params.cityName - 城市名称（可选，默认郑州市）
 */
async function orderPrice(params) {
  const { fromAddress, toAddress, cityName = '郑州市' } = params;
  
  if (!fromAddress || !toAddress) {
    throw new Error('起始地址和目的地址为必填项');
  }
  
  // 确保城市名带"市"
  let city = cityName;
  if (city && !city.endsWith('市')) {
    city = city + '市';
  }
  
  const biz = {
    fromAddress: fromAddress,
    toAddress: toAddress,
    sendType: 'SEND',
    cityName: city,
    specialChannel: 1
  };
  
  console.log('💰 正在查询配送价格...');
  return await postRequest(biz, 'order/orderPrice');
}

/**
 * 创建订单
 * @param {Object} params - 订单参数
 * @param {string} params.priceToken - 询价返回的 token（必填）
 * @param {string} params.receiverPhone - 收件人电话（必填）
 */
async function createOrder(params) {
  const { priceToken, receiverPhone } = params;
  
  if (!priceToken) {
    throw new Error('priceToken 为必填项，请先调用订单询价接口');
  }
  
  if (!receiverPhone) {
    throw new Error('收件人电话为必填项');
  }
  
  const biz = {
    priceToken: priceToken,
    receiver_phone: receiverPhone,
    pushType: 'OPEN_ORDER',
    payType: 'BALANCE_PAY',
    specialChannel: 1,
    specialType: 'NOT_NEED_WARM'
  };
  
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

// 导出函数
module.exports = {
  readConfig,
  saveConfig,
  getConfig,
  ensureConfig,
  orderPrice,
  createOrder,
  orderDetail,
  cancelOrder,
  driverTrack,
  formatPrice
};

// 如果直接运行此文件，显示帮助信息
if (require.main === module) {
  console.log(`
🚚 UU跑腿同城配送服务

可用命令:
  node scripts/order-price.js    - 订单询价
  node scripts/create-order.js   - 创建订单
  node scripts/order-detail.js   - 查询订单详情
  node scripts/cancel-order.js   - 取消订单
  node scripts/driver-track.js   - 跑男实时追踪

配置方式:
  1. 环境变量: UUPT_APP_ID, UUPT_APP_SECRET, UUPT_OPEN_ID
  2. 配置文件: config.json

更多信息请访问: https://open.uupt.com
`);
}
