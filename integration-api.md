# xiaozhi-esp32-server 完整对接文档

> 本文档基于源码逐行分析生成，覆盖所有 HTTP、WebSocket、MQTT 通讯接口的入参、出参、字段含义及枚举值。

---

## 目录

1. [系统架构概览](#1-系统架构概览)
2. [HTTP 接口](#2-http-接口)
   - 2.1 [POST /xiaozhi/ota/ — 设备注册与配置下发](#21-post-xiaozhi-ota--设备注册与配置下发)
   - 2.2 [GET /xiaozhi/ota/ — OTA 状态查询](#22-get-xiaozhi-ota--ota-状态查询)
   - 2.3 [GET /xiaozhi/ota/download/{filename} — 固件下载](#23-get-xiaozhi-otadownloadfilename--固件下载)
   - 2.4 [POST /mcp/vision/explain — 视觉分析](#24-post-mcpvisionexplain--视觉分析)
   - 2.5 [GET /mcp/vision/explain — 视觉接口状态查询](#25-get-mcpvisionexplain--视觉接口状态查询)
3. [WebSocket 接口](#3-websocket-接口)
   - 3.1 [连接参数与认证](#31-连接参数与认证)
   - 3.2 [握手消息 hello](#32-握手消息-hello)
   - 3.3 [客户端 → 服务端消息](#33-客户端--服务端消息)
   - 3.4 [服务端 → 客户端消息](#34-服务端--客户端消息)
   - 3.5 [完整会话时序图](#35-完整会话时序图)
4. [MQTT 配置对接](#4-mqtt-配置对接)

---

## 1. 系统架构概览

```
ESP32 设备
    │
    ├─ 启动时 ──────→ POST /xiaozhi/ota/（HTTP 8003）
    │                   └─← 返回 websocket 或 mqtt 配置
    │
    ├─ 直连模式 ────→ ws://server:8000/xiaozhi/v1/（WebSocket）
    │
    └─ 网关模式 ────→ MQTT Broker
                         └──→ ws://server:8000/xiaozhi/v1/?from=mqtt_gateway
```

| 服务 | 端口 | 协议 |
|------|------|------|
| WebSocket 主服务 | 8000（默认） | WebSocket |
| HTTP 辅助服务 | 8003（默认） | HTTP |

---

## 2. HTTP 接口

所有接口均支持 CORS，响应头包含：

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: client-id, content-type, device-id, authorization
Access-Control-Allow-Methods: GET, POST, OPTIONS
```

---

### 2.1 `POST /xiaozhi/ota/` — 设备注册与配置下发

**功能**：设备上电后调用，获取连接配置（WebSocket 或 MQTT）及固件更新信息。

#### 请求头

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `device-id` | string | **必填** | 设备 MAC 地址，示例：`11:22:33:44:55:66` |
| `client-id` | string | **必填** | 客户端标识符 |
| `device-model` / `device_model` / `model` | string | 可选 | 设备型号，用于固件版本匹配（三选一，优先级依序递减） |
| `device-version` / `device_version` / `firmware-version` / `app-version` / `application-version` | string | 可选 | 当前固件版本号（五选一，优先级依序递减） |
| `Authorization` | string | 条件必填 | 开启认证时需要，格式：`Bearer {token}` |

#### 请求体（Body，JSON）

```json
{
  "board": {
    "type": "设备型号（Header 中未传时使用）"
  },
  "application": {
    "version": "当前固件版本（Header 中未传时使用）"
  }
}
```

> Header 中的值优先于 Body；Body 也可为空或省略。

#### 响应体

**公共字段（两种场景均包含）：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `server_time.timestamp` | int | 服务器当前时间戳（毫秒，Unix epoch） |
| `server_time.timezone_offset` | int | 时区偏移（分钟），默认 `480`（东八区） |
| `firmware.version` | string | 推荐固件版本号；无更新则返回设备当前版本 |
| `firmware.url` | string | 固件下载地址；无更新则为空字符串 `""` |

---

**场景一：未配置 MQTT 网关 → 返回 WebSocket 配置**

```json
{
  "server_time": {
    "timestamp": 1716192000000,
    "timezone_offset": 480
  },
  "firmware": {
    "version": "1.2.3",
    "url": ""
  },
  "websocket": {
    "url": "ws://192.168.1.100:8000/xiaozhi/v1/",
    "token": ""
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `websocket.url` | string | WebSocket 服务地址 |
| `websocket.token` | string | JWT Token；认证关闭或设备在白名单时为 `""`；开启认证时为 Bearer Token |

---

**场景二：配置了 MQTT 网关 → 返回 MQTT 配置**

```json
{
  "server_time": { "timestamp": 1716192000000, "timezone_offset": 480 },
  "firmware": { "version": "1.2.3", "url": "" },
  "mqtt": {
    "endpoint": "mqtt.example.com:1883",
    "client_id": "GID_esp32s3@@@11_22_33_44_55_66@@@11_22_33_44_55_66",
    "username": "eyJpcCI6InVua25vd24ifQ==",
    "password": "Base64EncodedHMAC...",
    "publish_topic": "device-server",
    "subscribe_topic": "devices/p2p/11_22_33_44_55_66"
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `mqtt.endpoint` | string | MQTT Broker 地址，格式 `host:port` |
| `mqtt.client_id` | string | 生成规则：`GID_{model_safe}@@@{mac_safe}@@@{mac_safe}`，其中 `mac_safe` 将 `:` 替换为 `_` |
| `mqtt.username` | string | Base64 编码，内容：`{"ip":"unknown"}` |
| `mqtt.password` | string | HMAC-SHA256 签名（Base64），内容见 §4.4 |
| `mqtt.publish_topic` | string | 设备上行 Topic，固定值：`device-server` |
| `mqtt.subscribe_topic` | string | 设备下行 Topic，格式：`devices/p2p/{mac_safe}` |

---

**错误响应：**

```json
{ "success": false, "message": "request error." }
```

---

### 2.2 `GET /xiaozhi/ota/` — OTA 状态查询

**功能**：确认 OTA 接口是否正常，返回纯文本。

**响应（text/plain）：**

```
OTA接口运行正常，向设备发送的websocket地址是：ws://192.168.1.100:8000/xiaozhi/v1/
```

---

### 2.3 `GET /xiaozhi/ota/download/{filename}` — 固件下载

**功能**：下载 `data/bin/` 目录下的固件文件。

#### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `filename` | string | 固件文件名，格式：`{model}_{version}.bin`，仅允许字母、数字、`.`、`_`、`-` |

#### 响应

| 状态码 | 说明 |
|--------|------|
| 200 | 返回文件流（application/octet-stream） |
| 400 | `filename required` 或 `invalid filename` |
| 403 | 路径穿越攻击被拦截 |
| 404 | `file not found` |
| 500 | `download error` |

---

### 2.4 `POST /mcp/vision/explain` — 视觉分析

**功能**：上传图片并获取 AI 视觉分析结果，需要认证。

#### 请求头

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `Authorization` | string | **必填** | 格式：`Bearer {token}` |
| `Device-Id` | string | **必填** | 设备 ID，必须与 Token 绑定的设备一致 |
| `Client-Id` | string | 可选 | 值为 `web_test_client` 时跳过认证（测试模式） |
| `Content-Type` | string | **必填** | 固定值：`multipart/form-data` |

#### 请求体（multipart/form-data，字段顺序固定）

| 顺序 | 字段名 | 类型 | 必填 | 说明 |
|------|--------|------|------|------|
| 第 1 个 | `question` | text | **必填** | 对图片提问的内容 |
| 第 2 个 | `image` | file | **必填** | 图片文件，支持 JPEG/PNG/GIF/BMP/TIFF/WEBP，最大 **5MB** |

#### 响应体

**成功（HTTP 200）：**

```json
{
  "success": true,
  "action": "RESPONSE",
  "response": "图片中显示了一只猫..."
}
```

**认证失败（HTTP 401）：**

```json
{ "success": false, "message": "无效的认证token或token已过期" }
```

**业务错误（HTTP 200）：**

```json
{ "success": false, "message": "错误描述" }
```

**常见 `message` 值：**

| message | 原因 |
|---------|------|
| `无效的认证token或token已过期` | Token 验证失败（HTTP 401） |
| `设备ID与token不匹配` | Header Device-Id 与 Token 不符 |
| `缺少问题字段` | multipart 缺少 question |
| `缺少图片文件` | multipart 缺少图片 |
| `图片数据为空` | 图片内容为空 |
| `图片大小超过限制，最大允许5.0MB` | 文件超过 5MB |
| `不支持的文件格式，请上传有效的图片文件（支持JPEG、PNG、GIF、BMP、TIFF、WEBP格式）` | 格式不支持 |
| `您还未设置默认的视觉分析模块` | 服务端未配置 VLLM 模块 |
| `处理请求时发生错误` | 服务端内部错误 |

---

### 2.5 `GET /mcp/vision/explain` — 视觉接口状态查询

**功能**：确认视觉接口是否正常配置，返回纯文本。

**响应（text/plain）：**

```
MCP Vision 接口运行正常，视觉解释接口地址是：http://192.168.1.100:8003/mcp/vision/explain
```

---

## 3. WebSocket 接口

### 3.1 连接参数与认证

#### 连接 URL

```
ws://{ip}:8000/xiaozhi/v1/
```

#### 方式一：请求头传参（推荐）

| Header | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `device-id` | string | **必填** | 设备 MAC 地址 |
| `client-id` | string | 可选 | 客户端标识符 |
| `authorization` | string | 条件必填 | 格式：`Bearer {token}` |

#### 方式二：Query 参数传参（备用）

```
ws://{ip}:8000/xiaozhi/v1/?device-id=11:22:33:44:55:66&client-id=xxx&authorization=Bearer+{token}
```

#### 认证逻辑

```
认证关闭（默认）→ 所有设备直接连接

认证开启（server.auth.enabled = true）
  ├── device-id 在白名单 → 直接放行
  └── 不在白名单
        ├── 无 Authorization → 发送"认证失败"，关闭连接
        ├── Token 格式错误 → 同上
        └── Token 验证通过 → 连接建立
```

**Token 来源**：`POST /xiaozhi/ota/` 响应中的 `websocket.token` 字段。

#### 连接被拒绝时的纯文本响应

| 文本内容 | 原因 |
|---------|------|
| `端口正常，如需测试连接，请启动digital-human测试` | 缺少 device-id（连接随即关闭） |
| `认证失败` | Token 验证失败（连接随即关闭） |

#### MQTT 网关特殊标记

```
ws://{ip}:8000/xiaozhi/v1/?from=mqtt_gateway
```

通过此标记，服务端识别连接来自 MQTT 网关，音频收发切换为 16 字节头格式。

---

### 3.2 握手消息 hello

连接建立后，**客户端主动发送**首条消息，服务端回应。

#### 客户端发送

```json
{
  "type": "hello",
  "version": 3,
  "transport": "websocket",
  "audio_params": {
    "format": "opus",
    "sample_rate": 16000,
    "channels": 1,
    "frame_duration": 60
  },
  "features": {
    "mcp": true,
    "emoji": true
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | string | **必填** | 固定值 `"hello"` |
| `audio_params.format` | string | 可选 | 音频格式，支持 `"opus"` |
| `audio_params.sample_rate` | int | 可选 | 采样率：`8000/12000/16000/24000/48000` |
| `audio_params.channels` | int | 可选 | 声道数，通常为 `1` |
| `audio_params.frame_duration` | int | 可选 | 帧时长（ms），通常为 `60` |
| `features.mcp` | bool | 可选 | `true` 表示支持 MCP 协议，服务端将自动发起 initialize |
| `features.emoji` | bool | 可选 | `false` 表示禁止接收情绪消息（默认 `true`，即接收） |

#### 服务端响应

```json
{
  "type": "hello",
  "version": 1,
  "transport": "websocket",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "audio_params": {
    "format": "opus",
    "sample_rate": 24000,
    "channels": 1,
    "frame_duration": 60
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `session_id` | string | 本次会话唯一 ID（UUID），**后续所有服务端消息均携带此字段** |
| `audio_params` | object | 服务端最终使用的音频参数（若客户端发送了则回显） |

---

### 3.3 客户端 → 服务端消息

> 以下所有消息均为 **JSON 文本帧**。

#### `listen` — 录音状态控制

```json
{ "type": "listen", "mode": "auto", "state": "start" }
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `mode` | string | 可选 | 拾音模式：`"auto"`（VAD 自动检测）/ `"manual"`（按键控制）|
| `state` | string | **必填** | 见下表 |
| `text` | string | 条件必填 | 仅 `state="detect"` 时携带，设备端本地识别的文字 |

**`state` 枚举：**

| 值 | 说明 |
|----|------|
| `"start"` | 切换到录音模式，清空缓冲区；之后持续发送**二进制 Opus 帧** |
| `"stop"` | 用户停止说话，触发 ASR 识别 |
| `"detect"` | 设备端已完成本地识别，用 `text` 字段直接发起对话 |

#### `iot` — IoT 设备描述符与状态上报

```json
{
  "type": "iot",
  "descriptors": [
    {
      "name": "Speaker",
      "description": "扬声器",
      "properties": {
        "volume": { "description": "音量 0-100", "type": "number" },
        "is_muted": { "description": "是否静音", "type": "boolean" }
      },
      "methods": {
        "SetVolume": {
          "description": "设置音量",
          "parameters": {
            "volume": { "description": "音量值", "type": "number" }
          }
        }
      }
    }
  ],
  "states": [
    {
      "name": "Speaker",
      "state": { "volume": 80, "is_muted": false }
    }
  ]
}
```

**`descriptors` 元素字段：**

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | **必填** | 设备唯一名称 |
| `description` | **必填** | 设备描述（供 LLM 理解） |
| `properties` | 条件必填 | 属性定义，与 `methods` 至少有一个 |
| `methods` | 条件必填 | 方法定义，与 `properties` 至少有一个 |

**属性 `type` 枚举：** `"number"`（初始值 `0`）/ `"boolean"`（初始值 `false`）/ `"string"`（初始值 `""`）

**`states` 元素字段：**

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | **必填** | 设备名称，对应 `descriptors.name` |
| `state` | **必填** | 键值对，key 为属性名，value 为当前值（类型须与定义一致） |

#### `mcp` — MCP 协议透传

```json
{
  "type": "mcp",
  "payload": { "jsonrpc": "2.0", "id": 1, "result": { ... } }
}
```

客户端响应服务端 MCP 请求时使用，`payload` 遵循 JSON-RPC 2.0 规范。详见 §3.4 MCP 请求说明。

#### `server` — 服务器配置管理

```json
{
  "type": "server",
  "action": "update_config",
  "content": { "secret": "your-api-secret" }
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `action` | **必填** | `"update_config"` 热更新配置 / `"restart"` 重启服务 |
| `content.secret` | **必填** | 对应 `manager-api.secret`，鉴权用 |

> 仅在服务端 `read_config_from_api = true`（智控台模式）时生效。

#### `ping` — 心跳保活

```json
{ "type": "ping" }
```

> 服务端默认**不响应**（`enable_websocket_ping` 默认 `false`）。

#### `abort` — 中止当前操作

```json
{ "type": "abort" }
```

服务端收到后立即中止当前 TTS 播放和 LLM 推理，并回发一条 `{"type":"tts","state":"stop",...}`。

#### 二进制帧 — Opus 音频上行

在 `listen.state = "start"` 之后，持续以**二进制 WebSocket 帧**发送：

- **直连模式**：裸 Opus 数据包
- **MQTT 网关模式**：16 字节头 + Opus（格式同下行，见 §3.4）

---

### 3.4 服务端 → 客户端消息

#### `tts` — TTS 播放状态通知

```json
{
  "type": "tts",
  "state": "sentence_start",
  "session_id": "...",
  "text": "你好，我是小智！"
}
```

| 字段 | 说明 |
|------|------|
| `state` | 见下表 |
| `text` | 仅 `state="sentence_start"` 时携带，本句文本 |

**`state` 枚举：**

| 值 | 时机 | 客户端行为建议 |
|----|------|--------------|
| `"start"` | TTS 开始 | 停止录音，切换为播放模式，显示说话动画 |
| `"sentence_start"` | 每句音频发送前 | 显示本句字幕（`text` 字段） |
| `"stop"` | 全部 TTS 完成 | 停止播放动画，切回录音等待状态 |

**完整时序：**

```
→ {"type":"tts","state":"start","session_id":"..."}
→ {"type":"tts","state":"sentence_start","session_id":"...","text":"第一句"}
→ [binary] opus × N
→ {"type":"tts","state":"sentence_start","session_id":"...","text":"第二句"}
→ [binary] opus × N
→ {"type":"tts","state":"stop","session_id":"..."}
```

#### `stt` — ASR 识别结果

```json
{ "type": "stt", "text": "今天天气怎么样", "session_id": "..." }
```

| 字段 | 说明 |
|------|------|
| `text` | 识别出的文本（已去除首尾标点和 emoji） |

> `stt` 消息发出后，服务端会**立即跟发** `{"type":"tts","state":"start",...}`。

#### `llm` — 情绪表情通知

每轮对话中 LLM 回复的第一个内容块若含 emoji，服务端自动发送（每轮最多一次）。

```json
{
  "type": "llm",
  "text": "😊",
  "emotion": "happy",
  "session_id": "..."
}
```

**`emotion` 枚举（全部 20 个值）：**

| emoji | emotion | emoji | emotion |
|-------|---------|-------|---------|
| 😂 | `funny` | 😌 | `relaxed` |
| 😭 | `crying` | 😴 | `sleepy` |
| 😠 | `angry` | 😜 | `silly` |
| 😔 | `sad` | 🙄 | `confused` |
| 😍 | `loving` | 😶 | `neutral` |
| 😲 | `surprised` | 🙂 | `happy`（默认）|
| 😱 | `shocked` | 😆 | `laughing` |
| 🤔 | `thinking` | 😳 | `embarrassed` |
| 😉 | `winking` | 😎 | `cool` |
| 🤤 | `delicious` | 😘 | `kissy` |
| 😏 | `confident` | | |

> 在 `hello` 消息中设置 `"features":{"emoji":false}` 可禁用此消息。

#### `pong` — 心跳响应

```json
{ "type": "pong", "timestamp": "2025-05-21 10:30:00" }
```

| 字段 | 说明 |
|------|------|
| `timestamp` | 服务器本地时间，格式：`"YYYY-MM-DD HH:MM:SS"` |

> 仅 `enable_websocket_ping = true` 时响应。

#### `server` — 配置操作结果

```json
{
  "type": "server",
  "status": "success",
  "message": "配置更新成功",
  "content": { "action": "update_config" }
}
```

| 字段 | 说明 |
|------|------|
| `status` | `"success"` / `"error"` |
| `message` | 操作结果描述 |
| `content.action` | 回显请求的 action |

**常见 `message` 值：**

| message | 原因 |
|---------|------|
| `服务器密钥验证失败` | secret 不匹配 |
| `配置更新成功` | update_config 成功 |
| `服务器重启中...` | restart 已接受 |
| `更新配置失败: {详情}` | 热更新异常 |
| `Restart failed: {详情}` | 重启异常 |

#### `mcp` — MCP 协议请求（服务端主动发起）

服务端向设备端发起 MCP 请求，外层格式：

```json
{ "type": "mcp", "payload": { "jsonrpc": "2.0", "id": N, "method": "...", "params": {...} } }
```

**三种请求及对应响应：**

**① `initialize`（id=1，握手后自动发送）**

```json
{
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "roots": { "listChanged": true },
      "sampling": {},
      "vision": { "url": "http://host:8003/mcp/vision/explain", "token": "eyJ..." }
    },
    "clientInfo": { "name": "XiaozhiClient", "version": "1.0.0" }
  }
}
```

客户端响应：

```json
{
  "type": "mcp",
  "payload": {
    "jsonrpc": "2.0", "id": 1,
    "result": { "serverInfo": { "name": "ESP32Device", "version": "1.0.0" } }
  }
}
```

**② `tools/list`（id=2，initialize 响应后发送）**

```json
{ "method": "tools/list" }
```

客户端响应：

```json
{
  "type": "mcp",
  "payload": {
    "jsonrpc": "2.0", "id": 2,
    "result": {
      "tools": [
        {
          "name": "SetLight",
          "description": "控制灯的开关",
          "inputSchema": {
            "type": "object",
            "properties": { "on": { "type": "boolean", "description": "是否开灯" } },
            "required": ["on"]
          }
        }
      ]
    }
  }
}
```

**③ `tools/call`（id=3+，LLM 决定调用工具时发送）**

```json
{
  "method": "tools/call",
  "params": { "name": "SetLight", "arguments": { "on": true } }
}
```

客户端响应（成功）：

```json
{
  "type": "mcp",
  "payload": { "jsonrpc": "2.0", "id": 3, "result": { "content": [{ "type": "text", "text": "已开灯" }] } }
}
```

客户端响应（失败）：

```json
{
  "type": "mcp",
  "payload": { "jsonrpc": "2.0", "id": 3, "error": { "message": "设备不可用" } }
}
```

#### `iot` — IoT 控制命令（服务端主动下发）

LLM 决定控制设备时服务端下发：

```json
{
  "type": "iot",
  "commands": [
    {
      "name": "Speaker",
      "method": "SetVolume",
      "parameters": { "volume": 80 }
    }
  ]
}
```

| 字段 | 说明 |
|------|------|
| `commands[].name` | 设备名称（对应 descriptors 上报的 name） |
| `commands[].method` | 方法名称（对应 methods 定义的方法名） |
| `commands[].parameters` | 方法参数；无参数时不携带此字段 |

#### 二进制帧 — Opus 音频下行

**模式一：直连 WebSocket**

裸 Opus 数据包，无任何头部。

- 编码：Opus
- 采样率：握手协商的 `sample_rate`（默认 `24000 Hz`）
- 声道：单声道
- 帧时长：60ms

**模式二：MQTT 网关（URL 含 `?from=mqtt_gateway`）**

16 字节固定头 + Opus 数据：

```
Byte 0      : type = 0x01（固定）
Byte 1      : 保留 = 0x00
Byte 2–3    : payload length（Opus 数据长度，大端序 2 字节）
Byte 4–7    : sequence（包序号，从 0 递增，大端序 4 字节）
Byte 8–11   : timestamp（Unix 毫秒 % 2³²，大端序 4 字节）
Byte 12–15  : audio length（Opus 数据长度，大端序 4 字节，同 Byte 2–3）
Byte 16+    : Opus 编码音频数据
```

---

### 3.5 完整会话时序图

```
客户端                                          服务端
  │                                               │
  │──[WS 连接，携带 device-id]──────────────────→│
  │                                               │
  │──{"type":"hello","audio_params":{...}}──────→│
  │←─{"type":"hello","session_id":"..."}──────────│
  │  （若 features.mcp=true，服务端自动发送↓）    │
  │←─{"type":"mcp","payload":{"method":"initialize",...}}──│
  │──{"type":"mcp","payload":{"id":1,"result":{...}}}────→│
  │←─{"type":"mcp","payload":{"method":"tools/list"}}──────│
  │──{"type":"mcp","payload":{"id":2,"result":{"tools":[...]}}}→│
  │                                               │
  │──{"type":"listen","state":"start"}──────────→│
  │──[binary] Opus 音频帧 × N────────────────────→│
  │──{"type":"listen","state":"stop"}───────────→│
  │                                               │ (ASR 识别)
  │←─{"type":"stt","text":"用户说的话"}────────────│
  │←─{"type":"tts","state":"start"}───────────────│
  │←─{"type":"llm","text":"😊","emotion":"happy"}─│ (可选)
  │←─{"type":"tts","state":"sentence_start","text":"回复"}│
  │←─[binary] Opus 音频帧 × N─────────────────────│
  │←─{"type":"tts","state":"stop"}────────────────│
  │                                               │
  │  （若 LLM 决定控制设备）                       │
  │←─{"type":"iot","commands":[...]}──────────────│
  │  （或调用 MCP 工具）                           │
  │←─{"type":"mcp","payload":{"method":"tools/call",...}}──│
  │──{"type":"mcp","payload":{"id":N,"result":{...}}}────→│
```

---

## 4. MQTT 配置对接

### 4.1 架构说明

本服务本身**不是 MQTT Broker**，MQTT 模式依赖外部网关代理：

```
ESP32 ──[MQTT]──→ MQTT Broker（网关）──[WebSocket ?from=mqtt_gateway]──→ 本服务
```

### 4.2 连接参数

参数全部由 `POST /xiaozhi/ota/` 响应的 `mqtt` 字段下发，设备直接使用：

| 参数 | 说明 |
|------|------|
| `endpoint` | MQTT Broker 地址（`host:port`） |
| `client_id` | MQTT Client ID（见 §4.3） |
| `username` | Base64 编码的 JSON：`{"ip":"unknown"}` |
| `password` | HMAC-SHA256 签名（见 §4.4） |
| `publish_topic` | 上行 Topic，固定：`device-server` |
| `subscribe_topic` | 下行 Topic，格式：`devices/p2p/{mac_safe}` |

### 4.3 `client_id` 生成规则

```
GID_{device_model_safe}@@@{mac_safe}@@@{mac_safe}
```

`mac_safe`：MAC 地址将 `:` 替换为 `_`，如 `11_22_33_44_55_66`

### 4.4 `password` 签名算法

```
内容 = client_id + "|" + username
算法 = HMAC-SHA256（密钥为服务端 mqtt_signature_key）
编码 = Base64
```

未配置 `mqtt_signature_key` 时，`password` 为空字符串。

### 4.5 消息格式

MQTT 消息格式与 WebSocket **完全相同**：

- **文本消息**：所有 JSON 格式不变（hello、listen、tts、stt 等全部适用）
- **音频消息**：**强制**使用 16 字节头格式（见 §3.4 二进制帧 模式二）

### 4.6 完整接入流程

```
1. 设备上电
   POST /xiaozhi/ota/ → 获取 mqtt 配置

2. 连接 MQTT Broker
   使用 endpoint / client_id / username / password

3. 订阅下行 Topic
   subscribe_topic = devices/p2p/{mac_safe}

4. 握手
   发布到 device-server:  {"type":"hello","audio_params":{...}}
   收到来自 subscribe_topic: {"type":"hello","session_id":"...","audio_params":{...}}

5. 正常对话
   上行：发布文本/二进制到 device-server
   下行：接收来自 devices/p2p/{mac_safe} 的文本/二进制
```

---

*文档生成时间：2025-05-21*
*基于源码版本：xiaozhi-esp32-server main 分支*
