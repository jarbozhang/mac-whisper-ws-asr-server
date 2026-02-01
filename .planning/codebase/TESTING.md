# 测试模式

**分析日期:** 2026-02-02

## 测试框架

**运行器:**
- 未检测到测试框架 (未安装 Jest、Vitest、Mocha)
- 通过 Node.js 脚本进行手动测试

**断言库:**
- 未安装断言库
- 通过控制台输出和 WebSocket 消息进行手动验证

**运行命令:**
```bash
node test-client.js              # 运行基本 WebSocket 测试
node test-client.js --all        # 运行所有测试场景
node test-client.js --cancel     # 测试取消功能
node test-client.js --auth       # 测试认证失败
```

## 测试文件组织

**位置:**
- 测试文件位于项目根目录
- 主测试客户端: `test-client.js`
- 单元测试: 未在单独目录中结构化
- 集成测试: 实现为手动测试客户端

**命名:**
- 单一测试文件: `test-client.js`
- 文件内的描述性函数名: `testWebSocket()`, `testCancel()`, `testAuthFailure()`
- 无 `.test.js` 或 `.spec.js` 后缀约定

**结构:**
```
[项目根目录]/
├── test-client.js          # 手动 WebSocket 测试客户端
└── src/
    ├── server.js           # 主服务器 (可通过 WebSocket 测试)
    └── [其他模块]
```

## 测试结构

**手动测试函数:**
```javascript
function testWebSocket() {
  console.log('🔌 连接到 WebSocket 服务器:', WS_URL);

  const ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    // 测试步骤
    ws.send(JSON.stringify(startMsg));
  });

  ws.on('message', (data, isBinary) => {
    const msg = JSON.parse(data.toString('utf8'));
    // 通过 console.log 进行断言
  });

  ws.on('error', (error) => {
    console.error('❌ 错误:', error.message);
  });
}
```

**测试模式:**
- 使用 WebSocket 事件监听器的事件驱动测试 (`on('open')`, `on('message')`, `on('error')`, `on('close')`)
- 通过控制台日志记录进行消息验证
- 通过 `setTimeout()` 顺序执行测试
- 用于选择要运行的测试的 CLI 参数

**设置模式:**
```javascript
const ws = new WebSocket(WS_URL);
const reqId = uuidv4();

// 发送前等待打开
ws.on('open', () => {
  ws.send(JSON.stringify(msg));
});
```

**清理模式:**
- 显式关闭 WebSocket 连接: `ws.close()`
- 手动测试无需清理工具
- 临时文件由服务器管理 (如果 `KEEP_DEBUG=true` 则保留)

## 测试场景

**场景 1: 基本 ASR 流程 (testWebSocket)**
1. 连接到 WebSocket 服务器
2. 发送带身份验证令牌的 `start` 消息
3. 接收 `status: 'ready'` 的 `ack` 消息
4. 发送 PCM 音频数据 (1 秒静音)
5. 发送 `end` 消息
6. 接收带转录文本的 `result` 消息
7. 关闭连接

**场景 2: 取消操作 (testCancel)**
1. 连接到 WebSocket 服务器
2. 发送 `start` 消息
3. 接收 `ack` 消息
4. 发送部分 PCM 音频 (0.5 秒)
5. 发送 `cancel` 消息
6. 接收 `status: 'cancelled'` 的 `ack` 消息
7. 关闭连接

**场景 3: 认证失败 (testAuthFailure)**
1. 连接到 WebSocket 服务器
2. 发送带错误令牌的 `start` 消息
3. 接收 `message: 'unauthorized'` 的 `error` 消息
4. 连接关闭 (服务器端)

**可见于:** `test-client.js` 第 23-95 行 (基本)、第 98-153 行 (取消)、第 156-189 行 (认证)

## 模拟

**框架:** 未使用 - 通过测试数据进行手动模拟

**模式:**
```javascript
// 生成测试 PCM 数据而不是真实音频
function generateSilentPCM(durationSec = 1) {
  const sampleRate = 16000;
  const channels = 1;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const totalSamples = sampleRate * channels * durationSec;
  const totalBytes = totalSamples * bytesPerSample;
  return Buffer.alloc(totalBytes);  // 全零 = 静音
}
```

