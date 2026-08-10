---
name: uupt-delivery
description: >-
  UU跑腿同城配送服务。支持跑腿配送和帮帮服务两种订单类型，包括订单询价、发单下单、查询订单、取消订单、跑男实时追踪。当用户表达任何与"送"、"取"、"寄"、"跑腿"、"发单"、"配送"、"帮送"、"帮取"、"帮买"、"代购"、"同城急送"、"帮帮"、"帮我"、"代办"、"代取号"、"代排队"、"陪诊"、"搬东西"、"装卸"、"小时工"、"打扫卫生"、"布置场地"、"取寄快递"、"琐事代办"等配送或帮帮需求时使用此skill。
version: 1.0.8
metadata:
  openclaw:
    requires:
      env: []
      bins:
        - node
        - python3
    homepage: https://open.uupt.com
    install:
      - kind: node
        package: axios
        bins: []
      - kind: python
        package: requests
        bins: []
---

# UU跑腿同城配送服务 Skill

UU跑腿同城配送服务为用户提供便捷的同城即时配送能力和现场帮帮服务，包括订单询价、发单、订单管理和跑男实时追踪等功能。

## 功能特性

- 📱 手机号一键注册（首次使用自动引导）
- 💰 订单询价（计算配送/帮帮服务费用）
- 📦 创建跑腿配送订单（帮送 / 帮取 / 帮买，从A地到B地）
- 🤝 创建帮帮服务订单（陪诊、代办、搬抬装卸、小时工、琐事代办等现场协助）
- 💳 在线支付（余额不足时提供支付链接，支持微信/支付宝）
- 📋 查询订单详情
- ❌ 取消订单
- 🏃 跑男实时位置追踪

## 运行环境

本 skill 同时提供 **Node.js** 和 **Python** 两种版本，Agent 自动检测可用环境。

| 环境 | 依赖安装 | 脚本入口 |
|------|---------|---------|
| Node.js | `npm install` | `scripts/*.js`、`index.js` |
| Python | `pip install -r requirements.txt` | `uupt_delivery.py` |

> **命令格式约定**：下文命令示例默认使用 Node.js 版本，Python 版本只需将脚本路径换为 `python uupt_delivery.py <command>`，参数名中的 `--camelCase` 换为 `--kebab-case`（如 `--fromAddress` → `--from-address`），参数含义完全相同，不再重复列出。

## 触发条件与场景判断

收到用户请求后，先判断场景。Agent 需智能识别**跑腿配送(SEND)** vs **帮帮服务(HELP)**：

| 用户表达 | 识别为 | 判断依据 |
|---------|--------|---------|
| "从A送到B"、"把X寄到Y"、"帮我送一下"、"配送" | 跑腿配送(SEND) | 两个不同地点之间的物品传递（帮送） |
| "帮我去A取XX送到B"、"取快递送到家里" | 跑腿配送(SEND) | 取件后再送到另一地点（帮取） |
| "帮我买个X送到Y"、"代购/帮买" | 跑腿配送(SEND) | 购买地到收货地，本质仍是 A→B |
| "送文件/合同/证件"、"送鲜花/蛋糕"、"送餐" | 跑腿配送(SEND) | 同城急送常见品类 |
| "帮我在X地点..."、"帮我搬/扔/装/打扫..." | 帮帮服务(HELP) | 只有一个地点，跑男在现场提供协助 |
| "陪诊"、"陪护"、"代去医院" | 帮帮服务(HELP) | 现场陪同协助，不涉及物品配送 |
| "异地代办"、"政务大厅取资料/盖章"、"琐事代办" | 帮帮服务(HELP) | 到指定地点代办事务 |
| "代去现场"、"代排队"、"代取号" | 帮帮服务(HELP) | 到场排队/到场办事 |
| "布置场地"、"小时工"、"临时工"、"打扫卫生" | 帮帮服务(HELP) | 按需到场提供劳务 |
| "家具/电器搬抬"、"货物装卸" | 帮帮服务(HELP) | 现场搬抬装卸劳务 |
| "帮我去快递站取/寄件"（用户不要求再送到别处） | 帮帮服务(HELP) | 业务代办类现场事务 |
| "帮我取快递送到家里" | 跑腿配送(SEND) | 取件后还需送到另一地点 |

