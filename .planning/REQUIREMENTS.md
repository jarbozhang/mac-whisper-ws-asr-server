# Requirements: Mac Whisper WebSocket ASR Server

**Defined:** 2026-02-03
**Core Value:** 通过 WebSocket 实现实时语音转文字，让用户可以用语音与 Claude Code 交互，并通过物理按钮快速执行常用操作

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Command Parsing

- [ ] **CMD-01**: 服务器能接收并解析 `{"type": "command", "action": "..."}` 格式的 JSON 消息
- [ ] **CMD-02**: 对于未知的 action 值，返回错误消息

### Keyboard Simulation

- [ ] **KEY-01**: `approve` 命令发送 Enter 键到活动应用
- [ ] **KEY-02**: `reject` 命令发送 Escape 键到活动应用
- [ ] **KEY-03**: `switch_model` 命令发送 Option+P 组合键到活动应用
- [ ] **KEY-04**: `toggle_auto_approve` 命令发送 Shift+Tab 组合键到活动应用

### Response Protocol

- [ ] **RSP-01**: 命令执行后返回 `{"type": "command_ack", "action": "...", "success": true}` 确认消息
- [ ] **RSP-02**: 命令执行失败时返回包含错误信息的响应

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Extended Commands

- **EXT-01**: 支持自定义键盘快捷键映射配置
- **EXT-02**: 支持更多 Claude Code 操作（如 /clear, /help 等）

### Feedback

- **FBK-01**: 广播命令执行状态到所有连接的客户端

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| 命令认证 | 局域网环境，简化流程 |
| 命令执行状态验证 | 只确认收到，不验证 Claude Code 实际响应 |
| 命令队列 | 按钮操作即时执行，无需排队 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CMD-01 | Phase 1 | Pending |
| CMD-02 | Phase 1 | Pending |
| KEY-01 | Phase 1 | Pending |
| KEY-02 | Phase 1 | Pending |
| KEY-03 | Phase 1 | Pending |
| KEY-04 | Phase 1 | Pending |
| RSP-01 | Phase 1 | Pending |
| RSP-02 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 8 total
- Mapped to phases: 8
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-03*
*Last updated: 2026-02-03 after initial definition*
