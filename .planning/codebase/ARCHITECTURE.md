# 架构

**分析日期:** 2026-02-02

## 模式概述

**整体:** 事件驱动的 WebSocket 服务器,采用请求-响应模式和串行处理队列

**关键特征:**
- 基于 WebSocket 的双向通信用于音频流
- HTTP 健康检查端点用于监控
- 使用 Promise 链队列串行处理语音识别请求
- 模块化设计,关注点分离: 传输、配置、音频格式转换、进程执行和系统集成
- 通过剪贴板和 AppleScript 实现 macOS 原生文本注入

## 分层架构

**传输层:**
- 目的: 管理 WebSocket 连接和 HTTP 协议处理
- 位置: `src/server.js` (主要 WebSocket 和 HTTP 服务器逻辑)
- 包含: 连接生命周期管理、消息路由、每个客户端的会话状态
- 依赖: ws 库 (WebSocket 功能)、Node.js http/https 模块
- 被使用: 所有客户端通信的入口点

**配置层:**
- 目的: 从环境变量加载和公开应用程序配置
- 位置: `src/config.js`
- 包含: 服务器主机/端口、身份验证令牌、音频格式参数、whisper.cpp 路径、操作模式
- 依赖: dotenv (环境变量加载)
- 被使用: 所有需要配置参数的模块

**音频处理层:**
- 目的: 将原始 PCM 音频数据转换为与 whisper.cpp 兼容的 WAV 格式
- 位置: `src/wav.js`
- 包含: WAV 头构建、缓冲区管理
- 依赖: Node.js Buffer API
- 被使用: `src/server.js` 在转录前的音频最终化过程中

**语音识别引擎层:**
- 目的: 执行 whisper.cpp CLI 二进制文件并捕获转录结果
- 位置: `src/whisper.js`
- 包含: 子进程生成、stderr 捕获、输出文件解析、时间指标
- 依赖: Node.js child_process 模块、文件系统访问
- 被使用: 主服务器在转录阶段

**系统集成层:**
- 目的: 通过剪贴板和自动化将识别的文本集成到 macOS 系统
- 位置: `src/inject.js`
- 包含: pbcopy 剪贴板交互、osascript AppleScript 执行、键盘模拟
- 依赖: macOS 特定工具 (pbcopy, osascript)
- 被使用: 主服务器在成功转录后 (根据模式设置条件执行)

**工具层:**
- 目的: 为常见操作提供共享辅助函数
- 位置: `src/utils.js`
- 包含: 安全文件删除、数值范围限制、时间戳生成
- 依赖: Node.js fs/promises 模块
- 被使用: 多个模块,包括主服务器和 whisper 模块

## 数据流

**音频转录流程:**

1. 客户端通过 WebSocket 连接到 `/ws` 端点
2. 客户端发送包含身份验证令牌和音频格式参数的 `start` JSON 消息
3. 服务器验证令牌并创建包含元数据的会话对象
4. 服务器发送 `ack` 确认消息
5. 客户端流式传输 PCM 音频二进制帧
6. 服务器在 session.parts 数组中累积二进制帧,每 ~256KB 发送进度消息
7. 客户端发送 `end` JSON 消息
8. 服务器将所有 PCM 帧连接成单个缓冲区
9. 服务器使用 pcmToWavBuffer() 将 PCM 转换为 WAV 格式
10. 服务器将 WAV 文件写入临时目录
11. 服务器将转录任务加入 whisperQueue (串行执行的 Promise 链)
12. 服务器通过子进程执行 whisper.cpp CLI,传入模型路径和音频文件
13. 服务器读取输出文本文件
14. 服务器可选地通过剪贴板 + Cmd+V 将文本注入前台 macOS 应用程序 (根据模式可选添加 Enter)
15. 服务器向客户端发送包含识别文本和处理时间的 `result` JSON 消息
16. 服务器清理临时文件 (根据 keepDebug 设置条件执行)

**状态管理:**
- 每个连接的会话对象: 保存活动音频接收状态 (reqId、格式参数、累积部分、字节计数、块数)
- 全局 whisperQueue: Promise 链,确保一次只运行一个 whisper.cpp 进程,串行化转录请求
- 连接级清理: 会话在 WebSocket 关闭或取消命令时清空

## 关键抽象

**会话对象:**
- 目的: 封装单个音频转录请求从开始到结束的状态
- 示例: `src/server.js` 第 54-65 行
- 模式: 每个 `start` 消息创建的纯 JavaScript 对象,包含音频格式元数据、累积帧数据、时间信息

**WebSocket 消息协议:**
- 目的: 定义客户端和服务器之间的结构化通信契约
- 示例: `start`, `end`, `cancel`, `progress`, `ack`, `result`, `error` 消息类型
- 模式: 控制使用 JSON 文本帧,原始 PCM 音频数据使用二进制帧;所有控制消息包含 reqId 用于关联

**串行处理队列:**
- 目的: 确保 whisper.cpp 进程按顺序运行以避免资源争用
- 示例: `src/server.js` 第 32、119-121 行
- 模式: 使用 `whisperQueue.then(run).catch(...)` 的 Promise 链来串行化异步操作

## 入口点

**HTTP 服务器:**
- 位置: `src/server.js` 第 19-27 行
- 触发器: 服务器启动,对 `/health` 路径的 HTTP 请求
- 职责: 健康检查端点,返回包含运行时间和引擎信息的 JSON 状态

**WebSocket 服务器:**
- 位置: `src/server.js` 第 29 行
- 触发器: 客户端 WebSocket 连接到 `ws://<host>:<port>/ws`
- 职责: 接受连接,将消息事件路由到处理程序,管理会话生命周期

**应用程序入口点:**
- 位置: `src/server.js` 第 165-167 行
- 触发器: `npm start` 或 `node src/server.js`
- 职责: 在配置的 host:port 上启动 HTTP+WS 服务器,记录监听状态

## 错误处理

**策略:** 消息处理程序外围的 try-catch 包装器,发送错误响应

**模式:**
- WebSocket 消息处理程序包装在 try-catch 中 (`src/server.js` 第 40-155 行): 捕获消息处理的所有异常并发送错误响应
- 身份验证验证: 如果令牌不匹配,提前返回未授权错误
- 会话验证: 在处理 end/cancel 前检查会话存在且 reqId 匹配
- 音频时长验证: 转录前强制执行 MAX_AUDIO_SEC 限制
- 子进程错误处理: 捕获 stderr 并使用进程错误码拒绝
- 安全文件删除: `safeUnlink()` 工具忽略缺失的文件而不是抛出异常

## 横切关注点

**日志记录:** 连接事件的 console.log 语句 (第 162 行),无结构化日志框架;最小可观察性

**验证:** start 消息上的基于令牌的身份验证;音频时长限制强制执行;会话生命周期中的 reqId 一致性检查

**身份验证:** 与客户端提供的令牌比较的单个 AUTH_TOKEN 环境变量;无每用户或基于角色的访问控制

---

*架构分析: 2026-02-02*