**判断原则**：核心是从A到B传递物品（含代买后送达） → 跑腿配送；核心是在某地点提供现场协助/代办/劳务 → 帮帮。

### 跑腿配送场景分类

对照 UU 跑腿「帮送 / 帮取 / 帮买」能力，配送订单统一走 `orderType=send`（默认），需确认**起始地址 + 目的地址 + 收件人电话**。物品说明可写入可选 `--note`，帮买场景建议必写购买要求。

| 分类 | 子场景 | 典型用户表达 | 地址怎么填 | note 示例（可选，帮买建议填写） |
|------|--------|-------------|-----------|--------------------------------|
| 帮送 | 文件证件 | "帮我把合同送到对方公司" | from=寄件地，to=收件地 | 文件合同一份，请当面签收 |
| 帮送 | 餐饮餐食 | "帮我把这份外卖送到公司" | from=商家/取餐点，to=收餐地址 | 餐食保温送达，勿压扁 |
| 帮送 | 鲜花礼品 | "帮我送束花到女朋友公司" | from=花店，to=收花地址 | 鲜花一束，轻拿轻放，保密配送 |
| 帮送 | 蛋糕烘焙 | "生日蛋糕送到酒店" | from=蛋糕店，to=收货地址 | 蛋糕注意防震，上楼送到房间 |
| 帮送 | 数码设备 | "帮我把手机送到售后点" | from=寄件地，to=售后点 | 手机一部，包装完好请签收 |
| 帮送 | 样品物料 | "样品送到客户办公室" | from=仓库/门店，to=客户地址 | 样品纸箱 1 个 |
| 帮取 | 文件资料 | "去打印店取文件送到我这" | from=打印店，to=用户地址 | 取 A4 打印件，袋装 |
| 帮取 | 快递代取送 | "去驿站取快递送到家里" | from=驿站，to=家 | 取件码 1234，放门口即可 |
| 帮取 | 门店取货 | "去药店取好的药送到公司" | from=药店，to=公司 | 凭取药单取药，勿压碎 |
| 帮买 | 代购美食 | "帮我买杯瑞幸送到写字楼" | from=门店，to=收货地 | 瑞幸生椰拿铁热一杯，少冰 |
| 帮买 | 代购生鲜百货 | "帮我去超市买包纸巾送到家" | from=超市，to=家 | 抽纸 1 提，选常见品牌即可 |
| 帮买 | 代购药品 | "帮我去药店买感冒药送到酒店" | from=药店，to=酒店 | 成人感冒颗粒 1 盒，如缺货电话联系 |
| 帮买 | 代购急需 | "附近便利店买份泡面送到宿舍" | from=便利店，to=宿舍 | 泡面 1 桶 + 火腿肠，尽快 |

> 未说清起止地址时先追问；帮买未指定购买地点时，可按用户所在城市就近门店确认后再询价。物品易碎/保温/保密等要求写入 `note`。

### 帮帮服务场景分类

对照「UU万能帮手」能力，帮帮订单覆盖以下常见场景。下单时统一走 `orderType=help`，并把具体事项写入 `--note`：

