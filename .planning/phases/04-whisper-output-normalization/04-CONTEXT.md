# Phase 4: 语言输出规范化 - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

确保 Whisper 语音识别结果稳定输出简体中文和英语混合内容，不出现繁体中文。通过 Prompt 工程和可选的后处理转换实现。

</domain>

<decisions>
## Implementation Decisions

### 技术方案选择
- 使用 `--prompt` 参数进行 Prompt 工程（**已确定**）
- **不使用** `--language zh`，因为会严重影响英语识别效果
- 保持 `--language auto` 让 Whisper 自动检测语言

### Prompt 内容设计
- 明确提及"简体中文和英语"（用户要求）
- 包含编程术语示例（如 function, API, commit, deploy 等）
- Claude's Discretion: 是否包含示例文本、prompt 使用中文还是英文

### 繁简边界处理
- **策略：先 Prompt，后 OpenCC** — 先测试 Prompt 效果，如果无法完全避免繁体字再添加 OpenCC 后处理
- 如需 OpenCC：在服务端（Node.js）处理，返回前转换
- 默认启用繁简转换（如果实现），不提供开关
- 专有名词保留原样（如"台灣""香港"不转换）

### Claude's Discretion
- Prompt 的具体措辞和语言风格
- 是否在 prompt 中包含示例输出
- OpenCC 的具体配置方案（如果需要）
- Prompt 是硬编码还是环境变量配置

</decisions>

<specifics>
## Specific Ideas

- 用户的使用场景是与 Claude Code 交互，说话内容常包含编程术语
- 中英混合是常态，不是例外
- 已测试过 `--language zh` 会导致英语识别很差

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-whisper-output-normalization*
*Context gathered: 2026-02-05*
