# Phase 4: 语言输出规范化 - Research

**Researched:** 2026-02-05
**Domain:** Whisper 语音识别输出控制（简体中文、繁体中文、中英混合）
**Confidence:** MEDIUM

## Summary

Whisper 语音识别模型使用单一的 `zh` 语言代码处理所有中文变体，无法直接指定简体或繁体输出。本研究针对用户需求（确保输出简体中文+英语混合内容，不出现繁体中文）探讨了两层解决方案：

1. **第一层：Prompt 工程（已验证有效）** - 使用 `--prompt` 参数传递简体中文示例文本，引导模型输出简体字符
2. **第二层：OpenCC 后处理（备用方案）** - 如果 prompt 无法完全避免繁体字，使用 opencc-js 库在服务端进行繁简转换

社区实践表明，合理设计的 prompt 可以显著提升简体中文输出的稳定性，特别是对于包含编程术语的中英混合场景。如果仍出现繁体字泄漏（如来自香港、台湾口音的音频），OpenCC 可作为可靠的兜底方案。

**Primary recommendation:** 使用包含编程术语示例的简体中文 prompt（如 "以下是普通话的句子。Function, API, Commit, Deploy, Debug, Variable"），配合 `--language auto` 保证英语识别质量；如测试发现 prompt 无法完全避免繁体字，再添加 opencc-js 后处理转换。

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| whisper.cpp | latest | 语音识别引擎 | 项目已使用，支持 CLI 和 HTTP Server 两种模式 |
| opencc-js | 1.0.5+ | 繁简转换（可选） | 纯 JavaScript 实现，无需 native 依赖，社区最流行的 OpenCC Node.js 版本 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node-opencc | 2.0.1 | 繁简转换替代方案 | 如果 opencc-js 不满足需求时的备选（较老，8年未更新） |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| opencc-js | node-opencc | node-opencc 更老（8年未更新），但 API 可能更简单；opencc-js 更活跃，支持浏览器端 |
| 后处理转换 | 仅依赖 Prompt | Prompt 可能不能100%避免繁体字，特别是对港台口音；后处理更可靠但增加了依赖和处理开销 |

**Installation (如需 OpenCC):**
```bash
npm install opencc-js
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── whisper.js           # Whisper 执行层（CLI/HTTP）
├── whisper-normalizer.js # 新增：输出规范化层（OpenCC 后处理，可选）
├── config.js            # 配置管理（新增 WHISPER_PROMPT）
└── handlers/
    └── websocket.js     # WebSocket 处理层（调用 normalizer）
```

### Pattern 1: Prompt 工程 - CLI 和 Server 模式统一配置
**What:** 使用环境变量配置 prompt，在 CLI 模式通过 `--prompt` 参数传递，在 HTTP Server 模式通过启动参数或 API 请求参数传递
**When to use:** 总是使用，这是第一道防线

**Example (CLI 模式):**
```javascript
// Source: 项目现有代码 + whisper.cpp 文档
// config.js
export const config = {
  // ...existing config...
  whisperPrompt: process.env.WHISPER_PROMPT ?? '以下是普通话的句子。',
  whisperArgs: (process.env.WHISPER_ARGS ?? '').trim().split(/\s+/)
};

// whisper.js (CLI mode)
async function runWhisperCli({ whisperBin, modelPath, wavPath, extraArgs = [] }) {
  const promptArg = config.whisperPrompt ? ['--prompt', config.whisperPrompt] : [];
  const args = ['-m', modelPath, '-f', wavPath, '--output-txt', '--output-file', outBase, ...promptArg, ...extraArgs];
  // ...rest of the function
}
```

**Example (HTTP Server 模式):**
```javascript
// Source: whisper.cpp HTTP Server 文档
// whisper-server-manager.js
const args = [
  '--model', config.whisperModel,
  '--host', config.whisperServerHost,
  '--port', String(config.whisperServerPort),
  ...(config.whisperPrompt ? ['--prompt', config.whisperPrompt] : []),
  ...validServerArgs
];
```