| 分类 | 子场景 | 典型用户表达 | note 示例 |
|------|--------|-------------|-----------|
| 热门服务 | 陪诊陪护 | "帮我去医院陪诊"、"陪老人看病" | 郑州人民医院陪诊，协助挂号取药 |
| 热门服务 | 异地代办 | "人不在郑州，帮我去办件事" | 代办营业执照材料提交 |
| 热门服务 | 代去现场 | "帮我去现场看一下/排队" | 代去售楼部领取资料并排队 |
| 热门服务 | 布置场地 | "帮我布置一下求婚/活动现场" | 车尾鲜花布置，按照片效果摆放 |
| 搬抬装卸 | 家具搬抬 | "帮我抬沙发/衣柜" | 三楼家具搬抬至一楼，无电梯 |
| 搬抬装卸 | 货物装卸 | "帮我卸货/装车" | 仓库门口货物卸车码放 |
| 搬抬装卸 | 电器搬抬 | "帮我搬冰箱/洗衣机" | 搬抬冰箱上楼，需两人协作 |
| 小时工 | 临时工 | "找个临时工干两小时" | 临时工 2 小时，听从现场安排 |
| 小时工 | 布置场地 | "活动场地摆桌椅/布置" | 会议室摆放桌椅与背景板 |
| 小时工 | 打扫卫生 | "帮我打扫一下房子/店面" | 两室一厅日常保洁 |
| 业务代办 | 琐事代办 | "帮我跑腿办点杂事"、"政务大厅取资料盖章" | 政务大厅取资料并盖章 |
| 业务代办 | 取寄快递 | "帮我去菜鸟驿站取/寄快递" | 代取快递（单号 xxx），放门口 |
| 其他协助 | 自定义帮帮 | "没找到对应服务，帮我做…" | 按用户原话完整描述需求 |

> 未命中上表时，仍按帮帮处理：确认服务地点 + 电话 + 具体内容后发单；`note` 尽量写清地点、事项、时长/人数、特殊要求。

**七大场景**：

| 场景 | 触发条件 | 所需信息 |
|------|---------|---------|
| 场景零：首次注册 | 执行脚本输出 `[REGISTRATION_REQUIRED]` | 手机号 / 开发者凭证 |
| 场景一：订单询价 | 用户想知道费用 | 地址信息（配送需起止地址，帮帮只需地点） |
| 场景二：创建订单 | 用户确认发单 | priceToken、收件人电话；（帮帮必填 note，帮买建议 note） |
| 场景三：查询订单 | 用户想看订单状态 | 订单编号 |
| 场景四：取消订单 | 用户要取消订单 | 订单编号 |
| 场景五：跑男追踪 | 用户想看跑男位置 | 订单编号 |
| 场景六：版本更新 | 执行脚本输出 `[UPDATE_AVAILABLE]` | 用户确认是否更新 |

---

## 场景零：首次注册

当执行任何脚本输出 `[REGISTRATION_REQUIRED]` 时自动触发。

### Step 1: 询问凭证

```
首次使用需要配置认证信息，请问您是否已有 UU跑腿开放平台的凭证（appId、appSecret、openId）？
- A: 已有凭证，直接配置
- B: 没有凭证，通过手机号注册
```

### Step 1A: 开发者模式（A）

请用户提供 `appId`、`appSecret`、`openId`，写入 `~/.uupt-delivery/config.json`：

```json
{ "appId": "...", "appSecret": "...", "openId": "..." }
```

保存后告知「配置完成！」，**立即继续执行用户最初要求的功能**。

### Step 2: 手机号注册（B）

询问手机号，发送短信验证码：

```bash
node scripts/register.js --mobile="用户手机号"
```

处理结果：
- `[SMS_SENT]` → 验证码已发送，进入 Step 3
- `[IMAGE_CAPTCHA_REQUIRED]` → 输出包含 `IMAGE_DATA=data:image/png;base64,...`，将 base64 图片展示给用户识别数字后重试：
  ```bash
  node scripts/register.js --mobile="手机号" --imageCode="用户输入的数字"
  ```

### Step 3: 输入验证码完成授权

```bash
node scripts/register.js --mobile="手机号" --smsCode="用户输入的验证码"
```

处理结果：
- `[REGISTRATION_SUCCESS]` → 注册成功，openId 已保存，**立即继续执行用户最初的功能**
- `[REGISTRATION_FAILED]` → 从 Step 2 重试（无需重新输入手机号），最多 3 次
- `[CONFIG_SAVE_FAILED]` → 授权已成功但脚本写配置文件失败。输出中包含 `OPEN_ID=` 和 `CONFIG_FILE=` 两个字段，**Agent 应直接用文件写入工具将 `{"openId": "<OPEN_ID>"}` 写入 CONFIG_FILE 路径**（目录不存在则先创建），然后继续执行用户最初的功能；仅当 Agent 也无法写入时，才提示用户设置环境变量 `UUPT_OPEN_ID`

