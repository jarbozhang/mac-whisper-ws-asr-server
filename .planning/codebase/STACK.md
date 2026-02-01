# 技术栈

**分析日期:** 2026-02-02

## 编程语言

**主要语言:**
- JavaScript (ES2020+) - 使用 ES 模块的服务器实现
- 原生 Shell (Bash) - 通过子进程用于 macOS 系统自动化

## 运行时环境

**环境:**
- Node.js 20+ (README 中指定的要求)

**包管理器:**
- npm
- 锁文件: `yarn.lock` 存在 (使用了 yarn)

## 框架

**核心框架:**
- `ws` 8.17.1 - WebSocket 服务器实现,提供 `WebSocketServer` 类

**工具库:**
- `uuid` 10.0.0 - UUID 生成,用于唯一请求 ID
- `dotenv` 16.4.5 - 从 `.env` 文件加载环境变量

**Node.js 内置 API:**
- `http` - HTTP 服务器创建和健康检查端点
- `child_process` - 执行外部二进制文件 (whisper.cpp, pbcopy, osascript)
- `fs/promises` - 异步文件操作 (读/写音频文件)
- `path` - 文件处理的路径操作
- `os` - OS 工具 (tmpdir 用于临时文件存储)

## 关键依赖

**核心依赖:**
- `ws` - 与 ESP32-S3 客户端和前端的核心 WebSocket 通信;实现实时双向流
- `uuid` - 确保并发场景中的唯一会话跟踪和请求识别
- `dotenv` - 配置安全所需 (身份验证令牌、外部二进制文件路径)

**音频处理:**
- Node.js 内置的 `fs` 和 `Buffer` - PCM 音频组装和 WAV 文件格式创建

## 配置

**环境配置:**
- 通过 `src/config.js` 中的 `dotenv/config` 加载配置
- 所有设置从 `.env` 文件派生,带有合理的默认值

**必需配置:**
- `AUTH_TOKEN` - WebSocket 授权的密钥令牌 (必须设置)
- `WHISPER_BIN` - whisper.cpp 二进制文件的绝对路径 (例如 `/usr/local/bin/whisper.cpp/main`)
- `WHISPER_MODEL` - GGML 模型文件的绝对路径 (例如 `/models/ggml-medium.bin`)

**可选配置:**
- `HOST` - 绑定地址 (默认: `0.0.0.0`)
- `PORT` - 监听端口 (默认: `8765`)
- `WHISPER_ARGS` - 传递给 whisper.cpp 的空格分隔参数 (例如 `--language zh --temperature 0`)
- `DEFAULT_MODE` - 默认文本注入模式: `return_only`, `paste`, 或 `paste_enter` (默认: `return_only`)
- `MAX_AUDIO_SEC` - 最大音频时长(秒) (默认: `30`)
- `SAMPLE_RATE` - 音频采样率(Hz) (默认: `16000`)
- `CHANNELS` - 音频通道数 (默认: `1`)
- `BIT_DEPTH` - 每样本位数 (默认: `16`)
- `KEEP_DEBUG` - 处理后保留临时 WAV 文件 (默认: `false`)

**构建配置:**
- `package.json` 指定 `"type": "module"` 以支持 ES 模块
- 主入口点: `src/server.js`

## 平台要求

**开发环境:**
- macOS (osascript 辅助功能和 pbcopy 剪贴板访问所需)
- 本地编译的 whisper.cpp 及其 `main` 二进制文件
- GGML 模型文件 (例如 ggml-medium.bin, ggml-large.bin)
- Node.js 20+

**生产环境:**
- macOS (如果使用 `paste` 或 `paste_enter` 模式,需要辅助功能权限进行文本注入)
- 配置路径下可访问的 whisper.cpp 二进制文件和模型文件
- ESP32-S3 设备到服务器端口 8765 的网络访问

**外部系统依赖:**
- `/usr/bin/pbcopy` - macOS 剪贴板工具,用于文本注入
- `/usr/bin/osascript` - macOS AppleScript 运行时,用于键盘模拟

---

*技术栈分析: 2026-02-02*