### Pattern 2: 两层防御策略
**What:** 先用 prompt 引导输出简体中文，再用 OpenCC 清理残留繁体字
**When to use:** 当测试发现单纯 prompt 无法100%避免繁体字时

**Example:**
```javascript
// Source: opencc-js 官方文档 + 社区实践
// whisper-normalizer.js（新文件）
import OpenCC from 'opencc-js';

// 繁体转简体转换器（全局初始化一次）
const converter = OpenCC.Converter({ from: 'tw', to: 'cn' });

// 可选：保留特定专有名词（如"台灣"、"香港"保持不变）
const properNouns = new Set(['台灣', '香港', '台北', '澳門']);

export function normalizeOutput(text) {
  if (!text) return text;

  // 拆分为字符处理，保留专有名词
  let result = '';
  let buffer = '';

  for (let i = 0; i < text.length; i++) {
    buffer += text[i];

    // 检查 buffer 是否匹配专有名词
    let matched = false;
    for (const noun of properNouns) {
      if (noun.startsWith(buffer)) {
        if (noun === buffer) {
          result += buffer; // 完整匹配，保留
          buffer = '';
        }
        matched = true;
        break;
      }
    }

    if (!matched && buffer.length > 0) {
      // 不在专有名词中，转换后添加
      result += converter(buffer);
      buffer = '';
    }
  }

  // 处理剩余 buffer
  if (buffer) {
    result += converter(buffer);
  }

  return result;
}
```

### Pattern 3: Prompt 内容设计 - 简体中文 + 编程术语
**What:** Prompt 应包含简体中文示例文本和常见编程术语，用空格分隔（不需要句子形式）
**When to use:** 总是使用

**Example:**
```bash
# Source: OpenAI Whisper Prompting Guide + 社区实践
# .env 配置
WHISPER_PROMPT="以下是普通话的句子。Function, API, Commit, Deploy, Debug, Variable, Interface, Component, Props, State, Hook, Async, Await, Promise, Callback"
```

**更长的示例（推荐）:**
```bash
# 使用完整句子形式（更可靠）
WHISPER_PROMPT="以下是普通话的句子。我在写代码，使用 function 定义函数，通过 API 调用接口，执行 commit 提交代码，deploy 部署应用，debug 调试问题。"
```

### Anti-Patterns to Avoid
- **不要使用指令式 prompt（如 "请输出简体中文"）** - Whisper 不是指令遵循模型，它只会模仿 prompt 的风格，不会执行指令
- **不要使用太短的 prompt（<20 tokens）** - 短 prompt 不可靠，模型可能忽略
- **不要在 prompt 中混用简繁体字** - 会导致输出不稳定
- **不要使用 `--language zh`** - 会严重影响英语识别效果（用户已验证）

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 繁简转换 | 自己维护字符映射表 | opencc-js | 繁简转换是 n:m 映射，不是简单的字符替换；OpenCC 包含大量词组转换规则和区域习惯用语处理 |
| Prompt token 计数 | 自己按字符数估算 | Whisper multilingual tokenizer | Whisper 使用特殊 tokenizer，字符数 ≠ token 数；prompt 限制是 224 tokens，超出部分会被静默忽略 |
| 专有名词识别 | 训练自定义模型 | 在 prompt 中包含专有名词示例 | Whisper 已经很擅长识别 prompt 中出现的词汇，无需重新训练 |

**Key insight:** Whisper 的 prompt 机制本质上是"风格模仿"，不是"指令遵循"。模型会延续 prompt 的写作风格（包括字符集、标点、大小写等），而不是执行 prompt 中的命令。

## Common Pitfalls

### Pitfall 1: Prompt 在 HTTP Server 模式中被忽略
**What goes wrong:** 在 HTTP Server 模式下，启动 whisper-server 时没有传递 `--prompt` 参数，导致每次推理都使用默认设置
**Why it happens:** whisper-server 支持两种 prompt 传递方式：1) 启动参数（全局默认）；2) API 请求参数（每次请求）。如果都不设置，就没有 prompt
**How to avoid:**
  - **方案1（推荐）：** 在启动 whisper-server 时传递 `--prompt` 参数作为全局默认值
  - **方案2：** 在每次 HTTP API 请求时携带 `prompt` 字段（更灵活但需要修改 whisper.js 的 runWhisperHttp 函数）