---

## 场景一：订单询价

计算配送/帮帮服务费用，用户可只询价不发单。

### 执行步骤

1. 判断订单类型（配送 vs 帮帮）
2. 获取地址：配送需起止地址，帮帮只需地点
3. 执行询价脚本，如输出 `[REGISTRATION_REQUIRED]` 则进入场景零后重试

### 命令

**跑腿配送：**
```bash
node scripts/order-price.js --fromAddress="起始地址" --toAddress="目的地址" --cityName="郑州市"
```

**帮帮服务：**
```bash
node scripts/order-price.js --fromAddress="帮帮地点" --toAddress="帮帮地点" --orderType="help"
```

| 参数 | 说明 | 必填 |
|------|------|------|
| `--fromAddress` | 起始地址（帮帮时为帮帮地点） | 是 |
| `--toAddress` | 目的地址（帮帮时为帮帮地点） | 是 |
| `--cityName` | 城市名称（需带"市"字，默认"郑州市"） | 否 |
| `--orderType` | `send`=配送(默认)，`help`=帮帮 | 否 |

### 回复模板

```
💰 {跑腿配送/帮帮服务}费用查询结果：

{起点/服务地点}：{fromAddress}
{终点（仅配送）：{toAddress}}
预估费用：{price/100} 元

📝 如需下单，请提供收件人电话{帮帮订单加：和具体帮帮内容}。
```

> 返回包含 `priceToken` 和价格信息（单位：分，展示时除以 100 转元）。

---

## 场景二：创建订单（发单）

用户明确要发单时，**询价后直接创建订单，无需二次确认**。

### 订单类型对比

| 维度 | 跑腿配送(SEND) | 帮帮服务(HELP) |
|------|---------------|---------------|
| 核心行为 | 物品从A送到B（含帮送/帮取/帮买） | 跑男在现场提供协助/代办/劳务 |
| 地址 | 起始 ≠ 目的 | 起始 = 目的（同一地点） |
| 必填参数 | fromAddress, toAddress, receiverPhone | fromAddress, receiverPhone, **note** |
| 常见场景 | 文件证件、餐饮、鲜花、蛋糕、数码、快递代取送、代购美食/百货/药品等 | 陪诊陪护、异地代办、代去现场、布置场地、家具/电器搬抬、货物装卸、临时工、打扫卫生、琐事代办、取寄快递、其他自定义协助 |
| note | 可选（帮买/易碎品建议填写） | **必填** |

### 执行步骤

1. 获取必要信息（配送：起止地址 + 电话；帮帮：地点 + 电话 + 内容）
2. 调用询价接口获取 priceToken（参照场景一命令）
3. **立即创建订单**，不询问确认
4. 处理返回结果

### 创建订单命令

```bash
# 跑腿配送
node scripts/create-order.js --priceToken="xxx" --receiverPhone="13800138000"

# 跑腿配送（可选 note：物品说明 / 帮买要求）
node scripts/create-order.js --priceToken="xxx" --receiverPhone="13800138000" --note="瑞幸生椰拿铁热一杯"

# 帮帮服务（必须带 --note）
node scripts/create-order.js --priceToken="xxx" --receiverPhone="13800138000" --note="帮帮内容描述"

# 微信渠道：追加 --channel="wechat" 生成二维码
```

| 参数 | 说明 | 必填 |
|------|------|------|
| `--priceToken` | 询价返回的 token | 是 |
| `--receiverPhone` | 收件人手机号 | 是 |
| `--channel` | 渠道（wechat/feishu/dingtalk 等） | 否 |
| `--note` | 物品说明或帮帮内容；帮帮必填，帮买/易碎品建议填写 | 帮帮必填 |

