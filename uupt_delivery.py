#!/usr/bin/env python3
"""
UU跑腿同城配送服务 Agent Skill (Python 版本)
提供订单询价、发单、订单查询、取消订单、跑男追踪等功能。

用法：
    python uupt_delivery.py price --from-address="起始地址" --to-address="目的地址" [--city="城市名"]
    python uupt_delivery.py create --price-token="询价token" --receiver-phone="收件人电话"
    python uupt_delivery.py detail --order-code="订单编号"
    python uupt_delivery.py cancel --order-code="订单编号" [--reason="取消原因"]
    python uupt_delivery.py track --order-code="订单编号"

配置方式：
    1. 环境变量：UUPT_APP_ID, UUPT_APP_SECRET, UUPT_OPEN_ID, UUPT_API_URL
    2. 配置文件：config.json
"""

import sys
import os
import json
import hashlib
import time
import argparse
from pathlib import Path

try:
    import requests
except ImportError:
    print("[错误] 缺少 requests 库，请运行: pip install requests")
    sys.exit(1)

# 配置文件路径
CONFIG_FILE = Path(__file__).parent / "config.json"

# 默认 API 地址
DEFAULT_API_URL = "https://api-open.uupt.com/openapi/v3/"


def read_config() -> dict:
    """读取配置文件"""
    try:
        if CONFIG_FILE.exists():
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        print(f"[警告] 读取配置文件失败: {e}")
    return {}


def save_config(config: dict) -> bool:
    """保存配置文件"""
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        print(f"[成功] 配置已保存到: {CONFIG_FILE}")
        return True
    except Exception as e:
        print(f"[错误] 保存配置文件失败: {e}")
        return False


def get_config() -> dict:
    """获取配置（优先从环境变量读取）"""
    config = read_config()
    return {
        "app_id": os.environ.get("UUPT_APP_ID") or config.get("appId"),
        "app_secret": os.environ.get("UUPT_APP_SECRET") or config.get("appSecret"),
        "open_id": os.environ.get("UUPT_OPEN_ID") or config.get("openId"),
        "api_url": os.environ.get("UUPT_API_URL") or config.get("apiUrl") or DEFAULT_API_URL,
    }


def ensure_config() -> dict:
    """检查并确保配置完整"""
    config = get_config()
    missing = []
    
    if not config["app_id"]:
        missing.append("UUPT_APP_ID")
    if not config["app_secret"]:
        missing.append("UUPT_APP_SECRET")
    if not config["open_id"]:
        missing.append("UUPT_OPEN_ID")
    
    if missing:
        print("\n[警告] 缺少配置信息")
        print("请设置以下环境变量或编辑 config.json:")
        for key in missing:
            print(f"  - {key}")
        print("\n访问 https://open.uupt.com 获取 API 认证信息\n")
        raise ValueError(f"缺少配置: {', '.join(missing)}")
    
    return config


def generate_md5(text: str) -> str:
    """生成 MD5 签名"""
    return hashlib.md5(text.encode("utf-8")).hexdigest().upper()


def post_request(biz_params: dict, path: str) -> dict:
    """发送 API 请求"""
    config = ensure_config()
    timestamp = int(time.time())
    biz_json = json.dumps(biz_params, ensure_ascii=False, separators=(",", ":"))
    
    # 生成签名: MD5(bizJson + appSecret + timestamp)
    sign_str = biz_json + config["app_secret"] + str(timestamp)
    sign = generate_md5(sign_str)
    
    payload = {
        "openId": config["open_id"],
        "timestamp": timestamp,
        "biz": biz_json,
        "sign": sign,
    }
    
    url = config["api_url"] + path
    headers = {
        "X-App-Id": config["app_id"],
        "Content-Type": "application/json",
    }
    
    print(f"[请求] 正在请求: {path}...")
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        if response.status_code == 200:
            print("[成功] 请求成功\n")
            return response.json()
        else:
            print(f"[错误] 请求失败: HTTP {response.status_code}")
            return {"error": f"HTTP {response.status_code}"}
    except requests.RequestException as e:
        print(f"[错误] 请求异常: {e}")
        return {"error": str(e)}


def format_price(price_in_fen: int) -> str:
    """格式化价格（分转元）"""
    return f"{price_in_fen / 100:.2f}"


