# Roadmap: Mac Whisper WebSocket ASR Server — 按钮命令功能

## Overview

在已有的 WebSocket 音频流服务器基础上，添加 ESP32 硬件按钮命令的接收、解析、键盘模拟和确认回复能力。三个阶段依次交付：命令路由层、键盘动作层、响应协议层，每阶段独立可验证。

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: 命令路由** - 解析和验证 ESP32 发送的命令消息，未知命令返回错误
- [x] **Phase 2: 键盘动作** - 将四种按钮命令映射到对应的 macOS 键盘快捷键并执行
- [x] **Phase 3: 响应协议** - 命令执行后向 ESP32 返回确认或错误响应
- [ ] **Phase 4: 语言输出规范化** - 确保 Whisper 稳定输出简体中文和英语，避免繁体中文

## Phase Details

### Phase 1: 命令路由
**Goal**: 服务器能正确识别和验证来自 ESP32 的命令消息，将合法命令路由到处理链，非法命令得到明确的错误反馈
**Depends on**: Nothing (existing WebSocket server already handles connections)
**Requirements**: [CMD-01, CMD-02]
**Success Criteria** (what must be TRUE):
  1. 服务器收到 `{"type": "command", "action": "approve"}` 等合法消息后，能正确解析出 action 值并交给后续处理
  2. 服务器收到包含未知 action 值的命令消息后，不会崩溃，而是识别为无效命令
  3. 已有的音频流功能在添加命令路由后仍然正常工作，无干扰
**Plans**: TBD

Plans:
- [ ] 01-01: 实现命令消息解析与路由逻辑

### Phase 2: 键盘动作
**Goal**: ESP32 四个物理按钮分别触发对应的 Claude Code 键盘快捷键，用户无需手动操作即可完成常用审批流程
**Depends on**: Phase 1
**Requirements**: [KEY-01, KEY-02, KEY-03, KEY-04]
**Success Criteria** (what must be TRUE):
  1. 按下 Approve 按钮后，活动应用收到 Enter 键输入
  2. 按下 Reject 按钮后，活动应用收到 Escape 键输入
  3. 按下 Switch Model 按钮后，活动应用收到 Option+P 组合键输入
  4. 按下 Toggle Auto-approve 按钮后，活动应用收到 Shift+Tab 组合键输入
**Plans**: TBD

Plans:
- [ ] 02-01: 实现四种按钮命令到键盘快捷键的映射和执行

### Phase 3: 响应协议
**Goal**: 每次命令执行后 ESP32 收到明确的确认或错误信息，形成完整的请求-响应循环
**Depends on**: Phase 2
**Requirements**: [RSP-01, RSP-02]
**Success Criteria** (what must be TRUE):
  1. 命令成功执行后，ESP32 收到 `{"type": "command_ack", "action": "...", "success": true}` 响应
  2. 命令执行失败或 action 无效时，ESP32 收到包含错误信息的响应，而非静默丢失
  3. 响应消息通过同一个 WebSocket 连接返回，不需要额外的网络交互
**Plans**: TBD

Plans:
- [ ] 03-01: 实现命令执行后的确认和错误响应

### Phase 4: 语言输出规范化
**Goal**: Whisper 语音识别结果稳定输出简体中文和英语混合内容，不出现繁体中文
**Depends on**: Nothing (independent feature, affects whisper configuration)
**Requirements**: [LANG-01]
**Success Criteria** (what must be TRUE):
  1. 用户说简体中文时，输出结果为简体中文（不出现繁体字）
  2. 用户说英语时，输出结果为英语
  3. 用户中英混合说话时，输出结果为简体中文+英语混合
**Plans**: 1 plan

Plans:
- [ ] 04-01-PLAN.md — 添加 Whisper Prompt 工程支持（配置 + CLI/Server 集成 + 验证）

## Progress

**Execution Order:**
Phase 1 → Phase 2 → Phase 3 → Phase 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. 命令路由 | 1/1 | Complete | 2026-02-04 |
| 2. 键盘动作 | 1/1 | Complete | 2026-02-04 |
| 3. 响应协议 | 1/1 | Complete | 2026-02-04 |
| 4. 语言输出规范化 | 0/1 | Planned | - |

---
*Roadmap created: 2026-02-03*
*Last updated: 2026-02-05*