### 返回结果处理

**情况一：余额充足（订单创建成功）**

```
订单创建成功！

订单编号：{order_code}
{帮帮订单：帮帮内容：{note} | 服务地点：{fromAddress}}
配送费用：{price/100} 元

跑男正在接单中，请保持电话畅通。
```

**情况二：余额不足（`[PAYMENT_REQUIRED]`）**

关键输出：`ORDER_CODE`、`PAYMENT_URL`、`QRCODE_FILE`（仅 `--channel="wechat"` 时）。

**微信渠道**（链接无法直接打开，必须发二维码图片）：

```
message(action=send, channel="wechat", path="{QRCODE_FILE}", message="请扫码支付 {price/100} 元")
```

**其他渠道**：直接发送支付链接 `{PAYMENT_URL}`（支持微信/支付宝）。

用户返回后询问支付状态，确认后查询订单详情：

```bash
node scripts/order-detail.js --orderCode="{order_code}"
```

### 完整流程示例

```
# —— 跑腿配送 ——
用户：帮我从金水区送到二七区德化街，电话 13800138000
Agent：识别帮送 → 询价 → 创建订单 → 余额充足则返回成功，不足则引导支付

用户：把花园路花店的一束玫瑰送到正弘城，电话 13900001111
Agent：识别帮送(鲜花) → 确认起止地址 → 询价 → 可选 note="玫瑰一束，轻拿轻放" → 发单

用户：去郑州大学北门菜鸟驿站取个快递送到宿舍楼下，取件码 8876
Agent：识别帮取(快递) → from=驿站 to=宿舍 → note 写取件码 → 询价发单

用户：帮我买杯瑞幸送到绿地中心A座前台
Agent：识别帮买 → 确认门店与收货地址、饮品要求写入 note → 询价发单

用户：帮我去药店买盒感冒药送到如家酒店前台
Agent：识别帮买(药品) → 确认药店与酒店地址 → note 写清品名与缺货联系方式 → 询价发单

# —— 帮帮服务 ——
用户：帮我在郑州人民医院挂个号
Agent：识别帮帮服务 → 询价 → 获取电话与 note → 创建订单（带 --note）

用户：帮我去医院陪诊
Agent：识别帮帮(陪诊陪护) → 确认医院地点 → 询价 → 电话 + note="陪诊陪护…" → 发单

用户：帮我把冰箱搬上楼
Agent：识别帮帮(电器搬抬) → 确认地址与楼层/电梯情况写入 note → 询价发单

用户：帮我去政务大厅取资料盖章
Agent：识别帮帮(琐事代办) → 确认具体大厅地点 → note 写清取件/盖章要求 → 询价发单

用户：帮我去驿站取个快递放到门口就行
Agent：识别帮帮(取寄快递) → 同一地点代办；若还要求送到另一地址则改判为配送
```

---

## 场景三：查询订单详情

```bash
node scripts/order-detail.js --orderCode="UU123456789"
```

| 参数 | 说明 | 必填 |
|------|------|------|
| `--orderCode` | 订单编号 | 是 |

回复模板：
```
📋 订单详情：
订单编号：{order_code} | 状态：{status}
起点：{from_address} | 终点：{to_address}
配送费：{price/100} 元
跑男：{driver_name} {driver_phone}
```

---

## 场景四：取消订单

```bash
node scripts/cancel-order.js --orderCode="UU123456789" --reason="取消原因（可选）"
```

| 参数 | 说明 | 必填 |
|------|------|------|
| `--orderCode` | 订单编号 | 是 |
| `--reason` | 取消原因 | 否 |

---

## 场景五：跑男实时追踪

```bash
node scripts/driver-track.js --orderCode="UU123456789"
```

| 参数 | 说明 | 必填 |
|------|------|------|
| `--orderCode` | 订单编号 | 是 |

回复模板：
```
跑男实时位置：
跑男：{driver_name} | 电话：{driver_phone}
当前位置：{current_location} | 预计送达：{estimated_time}
```

