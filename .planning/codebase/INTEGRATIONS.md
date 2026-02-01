# 外部集成

**分析日期:** 2026-02-02

## ASR 引擎

**whisper.cpp:**
- 类型: 本地 CLI 二进制文件
- 集成方式: 通过 `child_process.spawn()` 调用
- 配置: `WHISPER_BIN` (二进制路径), `WHISPER_MODEL` (模型路径), `WHISPER_ARGS` (额外参数)
- 输入: 临时 WAV 文件
- 输出: 文本文件 (与 WAV 同名,扩展名 `.txt`)
- 错误处理: 通过 stderr 捕获,非零退出码触发拒绝
- 文档: `src/whisper.js`
- 示例调用:
  ```javascript
  const { text, ms, outTxt } = await runWhisper({
    whisperBin: config.whisperBin,
    modelPath: config.whisperModel,
    wavPath: '/tmp/uuid.wav',
    extraArgs: ['--language', 'zh', '--temperature', '0']
  });
  ```

## 客户端通信

**WebSocket 服务器:**
- 协议: WebSocket (ws://)
- 端点: `ws://<host>:<port>/ws`
- 端口: 默认 8765 (可通过 `PORT` 环境变量配置)
- 消息格式:
  - 控制消息: JSON 文本帧
  - 音频数据: 二进制帧 (原始 PCM)
- 消息类型:
  - 客户端发送: `start`, `end`, `cancel`, 二进制音频块
  - 服务器发送: `ack`, `result`, `error`, `progress`
- 认证: 基于令牌 (在 `start` 消息中的 `token` 字段)
- 文档: `src/server.js`

**示例消息协议:**
```javascript
// 客户端 -> 服务器: 开始会话
{
  type: 'start',
  token: 'AUTH_TOKEN',
  reqId: 'uuid-v4',
  mode: 'return_only' | 'paste' | 'paste_enter',
  format: 'pcm_s16le',
  sampleRate: 16000,
  channels: 1,
  bitDepth: 16
}

// 服务器 -> 客户端: 确认
{ type: 'ack', reqId: 'uuid-v4', status: 'ready' }

// 客户端 -> 服务器: 音频数据 (二进制帧)
<PCM 数据 Buffer>

// 服务器 -> 客户端: 进度 (可选,每 ~256KB)
{ type: 'progress', reqId: 'uuid-v4', bytes: 262144 }

// 客户端 -> 服务器: 结束会话
{ type: 'end', reqId: 'uuid-v4' }

// 服务器 -> 客户端: 识别结果
{
  type: 'result',
  reqId: 'uuid-v4',
  text: '识别的文本',
  ms: 1234,
  engine: 'whisper.cpp'
}

// 服务器 -> 客户端: 错误
{ type: 'error', reqId: 'uuid-v4', message: '错误描述' }
```

## 身份验证

**机制:**
- 单一共享令牌 (通过 `AUTH_TOKEN` 环境变量)
- 在 `start` 消息中验证
- 验证失败: 发送 `error` 消息,关闭连接
- 无会话管理或每用户令牌
- 无令牌刷新或过期

**安全考虑:**
- 令牌以明文通过 WebSocket 发送
- 建议在生产环境使用 WSS (WebSocket Secure/TLS)
- 无速率限制或暴力破解保护

## 文件存储

**临时文件:**
- 位置: `os.tmpdir()` (macOS 上通常是 `/tmp`)
- 文件类型:
  - WAV 文件: `${uuid}.wav` (PCM 转换为 WAV)
  - 文本文件: `${uuid}.txt` (whisper.cpp 输出)
- 生命周期:
  - 创建: 在 `end` 消息处理期间
  - 删除: 处理后立即 (如果 `KEEP_DEBUG=false`)
  - 保留: 如果 `KEEP_DEBUG=true` 用于调试
- 清理: `safeUnlink()` 函数 (静默忽略错误)

## macOS 系统集成

**剪贴板访问 (pbcopy):**
- 命令: `/usr/bin/pbcopy`
- 用途: 将识别文本复制到系统剪贴板
- 使用场景: `mode` 为 `paste` 或 `paste_enter` 时
- 错误处理: Promise 拒绝,错误码非零
- 文档: `src/inject.js:3-10`

**键盘自动化 (osascript):**
- 命令: `/usr/bin/osascript -e 'tell application "System Events" to keystroke "v" using command down'`
- 用途: 模拟 Cmd+V 粘贴操作
- 扩展: 可选择添加 `keystroke return` (如果 `mode === 'paste_enter'`)
- 权限: 需要辅助功能权限
- 错误处理: Promise 拒绝,错误码非零
- 文档: `src/inject.js:12-21`

## 数据库

**无数据库集成:**
- 所有数据都是临时的 (内存中的会话状态,临时文件)
- 无持久化存储
- 无用户数据库或会话存储

## 缓存

**无缓存层:**
- 每个音频请求都进行新的转录
- 无结果缓存或去重
- 无 Redis 或内存缓存

## 日志记录

**控制台输出:**
- 机制: `console.log()` 和 `console.error()`
- 内容:
  - 服务器启动: 主机、端口、路径
  - 连接事件: 客户端连接、远程地址
  - 配置错误: 缺少 AUTH_TOKEN
- 无结构化日志记录
- 无日志聚合或外部日志服务

## 监控

**健康检查端点:**
- 路径: `/health`
- 方法: HTTP GET
- 响应:
  ```json
  {
    "status": "ok",
    "uptime": 12345,
    "engine": "whisper.cpp"
  }
  ```
- 用途: 负载均衡器健康检查,运行时间监控

**无外部监控:**
- 无 Prometheus 指标
- 无 APM 集成
- 无错误跟踪 (例如 Sentry)

## 第三方 API

**无第三方 API 调用:**
- 所有处理都在本地完成
- 无云 ASR 服务 (例如 Google Speech, AWS Transcribe)
- 无外部 webhook 或回调

## Webhook

**无 webhook 支持:**
- 无出站 webhook
- 无入站 webhook 处理

---

*集成分析: 2026-02-02*