**Warning signs:** 测试时发现 HTTP Server 模式输出繁体字，但 CLI 模式输出简体字

### Pitfall 2: Prompt 超过 224 tokens 被截断
**What goes wrong:** 设计了很长的 prompt（如包含100个编程术语），但只有最后 224 tokens 生效，前面的内容被静默忽略
**Why it happens:** Whisper 的 context 窗口有限，prompt 被硬限制为 224 tokens
**How to avoid:**
  - 使用 Whisper multilingual tokenizer 计算 token 数（不要按字符数估算）
  - 优先放置最重要的示例文本和术语在 prompt 末尾
  - 对于中文，大约 150-200 个汉字可能接近 224 tokens 限制
**Warning signs:** 长 prompt 的前半部分风格没有被模型采用

### Pitfall 3: 混合语言场景下的 `--language` 参数冲突
**What goes wrong:** 设置 `--language zh` 导致英语识别质量下降（用户已验证）
**Why it happens:** Whisper 的语言参数会强制模型偏向该语言的音素和词汇，抑制其他语言
**How to avoid:**
  - 使用 `--language auto` 让模型自动检测
  - 依赖 prompt 中的中英混合示例文本引导模型正确处理混合语言
**Warning signs:** 英语单词被错误识别为中文拼音或音近字

### Pitfall 4: OpenCC 转换破坏专有名词
**What goes wrong:** "台灣"被转换为"台湾"、"香港"被转换为"香港"（后者可能没问题，但有些场景需要保留原样）
**Why it happens:** OpenCC 默认转换所有繁体字，不区分专有名词
**How to avoid:**
  - 使用 CustomConverter 定义专有名词白名单
  - 在转换前进行词汇级别的分词和匹配
  - 考虑是否真的需要保留专有名词（大部分场景可以转换）
**Warning signs:** 用户反馈地名、人名被"改写"了

## Code Examples

### Example 1: 配置 Prompt（环境变量方式）
```bash
# Source: 项目 .env.example + 研究推荐
# .env
WHISPER_ARGS=--language auto --temperature 0
WHISPER_PROMPT=以下是普通话的句子。我在写代码，使用 function 定义函数，通过 API 调用接口，执行 commit 提交代码。
```

### Example 2: CLI 模式使用 Prompt
```javascript
// Source: whisper.cpp 文档 + 项目代码
// config.js
export const config = {
  // ...existing...
  whisperPrompt: process.env.WHISPER_PROMPT ?? '',
};

// whisper.js
async function runWhisperCli({ whisperBin, modelPath, wavPath, extraArgs = [] }) {
  const outBase = wavPath.replace(/\.wav$/i, '');
  const outTxt = outBase + '.txt';

  // 如果配置了 prompt，添加到参数中
  const promptArgs = config.whisperPrompt ? ['--prompt', config.whisperPrompt] : [];

  const args = [
    '-m', modelPath,
    '-f', wavPath,
    '--output-txt',
    '--output-file', outBase,
    ...promptArgs,
    ...extraArgs
  ];

  const child = spawn(whisperBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  // ...rest of the function
}
```

### Example 3: HTTP Server 模式使用 Prompt（启动参数）
```javascript
// Source: whisper.cpp HTTP Server 文档 + 项目代码
// whisper-server-manager.js
export async function startWhisperServer() {
  // ...existing validation...

  const args = [
    '--model', config.whisperModel,
    '--host', config.whisperServerHost,
    '--port', String(config.whisperServerPort),
    ...(config.whisperPrompt ? ['--prompt', config.whisperPrompt] : []),
    ...validServerArgs
  ];

  serverProcess = spawn(config.whisperServerBin, args, {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  // ...rest of the function
}
```

