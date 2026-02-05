# Plan 04-01: Whisper Prompt 工程支持 — Summary

**Completed:** 2026-02-05
**Commits:** 2ebbc2f

## What Was Built

添加了 Whisper Prompt 工程支持，通过 `--prompt` 参数传递简体中文示例文本，引导模型输出简体中文而非繁体中文。

## Deliverables

| File | Change |
|------|--------|
| src/config.js | 添加 `whisperPrompt` 配置项，默认值为简体中文编程示例 |
| src/whisper.js | CLI 模式传递 `--prompt` 参数 |
| src/whisper-server-manager.js | HTTP Server 模式传递 `--prompt` 参数 |
| .env.example | 添加 `WHISPER_PROMPT` 配置说明 |

## Key Decisions

- **Prompt 设计**: 使用简体中文示例文本（不是指令），包含编程术语
- **默认值**: `以下是普通话的句子。我在写代码，使用 function 定义函数，通过 API 调用接口。`
- **配置方式**: 环境变量 `WHISPER_PROMPT`，可自定义覆盖

## Verification

- [x] 用户验证通过 — 简体中文输出正常

## Issues

None.
