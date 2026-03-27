#!/usr/bin/env node

/**
 * 创建订单脚本
 * 用法: node create-order.js --priceToken="询价token" --receiverPhone="收件人电话"
 */

const { createOrder, formatPrice } = require('../index');

// 解析命令行参数
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    const match = arg.match(/^--(\w+)=(.+)$/);
    if (match) {
      args[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  });
  return args;
}

async function main() {
  const args = parseArgs();
  
  if (!args.priceToken || !args.receiverPhone) {
    console.log(`
📦 创建订单

用法:
  node create-order.js --priceToken="询价token" --receiverPhone="收件人电话"

参数:
  --priceToken     询价接口返回的 token（必填）
  --receiverPhone  收件人手机号（必填）

示例:
  node create-order.js --priceToken="abc123xyz" --receiverPhone="13800138000"

注意:
  - priceToken 有时效性，请在询价后尽快创建订单
  - 如账户余额不足，将返回支付宝支付链接
`);
    process.exit(1);
  }
  
  try {
    const result = await createOrder({
      priceToken: args.priceToken,
      receiverPhone: args.receiverPhone
    });
    
    if (result) {
      console.log('📊 创建结果:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.data && result.data.order_code) {
        // 检查是否需要支付宝支付（余额不足）
        if (result.data.orderUrl) {
          console.log('\n⚠️  账户余额不足，需要通过支付宝支付');
          console.log(`   订单编号: ${result.data.order_code}`);
          console.log(`   支付链接: ${result.data.orderUrl}`);
          console.log('\n💳 请确认是否立即支付？');
          console.log('   - 如需支付，请打开上方支付链接完成支付');
          console.log('   - 支付完成后，订单将自动生效');
          
          // 输出特殊标记，供 Agent 识别
          console.log('\n[PAYMENT_REQUIRED]');
          console.log(`ORDER_CODE=${result.data.order_code}`);
          console.log(`PAYMENT_URL=${result.data.orderUrl}`);
        } else {
          console.log('\n✅ 订单创建成功!');
          console.log(`   订单编号: ${result.data.order_code}`);
          console.log('\n💡 提示: 使用订单编号可查询订单详情或跟踪跑男位置');
        }
      }
    }
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