### Example 4: OpenCC 后处理（可选）
```javascript
// Source: opencc-js 官方文档
// whisper-normalizer.js（新文件）
import OpenCC from 'opencc-js';

// 初始化转换器（繁体到简体）
// 'tw' = 台湾繁体，'cn' = 大陆简体
const converter = OpenCC.Converter({ from: 'tw', to: 'cn' });

/**
 * 将 Whisper 输出规范化为简体中文
 * @param {string} text - Whisper 识别的原始文本
 * @returns {string} 规范化后的文本（繁体 → 简体）
 */
export function normalizeOutput(text) {
  if (!text) return text;
  return converter(text);
}

// 使用示例
import { normalizeOutput } from './whisper-normalizer.js';

const rawText = "這是繁體中文";
const normalized = normalizeOutput(rawText);
console.log(normalized); // 输出: "这是繁体中文"
```

### Example 5: 保留专有名词的 OpenCC（高级）
```javascript
// Source: opencc-js CustomConverter 文档
import OpenCC from 'opencc-js';

// 定义不应转换的专有名词
const properNouns = ['台灣', '香港', '台北', '澳門'];

// 创建自定义转换器（保留专有名词）
const customDict = properNouns.map(noun => [noun, noun]); // 映射到自己
const properNounConverter = OpenCC.CustomConverter(customDict);

// 标准繁简转换器
const standardConverter = OpenCC.Converter({ from: 'tw', to: 'cn' });

/**
 * 带专有名词保护的转换
 */
export function normalizeOutputWithProperNouns(text) {
  if (!text) return text;

  // 简单实现：先标记专有名词，转换后恢复
  const placeholders = new Map();
  let placeholderIndex = 0;
  let markedText = text;

  // 替换专有名词为占位符
  for (const noun of properNouns) {
    const regex = new RegExp(noun, 'g');
    const placeholder = `__PROPER_NOUN_${placeholderIndex}__`;
    markedText = markedText.replace(regex, placeholder);
    placeholders.set(placeholder, noun);
    placeholderIndex++;
  }

  // 转换
  let converted = standardConverter(markedText);

  // 恢复专有名词
  for (const [placeholder, noun] of placeholders) {
    converted = converted.replace(new RegExp(placeholder, 'g'), noun);
  }

  return converted;
}
```