---

## 场景六：版本更新

skill 在业务功能执行完成后会自动检测新版本（每 24 小时最多一次网络请求，静默进行，绝不影响主功能）。

### 触发条件

任意脚本输出末尾出现 `[UPDATE_AVAILABLE]` 标记：

```
[UPDATE_AVAILABLE]
CURRENT_VERSION=1.0.8
LATEST_VERSION=1.1.0
RELEASE_NOTES=本次更新内容简述
AUTO_UPDATE=false
UPDATE_COMMAND=node scripts/self-update.js
```

### 处理规则

**第一原则：先完成用户当前的任务**（询价、下单等主流程不受更新提示影响，正常输出结果），更新相关内容只放在回复的结尾。

然后根据 `AUTO_UPDATE` 字段分两种模式处理：

**模式一：`AUTO_UPDATE=true`（用户已开启自动更新）**

主任务完成后直接执行 `UPDATE_COMMAND`，无需询问，并在回复结尾用一句话告知：「已自动更新 skill 到 {LATEST_VERSION}」。

**模式二：`AUTO_UPDATE=false`（默认，需征求用户同意）**

主任务完成后，在回复结尾用如下话术提示（RELEASE_NOTES 原文转述，让用户看到更新收益）：

```
💡 skill 有新版本 {LATEST_VERSION}：{RELEASE_NOTES}
回复「更新」即可升级（约 10 秒，不影响已注册账号）；回复「以后自动更新」则今后发现新版本自动升级、不再询问。
```

根据用户回复执行：

| 用户回复 | 执行命令 |
|---------|---------|
| 同意更新（"更新"、"好"等） | `node scripts/self-update.js` |
| 以后自动更新 | `node scripts/self-update.js --enable-auto-update`（保存偏好并立即更新） |
| 关闭自动更新 | `node scripts/self-update.js --disable-auto-update` |
| 拒绝或未回应 | 不执行任何操作，不再追问（24 小时内不会重复提醒） |

（Python 环境把命令换为 `python uupt_delivery.py self-update`，参数相同。）

**严禁在 `AUTO_UPDATE=false` 时未经用户确认执行更新。**

### 更新结果处理

| 标记 | 含义 | Agent 处理 |
|------|------|-----------|
| `[UPDATE_SUCCESS]` | 更新成功 | 告知用户已更新到 `VERSION=` 的版本；**立即重新读取 `SKILL_FILE=` 指向的 SKILL.md**，本会话后续操作按新版使用说明执行（脚本已自动是新版，无需重启会话） |
| `[AUTO_UPDATE_ENABLED]` | 已开启自动更新 | 告知用户之后新版本将自动升级 |
| `[AUTO_UPDATE_DISABLED]` | 已关闭自动更新 | 告知用户之后会先询问再更新 |
| `[UPDATE_DEPS_FAILED]` | 代码已更新但依赖安装失败 | 在 skill 目录执行 `npm install` 后告知用户 |
| `[UPDATE_FAILED]` | 更新失败（已自动还原旧版本） | 告知用户失败原因 `REASON=`，可引导手动下载 https://otherfiles.uupt.com/skills/uupt-delivery.zip 重新安装 |
| `[ALREADY_LATEST]` | 已是最新版本 | 告知用户无需更新 |

更新不影响用户配置（`~/.uupt-delivery/`），**无需重新注册**；旧版本自动备份到 `~/.uupt-delivery/backup/`。

### 手动检查更新

用户主动询问"skill 有没有新版本"时执行（仅检查不更新）：

```bash
node scripts/self-update.js --check
```

---

## 配置管理

配置分为两层，优先级：**环境变量 > config.json > defaults.json**。

| 文件 | 内容 | 说明 |
|------|------|------|
| `defaults.json`（skill 目录） | appId、appSecret、apiUrl | 内置凭证，**请勿修改** |
| `~/.uupt-delivery/config.json` | openId、autoUpdate（或完整凭证） | 注册后自动生成或手动创建，保存在用户主目录，不受 skill 更新影响 |