# ============ 业务功能 ============

def order_price(from_address: str, to_address: str, city_name: str = "郑州市") -> dict:
    """订单询价"""
    if not from_address or not to_address:
        raise ValueError("起始地址和目的地址为必填项")
    
    # 确保城市名带"市"
    if city_name and not city_name.endswith("市"):
        city_name = city_name + "市"
    
    biz = {
        "fromAddress": from_address,
        "toAddress": to_address,
        "sendType": "SEND",
        "cityName": city_name,
        "specialChannel": 1,
    }
    
    print("[询价] 正在查询配送价格...")
    return post_request(biz, "order/orderPrice")


def create_order(price_token: str, receiver_phone: str) -> dict:
    """创建订单"""
    if not price_token:
        raise ValueError("priceToken 为必填项，请先调用订单询价接口")
    if not receiver_phone:
        raise ValueError("收件人电话为必填项")
    
    biz = {
        "priceToken": price_token,
        "receiver_phone": receiver_phone,
        "pushType": "OPEN_ORDER",
        "payType": "BALANCE_PAY",
        "specialChannel": 1,
        "specialType": "NOT_NEED_WARM",
    }
    
    print("[下单] 正在创建订单...")
    return post_request(biz, "order/addOrder")


def order_detail(order_code: str) -> dict:
    """查询订单详情"""
    if not order_code:
        raise ValueError("订单编号为必填项")
    
    biz = {"order_code": order_code}
    
    print("[查询] 正在查询订单详情...")
    return post_request(biz, "order/orderDetail")


def cancel_order(order_code: str, reason: str = "") -> dict:
    """取消订单"""
    if not order_code:
        raise ValueError("订单编号为必填项")
    
    biz = {
        "order_code": order_code,
        "reason": reason or "",
    }
    
    print("[取消] 正在取消订单...")
    return post_request(biz, "order/cancelOrder")


def driver_track(order_code: str) -> dict:
    """跑男实时追踪"""
    if not order_code:
        raise ValueError("订单编号为必填项")
    
    biz = {"order_code": order_code}
    
    print("[追踪] 正在查询跑男信息...")
    return post_request(biz, "order/driverTrack")


# ============ 结果格式化 ============

def format_price_result(result: dict) -> None:
    """格式化询价结果"""
    print("[结果] 询价结果:")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    if result.get("data") and result["data"].get("priceInfo"):
        data = result["data"]
        print("\n[价格] 价格摘要:")
        price_info = data["priceInfo"]
        if "totalPrice" in price_info:
            print(f"   预估费用: {format_price(price_info['totalPrice'])} 元")
        if data.get("priceToken"):
            print(f"   priceToken: {data['priceToken']}")
            print("\n[提示] 使用此 priceToken 创建订单")


def format_create_result(result: dict) -> None:
    """格式化创建订单结果"""
    print("[结果] 创建结果:")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    if result.get("data") and result["data"].get("order_code"):
        data = result["data"]
        # 检查是否需要支付宝支付（余额不足）
        if data.get("orderUrl"):
            print("\n[警告] 账户余额不足，需要通过支付宝支付")
            print(f"   订单编号: {data['order_code']}")
            print(f"   支付链接: {data['orderUrl']}")
            print("\n[支付] 请确认是否立即支付？")
            print("   - 如需支付，请打开上方支付链接完成支付")
            print("   - 支付完成后，订单将自动生效")
            
            # 输出特殊标记，供 Agent 识别
            print("\n[PAYMENT_REQUIRED]")
            print(f"ORDER_CODE={data['order_code']}")
            print(f"PAYMENT_URL={data['orderUrl']}")
        else:
            print("\n[成功] 订单创建成功!")
            print(f"   订单编号: {data['order_code']}")
            print("\n[提示] 使用订单编号可查询订单详情或跟踪跑男位置")


def format_detail_result(result: dict, order_code: str) -> None:
    """格式化订单详情结果"""
    print("[结果] 订单详情:")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    if result.get("data"):
        data = result["data"]
        print("\n[详情] 订单摘要:")
        print(f"   订单编号: {data.get('order_code', order_code)}")
        print(f"   订单状态: {data.get('order_status', '-')}")
        if data.get("price"):
            print(f"   配送费用: {format_price(data['price'])} 元")
        if data.get("driver_name"):
            print(f"   骑手姓名: {data['driver_name']}")
            print(f"   骑手电话: {data.get('driver_phone', '-')}")