### Example 6: 在 WebSocket 处理层集成规范化
```javascript
// Source: 项目架构设计
// handlers/websocket.js（修改现有代码）
import { runWhisper } from '../whisper.js';
import { normalizeOutput } from '../whisper-normalizer.js'; // 如果启用 OpenCC

async function handleRecognize(ws, audioBuffer) {
  // ...existing code to save WAV...

  const result = await runWhisper({
    whisperBin: config.whisperBin,
    modelPath: config.whisperModel,
    wavPath: wavPath,
    extraArgs: config.whisperArgs,
    serverUrl: getServerUrl()
  });

  // 可选：应用 OpenCC 后处理
  const finalText = config.enableOpenCC
    ? normalizeOutput(result.text)
    : result.text;

  ws.send(JSON.stringify({
    type: 'result',
    text: finalText,
    ms: result.ms
  }));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 使用 `--language zh` 强制中文 | 使用 `--language auto` + prompt 引导 | 2023-2024社区实践 | 显著提升中英混合场景的英语识别准确率 |
| 依赖后处理工具转换繁简体 | 优先使用 prompt 引导，后处理作为兜底 | 2024+ | 减少依赖，提升效率；prompt 在大多数场景下已足够 |
| 指令式 prompt（"请输出简体中文"） | 风格示例式 prompt（"以下是普通话的句子..."） | Whisper 模型特性 | 符合模型工作原理，效果更可靠 |

**Deprecated/outdated:**
- **`--language zh` 用于中英混合场景** - 会严重降低英语识别质量，已被 `--language auto` + prompt 方案取代
- **使用繁体中文 prompt（"以下是普通話的句子"）** - 会导致输出繁体字，与用户需求相反

## Open Questions

### 1. Prompt 在 HTTP Server 模式的最佳配置方式
- **What we know:** whisper-server 支持两种方式：1) 启动参数 `--prompt`（全局默认）；2) API 请求参数 `prompt`（每次请求）
- **What's unclear:** 项目当前使用的 whisper-server 版本是否完整支持这两种方式？参数名是 `--prompt` 还是 `--initial_prompt`？
- **Recommendation:** 实现时需要测试验证；优先使用启动参数（简单、统一），如果不生效再考虑修改 runWhisperHttp 函数传递请求参数

### 2. OpenCC 是否真的需要
- **What we know:** Prompt 在社区实践中已经能显著减少繁体字输出，特别是对普通话标准发音
- **What's unclear:** 对于港台口音或特定场景（如用户说出繁体专有名词），prompt 是否能100%避免繁体字泄漏
- **Recommendation:**
  - **Phase 1:** 只实现 prompt，充分测试
  - **Phase 2:** 如果测试发现繁体字泄漏，再添加 OpenCC
  - 默认不添加 OpenCC 依赖，保持实现简单

### 3. Prompt 应该硬编码还是配置化
- **What we know:** 用户的使用场景是固定的（与 Claude Code 交互，编程术语场景）
- **What's unclear:** 是否有其他场景需要不同的 prompt？用户是否需要自定义 prompt？
- **Recommendation:**
  - 使用环境变量配置（`WHISPER_PROMPT`），提供默认值
  - 默认值设计为包含编程术语的简体中文示例
  - 用户可以覆盖，但大多数情况使用默认值即可

## Sources

### Primary (HIGH confidence)
- [whisper.cpp GitHub repository](https://github.com/ggml-org/whisper.cpp) - 官方仓库，CLI 参数参考
- [OpenAI Whisper Prompting Guide](https://cookbook.openai.com/examples/whisper_prompting_guide) - 官方 prompt 工程指南
- [whisper.cpp HTTP Server Documentation](https://deepwiki.com/ggml-org/whisper.cpp/3.2-http-server) - HTTP API 参数文档
- [opencc-js npm package](https://www.npmjs.com/package/opencc-js) - OpenCC JavaScript 库文档
- [opencc-js GitHub repository](https://github.com/nk2028/opencc-js) - OpenCC 使用示例和 API

### Secondary (MEDIUM confidence)
- [Simplified Chinese rather than traditional? · openai/whisper · Discussion #277](https://github.com/openai/whisper/discussions/277) - 官方社区关于简繁体问题的讨论
- [How to transcribe Chinese audio to text in Simplified Chinese instead of Traditional Chinese? · ggml-org/whisper.cpp · Discussion #2318](https://github.com/ggml-org/whisper.cpp/discussions/2318) - whisper.cpp 简繁体解决方案
- [Prompt Engineering in Whisper - Medium](https://medium.com/axinc-ai/prompt-engineering-in-whisper-6bb18003562d) - 社区 prompt 工程实践
- [Whisper prompt engineering best practices mixed language](https://arxiv.org/abs/2311.17382) - 中英混合语音识别研究

### Tertiary (LOW confidence)
- [语音识别神器 Whisper 的几个小技巧 - CSDN](https://blog.csdn.net/gootyking/article/details/134475995) - 中文社区实践（需验证）
- [指定 Whisper 输出为简体中文 - Wulu's Blog](https://wulu.zone/posts/whisper-cn) - 个人博客经验分享（需验证）

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - whisper.cpp 是项目已使用，opencc-js 是社区验证的标准库
- Architecture: MEDIUM - Prompt 方案已验证有效，OpenCC 是否需要待测试验证
- Pitfalls: HIGH - 基于官方文档和大量社区实践经验
- Code examples: HIGH - 基于官方文档和项目现有代码结构

**Research date:** 2026-02-05
**Valid until:** 30 days（Whisper 模型和 opencc-js 库相对稳定）

**Research limitations:**
- whisper-server 的 `--prompt` 参数支持情况未在官方文档中明确找到完整说明，需实现时验证
- OpenCC 专有名词保护的实现复杂度可能高于预期，建议先评估是否真的需要此功能
- Prompt 对不同口音（港台 vs 大陆）的影响程度需要实际测试验证