### 环境变量

| 变量 | 说明 |
|------|------|
| `UUPT_APP_ID` | 应用 ID |
| `UUPT_APP_SECRET` | 应用密钥 |
| `UUPT_OPEN_ID` | 用户唯一标识 |
| `UUPT_API_URL` | API 地址（可选，默认生产环境） |
| `UUPT_SKIP_UPDATE_CHECK` | 设为 `1` 时禁用自动更新检测（可选） |

### API 环境

| 环境 | URL |
|------|-----|
| 生产环境 | `https://api-open.uupt.com/openapi/v3/` |

---

## 在代码中使用

### Node.js

```javascript
const { orderPrice, createOrder, orderDetail, cancelOrder, driverTrack } = require('./index');

// 配送询价
const price = await orderPrice({ fromAddress: '...', toAddress: '...', cityName: '郑州市' });
// 帮帮询价
const helpPrice = await orderPrice({ fromAddress: '...', orderType: 'help' });
// 创建订单
const order = await createOrder({ priceToken: price.body.priceToken, receiverPhone: '13800138000' });
// 帮帮订单（带 note）
const helpOrder = await createOrder({ priceToken: helpPrice.body.priceToken, receiverPhone: '13800138000', note: '帮帮内容' });
// 余额不足检测
if (order.body.orderUrl) console.log('支付链接:', order.body.orderUrl);
// 查询订单
const detail = await orderDetail({ orderCode: order.body.orderCode });
```

### Python

```python
from uupt_delivery import order_price, create_order, order_detail, cancel_order, driver_track

# 配送询价
price = order_price(from_address='...', to_address='...', city_name='郑州市')
# 帮帮询价
help_price = order_price(from_address='...', order_type='help')
# 创建订单
order = create_order(price_token=price['body']['priceToken'], receiver_phone='13800138000')
# 帮帮订单（带 note）
help_order = create_order(price_token=help_price['body']['priceToken'], receiver_phone='13800138000', note='帮帮内容')
# 余额不足检测
if order['body'].get('orderUrl'): print('支付链接:', order['body']['orderUrl'])
# 查询订单
detail = order_detail(order_code=order['body']['orderCode'])
```

---

## 注意事项

- **首次使用**：需通过手机号验证获取授权，之后无需重复。注册失败自动重试，最多 3 次（无需重新输入手机号）
- **图片验证码**：短信发送时若返回 `[IMAGE_CAPTCHA_REQUIRED]`，展示 base64 图片给用户识别后重试
- **询价有效期**：priceToken 有时效性，建议获取后尽快创建订单
- **价格单位**：API 返回的价格单位是分，展示时除以 100 转换为元
- **地址完整性**：地址越完整配送越准确。未指定城市默认"郑州市"
- **余额不足**：`[PAYMENT_REQUIRED]` 时，微信渠道用 `message` 发送二维码图片附件，其他渠道发送支付链接
- **帮帮订单**：必须传 `--note` 参数，fromAddress = toAddress；务必先确认服务地点与帮帮内容再下单。`note` 建议包含：事项类型（如陪诊/搬抬/保洁）、具体动作、时长或人数、特殊要求
- **跑腿配送**：必须有不同的起止地址；帮买场景建议用 `--note` 写清商品与规格；鲜花/蛋糕等易碎品可在 note 注明轻拿轻放、保温防震等要求
- **配置文件**：`defaults.json` 为内置凭证，请勿修改或删除
- **版本更新**：输出 `[UPDATE_AVAILABLE]` 时先完成当前任务再处理；`AUTO_UPDATE=true` 直接更新并告知，`AUTO_UPDATE=false` 必须按场景六话术征得用户同意后才执行更新

## 相关链接

- [UU跑腿开放平台](https://open.uupt.com/#/development/agentSkill/quickStart)
- [GitHub地址](https://github.com/uupt-mcp/uupt-delivery-skill)