**什么需要模拟:**
- PCM 音频数据 (生成合成静音而不是录制真实音频)
- WebSocket 连接 (使用真实 WebSocket 测试协议)
- 外部进程 (whisper.cpp 必须是真实的,但测试使用静音音频)

**什么不需要模拟:**
- WebSocket 服务器/协议 (测试实际行为)
- 消息序列化 (测试实际 JSON 协议)
- 认证逻辑 (使用真实和错误令牌测试)

## 固件和测试数据

**测试数据:**
```javascript
// 测试文件顶部的配置常量
const WS_URL = 'ws://localhost:8765/ws';
const AUTH_TOKEN = 'test_token_123';

// 合成 PCM 数据生成
function generateSilentPCM(durationSec = 1) {
  // 返回指定时长的静音 Buffer
}

// 消息固件
const startMsg = {
  type: 'start',
  token: AUTH_TOKEN,
  reqId: reqId,
  mode: 'return_only',
  format: 'pcm_s16le',
  sampleRate: 16000,
  channels: 1,
  bitDepth: 16
};

const endMsg = {
  type: 'end',
  reqId: reqId
};
```

**位置:**
- 所有测试数据在 `test-client.js` 模块级别定义
- 文件顶部的常量
- 使用前定义的函数

## 覆盖率

**要求:** 无强制要求

**当前状态:**
- 未安装自动化覆盖率工具
- 手动测试场景覆盖:
  - 快乐路径: start → 音频 → end → result
  - 错误路径: 错误的认证令牌
  - 取消路径: start → 音频 → cancel
  - 消息验证: 接收到正确的消息类型

**未测试区域:**
- 边缘情况的错误处理 (大音频文件、协议违规)
- 并发会话处理
- 内存/资源泄漏
- 性能下降

## 测试类型

**单元测试:**
- 无自动化
- 工具函数 (`clampInt`, `safeUnlink`, `nowMs`, `pcmToWavBuffer`) 可以从单元测试中受益
- 目前仅通过服务器集成进行未测试

**集成测试:**
- 主要测试类型: `test-client.js`
- 测试 WebSocket 协议与服务器的集成
- 测试从客户端到 whisper.cpp 的消息流
- 测试认证机制
- 测试错误消息传播

**E2E 测试:**
- 与集成测试无分离
- `test-client.js` 充当手动 E2E 测试
- 需要本地运行服务器并配置 whisper.cpp 二进制文件

## 测试执行

**手动运行:**
```bash
# 在一个终端启动服务器
node src/server.js

# 在另一个终端运行测试 (在项目根目录)
node test-client.js              # 基本测试
node test-client.js --all        # 按顺序所有三个场景
node test-client.js --cancel     # 仅取消测试
node test-client.js --auth       # 仅认证测试
```

**CLI 模式:**
```javascript
const args = process.argv.slice(2);
if (args.includes('--all')) {
  testWebSocket();
  setTimeout(() => testCancel(), 3000);
  setTimeout(() => testAuthFailure(), 6000);
} else if (args.includes('--cancel')) {
  testCancel();
} else if (args.includes('--auth')) {
  testAuthFailure();
} else {
  testWebSocket();  // 默认
}
```

## 调试和输出

**控制台输出格式:**
- 表情符号前缀以清晰 (🔌, ✅, 📤, 📥, ✨, ❌)
- 带上下文的结构化消息
- 示例:
  - `console.log('🔌 连接到 WebSocket 服务器:', WS_URL)`
  - `console.log('✅ WebSocket 连接成功')`
  - `console.log('📤 发送 start 消息:', { type: startMsg.type, reqId })`
  - `console.log('📥 收到消息:', msg)`

**验证方法:**
- Console.log 断言 (无正式断言库)
- 示例: `✅ 测试完成`, `✅ 认证失败测试通过`
- 错误检测: `❌ 错误:`, `❌ WebSocket 错误:`

## 已知测试限制

**无框架开销:**
- 无设置/清理钩子
- 使用 `setTimeout()` 进行手动超时管理
- 无测试报告 (通过控制台显示通过/失败指示器)
- 无并行测试执行
- 带硬编码延迟的顺序测试 (3000ms, 6000ms)

**异步测试:**
- 基于事件的异步处理
- 依赖于事件监听器和回调
- 无基于 Promise 的测试断言
- 硬编码延迟可能存在时序问题

---

*测试分析: 2026-02-02*