def format_cancel_result(result: dict, order_code: str, reason: str) -> None:
    """格式化取消订单结果"""
    print("[结果] 取消结果:")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    if result.get("code") in [0, "0"]:
        print("\n[成功] 订单已取消")
        print(f"   订单编号: {order_code}")
        if reason:
            print(f"   取消原因: {reason}")


def format_track_result(result: dict) -> None:
    """格式化跑男追踪结果"""
    print("[结果] 跑男信息:")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    if result.get("data"):
        data = result["data"]
        print("\n[骑手] 跑男摘要:")
        if data.get("driver_name"):
            print(f"   骑手姓名: {data['driver_name']}")
            print(f"   联系电话: {data.get('driver_phone', '-')}")
        if data.get("longitude") and data.get("latitude"):
            print(f"   当前位置: {data['longitude']}, {data['latitude']}")
        if data.get("distance"):
            print(f"   距离目的地: {data['distance']} 米")


# ============ 命令行入口 ============

def print_usage():
    """打印使用说明"""
    usage = """
UU跑腿同城配送服务 (Python 版本)

用法:
  python uupt_delivery.py <命令> [参数]

命令:
  price   订单询价
  create  创建订单
  detail  查询订单详情
  cancel  取消订单
  track   跑男实时追踪

示例:
  python uupt_delivery.py price --from-address="郑州市金水区农业路" --to-address="郑州市二七区德化街"
  python uupt_delivery.py price --from-address="北京市朝阳区" --to-address="北京市海淀区" --city="北京市"
  python uupt_delivery.py create --price-token="xxx" --receiver-phone="13800138000"
  python uupt_delivery.py detail --order-code="UU123456789"
  python uupt_delivery.py cancel --order-code="UU123456789" --reason="用户改变主意"
  python uupt_delivery.py track --order-code="UU123456789"

配置方式:
  1. 环境变量: UUPT_APP_ID, UUPT_APP_SECRET, UUPT_OPEN_ID, UUPT_API_URL
  2. 配置文件: config.json

更多信息请访问: https://open.uupt.com
    """.strip()
    print(usage)


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ["-h", "--help"]:
        print_usage()
        sys.exit(0)
    
    command = sys.argv[1].lower()
    
    parser = argparse.ArgumentParser(add_help=False)
    
    try:
        if command == "price":
            parser.add_argument("--from-address", required=True, help="起始地址")
            parser.add_argument("--to-address", required=True, help="目的地址")
            parser.add_argument("--city", default="郑州市", help="城市名称")
            args = parser.parse_args(sys.argv[2:])
            
            result = order_price(args.from_address, args.to_address, args.city)
            format_price_result(result)
            
        elif command == "create":
            parser.add_argument("--price-token", required=True, help="询价返回的token")
            parser.add_argument("--receiver-phone", required=True, help="收件人电话")
            args = parser.parse_args(sys.argv[2:])
            
            result = create_order(args.price_token, args.receiver_phone)
            format_create_result(result)
            
        elif command == "detail":
            parser.add_argument("--order-code", required=True, help="订单编号")
            args = parser.parse_args(sys.argv[2:])
            
            result = order_detail(args.order_code)
            format_detail_result(result, args.order_code)
            
        elif command == "cancel":
            parser.add_argument("--order-code", required=True, help="订单编号")
            parser.add_argument("--reason", default="", help="取消原因")
            args = parser.parse_args(sys.argv[2:])
            
            result = cancel_order(args.order_code, args.reason)
            format_cancel_result(result, args.order_code, args.reason)
            
        elif command == "track":
            parser.add_argument("--order-code", required=True, help="订单编号")
            args = parser.parse_args(sys.argv[2:])
            
            result = driver_track(args.order_code)
            format_track_result(result)
            
        else:
            print(f"[错误] 未知命令: {command}")
            print("   支持的命令: price, create, detail, cancel, track")
            print("   使用 -h 查看帮助")
            sys.exit(1)
            
    except ValueError as e:
        print(f"[错误] 参数错误: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n已取消。")
        sys.exit(0)


if __name__ == "__main__":
    main()
