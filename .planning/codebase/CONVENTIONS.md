# 编码规范

**分析日期:** 2026-02-02

## 命名模式

**文件:**
- 多词文件名使用小写连字符: `test-client.js`
- 模块文件使用与主要导出匹配的描述性名称
- 示例: `server.js`, `config.js`, `utils.js`, `whisper.js`, `inject.js`, `wav.js`

**函数:**
- 所有函数名使用驼峰命名法
- 示例: `clampInt()`, `safeUnlink()`, `nowMs()`, `runWhisper()`, `pcmToWavBuffer()`, `pbcopy()`, `osascript()`, `injectText()`

**变量:**
- 局部和模块级变量使用驼峰命名法
- 示例: `whisperQueue`, `session`, `reqId`, `savedReqId`, `remote`, `msg`, `pcm`, `bytesPerSec`
- 优先使用描述性名称: `session`, `wavBuf`, `startedAt` 而非缩写名称

**常量:**
- 通过 `config` 对象访问的配置常量使用大写
- 示例: `config.authToken`, `config.whisperBin`, `config.maxAudioSec`

**类型/对象:**
- 对象属性使用驼峰命名法
- `session` 对象示例: `reqId`, `startedAt`, `bitDepth`, `channels`, `chunks`, `bytes`, `parts`
- 消息属性使用驼峰命名法: `type`, `token`, `message`, `status`, `format`, `sampleRate`, `bitDepth`

## 代码风格

**格式化:**
- 未配置明确的格式化工具 (未检测到 ESLint/Prettier)
- 整个代码库保持一致的 2 空格缩进
- 导入在文件顶部分组,然后空一行再写代码
- 允许长行 (观察到约 100+ 字符的行)

**代码检查:**
- 未检测到代码检查配置
- 代码遵循宽松的约定,依赖开发人员自律

**分号:**
- 语句末尾一致使用分号
- 在所有源文件中可观察到

**空格:**
- 控制关键字后单个空格: `if (`, `for (`, `while (`
- 二元运算符周围单个空格: `=`, `===`, `||`, `&&`
- 括号/方括号内无空格: `(msg)`, `[0]`

## 导入组织

**顺序:**
1. Node.js 内置模块 (`import http from 'node:http'`)
2. 第三方包 (`import { WebSocketServer } from 'ws'`)
3. 本地模块 (`.js` 相对导入)
4. 每组之间空一行

**路径别名:**
- 未使用;仅使用相对导入
- 带 `.js` 扩展名的直接导入: `import { config } from './config.js'`

**模块格式:**
- 独占使用 ES 模块 (package.json 中的文件类型: `"module"`)
- 未检测到 CommonJS (`require()`)
- 所有文件使用 `.js` 扩展名

## 错误处理

**模式:**
- 消息处理程序中使用 try-catch 块: `try { ... } catch (e) { ... }`
- 错误对象转换为字符串: `String(e?.message ?? e)`
- 错误访问的回退链: `e?.message ?? e`
- 通过 WebSocket 消息发送错误: `{ type: 'error', reqId, message: String(...) }`
- 基于 Promise 的错误处理: `.catch((err) => { ... })`
- 工具函数中的静默错误抑制: `try { ... } catch (_) {}`
- 退出码检查: `if (code === 0) resolve(); else reject(...)`

**可见位置:**
- `src/server.js` 第 40-155 行 (消息处理程序 try-catch)
- `src/whisper.js` 第 18-24 行 (Promise 错误处理)
- `src/utils.js` 第 9 行 (静默 catch)
- `src/inject.js` 第 4-20 行 (Promise 拒绝模式)

## 日志记录

**框架:** 仅使用 `console` 对象

**模式:**
- `console.log()` 用于信息性消息
- `console.error()` 用于错误条件
- 简单的字符串连接或模板字符串
- 示例:
  - `console.log('WS connected:', remote)`
  - `console.error('AUTH_TOKEN is required')`
  - `console.log(`HTTP+WS listening on http://${config.host}:${config.port} (ws path /ws)`)`

