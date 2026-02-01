# WebSocket ASR 服务器测试结果

测试时间: 2026-02-02

## 环境配置

- **服务器地址**: ws://localhost:8765/ws
- **认证 Token**: test_token_123
- **Whisper 模型**: /Users/jiabozhang/Downloads/ggml-medium-q5_0.bin
- **Whisper CLI**: /opt/homebrew/bin/whisper-cli

## 测试结果

### ✅ 基本 WebSocket 通信测试

**测试场景**: 连接服务器 → 发送 start → 发送音频 → 发送 end → 接收结果

**结果**: 通过
- 连接成功
- 发送了 32000 字节 PCM 数据（1秒，16kHz, 16-bit, mono）
- 接收到识别结果
- 处理时间: ~1600ms

**示例响应**:
```json
{
  "type": "result",
  "reqId": "5d93dfb1-36fa-4d4a-aa00-af38c89939cb",
  "text": "你不想知道我做了多少事?",
  "ms": 1604,
  "engine": "whisper.cpp"
}
```

### ✅ 取消功能测试

**测试场景**: 发送 start → 发送部分音频 → 发送 cancel

**结果**: 通过
- 成功取消了正在进行的会话
- 收到 cancelled 确认

**响应**:
```json
{
  "type": "ack",
  "reqId": "2370ac2f-bde9-4bb8-b202-c81744c38a1b",
  "status": "cancelled"
}
```

### ✅ 认证失败测试

**测试场景**: 使用错误的 token 连接

**结果**: 通过
- 正确拒绝了未授权的连接
- 连接被服务器关闭

**响应**:
```json
{
  "type": "error",
  "reqId": "1d746fb4-f948-4cea-a5dc-3db714d0b003",
  "message": "unauthorized"
}
```

## 发现的问题与修复

### 问题 1: Session 空指针错误

**位置**: `src/server.js:116`

**问题描述**:
在异步 whisper 处理的错误处理中，尝试访问已经被设为 `null` 的 `session.reqId`，导致 `TypeError`。

**修复方案**:
在清空 session 之前，先保存必要的值（`savedReqId`, `savedMode`），然后在异步闭包中使用这些保存的值。

```javascript
// 修复前
whisperQueue = whisperQueue.then(run).catch((err) => {
  ws.send(JSON.stringify({ type: 'error', reqId: session.reqId, ... }));
});
session = null;  // 会导致上面的 catch 中访问 null.reqId

// 修复后
const savedReqId = session.reqId;
const savedMode = session.mode;
whisperQueue = whisperQueue.then(run).catch((err) => {
  ws.send(JSON.stringify({ type: 'error', reqId: savedReqId, ... }));
});
session = null;
```

## 使用方法

### 启动服务器
```bash
npm start
```

### 运行测试
```bash
# 基本测试
node test-client.js

# 所有测试
node test-client.js --all

# 单独测试取消功能
node test-client.js --cancel

# 单独测试认证失败
node test-client.js --auth
```

### 健康检查
```bash
curl http://localhost:8765/health
```

## WebSocket 协议概览

### 客户端发送流程
1. **start** (JSON): 开始会话，包含认证 token 和音频参数
2. **binary frames**: 原始 PCM 音频数据
3. **end** (JSON): 结束会话，触发 ASR 处理

### 服务器响应
- **ack**: 确认消息（ready, cancelled）
- **progress**: 处理进度（可选）
- **result**: ASR 识别结果
- **error**: 错误消息

## 总结

所有 WebSocket 功能测试均通过。服务器能够：
- ✅ 正确处理 WebSocket 连接
- ✅ 验证认证 token
- ✅ 接收流式音频数据
- ✅ 调用 whisper.cpp 进行 ASR 识别
- ✅ 返回识别结果
- ✅ 支持会话取消
- ✅ 正确处理错误情况

服务器已准备好用于生产环境测试。
