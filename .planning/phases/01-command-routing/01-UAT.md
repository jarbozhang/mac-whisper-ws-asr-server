---
status: testing
phase: 01-command-routing
source: Phase 1 implementation plan
started: 2026-02-04T12:00:00Z
updated: 2026-02-04T12:00:00Z
---

## Current Test

number: 1
name: 合法命令返回 command_ack
expected: |
  发送 `{"type": "command", "action": "approve"}` 后，
  收到 `{"type":"command_ack","reqId":null,"action":"approve","status":"received"}`
awaiting: user response

## Tests

### 1. 合法命令返回 command_ack
expected: 发送 `{"type": "command", "action": "approve"}` 后，收到 `{"type":"command_ack","reqId":null,"action":"approve","status":"received"}`
result: [pending]

### 2. 未知 action 返回错误
expected: 发送 `{"type": "command", "action": "bad"}` 后，收到 `{"type":"error","reqId":null,"message":"unknown command action: bad"}`
result: [pending]

### 3. 缺少 action 字段返回错误
expected: 发送 `{"type": "command"}` 后，收到 `{"type":"error","reqId":null,"message":"command missing action field"}`
result: [pending]

### 4. 其他合法 action 值均可识别
expected: 发送 `{"type": "command", "action": "reject"}`、`{"type": "command", "action": "switch_model"}`、`{"type": "command", "action": "toggle_auto_approve"}` 后，均收到对应的 command_ack 响应
result: [pending]

### 5. 已有音频流功能不受影响
expected: 发送 `{"type": "start", "token": "..."}` 等原有消息类型时，服务器行为与之前一致
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0

## Gaps

[none yet]
