# Mac Whisper WebSocket ASR Server

## What This Is

macOS 上的 Whisper 语音识别 WebSocket 服务器，接收来自 ESP32 设备的音频流，通过 whisper.cpp 进行语音识别，并将识别结果注入到活动应用程序中。同时支持接收硬件按钮命令来控制 Claude Code CLI。

## Core Value

通过 WebSocket 实现实时语音转文字，让用户可以用语音与 Claude Code 交互，并通过物理按钮快速执行常用操作。

## Requirements

### Validated

- ✓ WebSocket 音频流接收（PCM 格式） — existing
- ✓ whisper.cpp 语音识别引擎集成 — existing
- ✓ 文本注入到活动 macOS 应用（剪贴板 + 键盘模拟） — existing
- ✓ HTTP /health 健康检查端点 — existing
- ✓ HTTP /hook 端点用于 Claude Code hooks 广播 — existing
- ✓ Token 认证保护 — existing
- ✓ 串行处理队列防止资源争用 — existing

### Active

- [ ] 接收并解析 ESP32 按钮命令消息 (`type: "command"`)
- [ ] 将 `approve` 命令转换为 Claude Code 批准操作（Y/Enter）
- [ ] 将 `reject` 命令转换为 Claude Code 拒绝操作（N/Escape）
- [ ] 将 `switch_model` 命令转换为 Claude Code 切换模型操作（Option+P）
- [ ] 将 `toggle_auto_approve` 命令转换为 Claude Code 切换权限模式操作（Shift+Tab）
- [ ] 返回命令执行确认 (`type: "command_ack"`)

### Out of Scope

- 按钮命令认证 — 局域网环境，简化流程
- 命令执行状态反馈 — 只确认收到，不验证实际效果
- 其他 Claude Code 操作 — 只支持四个核心按钮

## Context

**硬件环境:**
- ESP32-S3 设备通过 WebSocket 连接发送音频和命令
- 四个 GPIO 按钮：Approve(5)、Reject(6)、Switch Model(7)、Toggle Auto-approve(8)

**ESP32 命令消息格式:**
```json
{"type": "command", "action": "approve"}
{"type": "command", "action": "reject"}
{"type": "command", "action": "switch_model"}
{"type": "command", "action": "toggle_auto_approve"}
```

**Claude Code 键盘映射:**
| 动作 | 快捷键 |
|------|--------|
| approve | Y 或 Enter |
| reject | N 或 Escape |
| switch_model | Option+P (macOS) |
| toggle_auto_approve | Shift+Tab |

**现有架构:**
- `src/server.js` — WebSocket 服务器主逻辑
- `src/inject.js` — 使用 osascript 进行键盘模拟
- `src/config.js` — 配置管理

## Constraints

- **平台**: macOS only — 依赖 osascript 进行键盘模拟
- **技术栈**: Node.js ES 模块 — 保持与现有代码风格一致
- **兼容性**: 不破坏现有音频流功能

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 按钮命令不需要认证 | 局域网环境，简化 ESP32 端实现 | — Pending |
| 使用 osascript 模拟按键 | 复用现有 inject.js 架构 | — Pending |
| 返回简单 ack 而非状态 | 保持协议简洁，ESP32 端不需要复杂处理 | — Pending |

---
*Last updated: 2026-02-03 after initialization*