**何时记录日志:**
- 服务器启动: 主机、端口、路径
- 连接事件: 客户端连接、断开连接
- 配置问题: 缺少 AUTH_TOKEN
- 测试客户端使用带表情符号的结构化控制台输出 (🔌, ✅, 📤, 📥 等)

## 注释

**何时添加注释:**
- 主源文件中的注释稀疏
- 注释用于非显而易见的逻辑或算法
- 示例: "可选的进度提示,每 ~256KB", "简单的全局互斥锁以串行运行 whisper"
- 未观察到 JSDoc 注释

**注释风格:**
- 使用 `//` 的单行注释
- 内联注释解释意图或约束
- 可见于 `src/server.js` 第 31、96、148 行

**JSDoc/TSDoc:**
- 代码库中未使用
- 无类型注解

## 函数设计

**大小:**
- 优先使用小型、专注的函数
- 工具函数: 3-15 行
- 处理程序函数: 可变长度但逻辑分离
- 示例: `clampInt()` (5 行), `safeUnlink()` (3 行), `nowMs()` (2 行)

**参数:**
- 简单函数使用位置参数
- 具有多个选项的复杂函数使用对象参数
- 对象参数示例:
  ```javascript
  function pcmToWavBuffer(pcmBuffer, { sampleRate, channels, bitDepth })
  function runWhisper({ whisperBin, modelPath, wavPath, extraArgs = [] })
  ```

**返回值:**
- 函数返回值或 Promise (全程异步处理)
- I/O 操作使用异步函数
- 某些情况下解构返回值: `const { text, ms, outTxt } = await runWhisper(...)`

**Async/Await:**
- 独占使用 async/await 进行 Promise 处理
- 未观察到回调嵌套
- 所有消息处理程序定义为 `async`
- 顶层 Promise 链用于队列管理: `whisperQueue = whisperQueue.then(run).catch(...)`

## 模块设计

**导出:**
- 工具函数的命名导出: `export function clampInt()`, `export async function safeUnlink()`
- 配置的对象导出: `export const config = { ... }`
- 观察到的混合导出:
  - `src/config.js`: 配置对象的单一默认导出
  - `src/utils.js`: 多个命名函数导出
  - `src/whisper.js`: 单一异步函数导出
  - `src/inject.js`: 单一异步函数导出
  - `src/wav.js`: 单一函数导出

**桶文件:**
- 此代码库中未使用
- 每个模块直接导出它提供的内容

**导入用法:**
- 命名空间导入: `import http from 'node:http'`
- 命名解构导入: `import { WebSocketServer } from 'ws'`
- 副作用导入: `import 'dotenv/config'` (在 config.js 中)

## 数据结构

**Session 对象模式:**
```javascript
session = {
  reqId,
  mode,
  startedAt: Date.now(),
  format: msg.format || 'pcm_s16le',
  sampleRate: msg.sampleRate || config.sampleRate,
  channels: msg.channels || config.channels,
  bitDepth: msg.bitDepth || config.bitDepth,
  chunks: 0,
  bytes: 0,
  parts: []
};
```

**消息对象模式:**
```javascript
{ type: 'start', token, reqId, mode, format, sampleRate, channels, bitDepth }
{ type: 'ack', reqId, status }
{ type: 'error', reqId, message }
{ type: 'result', reqId, text, ms, engine }
{ type: 'progress', reqId, bytes }
```

## Null/Undefined 处理

**模式:**
- 使用空值合并运算符 `??` 设置默认值: `msg.token || msg.reqId ?? null`
- 使用可选链进行安全属性访问: `e?.message`
- 显式 null 检查: `if (!session)`, `if (session || msg.reqId !== session.reqId)`
- 函数参数中的默认值: `extraArgs = []`

---

*规范分析: 2026-02-02*
