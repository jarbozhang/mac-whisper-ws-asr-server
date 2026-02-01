# 目录结构

**分析日期:** 2026-02-02

## 目录布局

```
.
├── .claude/                    # Claude Code 项目配置
│   └── CLAUDE.md              # 项目特定指令 (语言设置)
├── .planning/                  # GSD 规划和代码库映射文档
│   └── codebase/              # 代码库分析文档
├── src/                        # 源代码
│   ├── server.js              # 主服务器入口点
│   ├── config.js              # 环境配置
│   ├── wav.js                 # PCM 到 WAV 转换
│   ├── whisper.js             # whisper.cpp 进程执行器
│   ├── inject.js              # macOS 文本注入
│   └── utils.js               # 共享工具函数
├── node_modules/               # npm 依赖 (git 忽略)
├── .env                        # 环境变量 (git 忽略)
├── .env.example               # 环境变量示例模板
├── .gitignore                 # Git 忽略规则
├── LICENSE                     # MIT 许可证
├── package.json               # npm 包配置
├── README.md                  # 项目文档
├── SPEC.md                    # 规范文档
├── TEST_RESULTS.md            # 测试结果文档
├── test-client.js             # 手动 WebSocket 测试客户端
└── yarn.lock                  # Yarn 依赖锁文件
```

## 关键位置

**核心服务器:**
- `src/server.js` - WebSocket 和 HTTP 服务器,会话管理,消息路由

**配置:**
- `src/config.js` - 集中式配置,从环境变量加载
- `.env` - 实际环境变量 (不提交)
- `.env.example` - 环境变量模板 (已提交,供新用户参考)

**音频处理:**
- `src/wav.js` - WAV 文件格式生成
- `src/whisper.js` - whisper.cpp CLI 包装器

**系统集成:**
- `src/inject.js` - macOS 剪贴板和键盘自动化

**工具:**
- `src/utils.js` - 文件操作、数值限制、时间戳等辅助函数

**测试:**
- `test-client.js` - 项目根目录的手动测试脚本
- `TEST_RESULTS.md` - 测试运行结果和验证

**文档:**
- `README.md` - 安装、使用、配置指南
- `SPEC.md` - 协议和架构规范
- `LICENSE` - 开源许可证 (MIT)

## 命名约定

**文件:**
- 小写,连字符分隔多个单词: `test-client.js`
- 模块文件使用描述性名称匹配其主要导出: `config.js`, `utils.js`
- 源代码文件: `.js` 扩展名 (ES 模块)

**目录:**
- 小写,无空格: `src/`, `node_modules/`
- 隐藏目录以点开头: `.claude/`, `.planning/`
- 特殊目录: `.git/` (版本控制)

**模块组织:**
- 单一用途模块: 每个文件专注于一个关注点
- 扁平结构: `src/` 下无子目录 (小型代码库)
- 导出: 模块导出函数、对象或常量

## 代码组织

**服务器逻辑:**
- 所有源代码在 `src/` 目录
- 主入口点: `src/server.js`
- 无子目录结构 (代码库简单,只有 6 个模块)

**配置管理:**
- 环境变量在 `src/config.js` 中集中
- 从 `.env` 文件加载,带默认值
- 导出的 `config` 对象供其他模块导入

**工具/辅助函数:**
- `src/utils.js` 中的共享工具函数
- 示例: `clampInt()`, `safeUnlink()`, `nowMs()`
- 命名导出供其他模块导入

## 添加新代码的位置

**新 WebSocket 消息类型:**
- 文件: `src/server.js`
- 位置: 在 `wss.on('connection', ...)` 处理程序内添加新的 `if (msg.type === 'new_type')` 分支
- 模式: 遵循现有的 start/end/cancel 模式

**新音频格式支持:**
- 文件: `src/wav.js`
- 添加: 新的格式转换函数 (例如 `mp3ToWavBuffer()`)
- 更新: `src/server.js` 以在 `end` 处理程序中调用新转换器

**新系统集成:**
- 文件: 创建新文件 `src/new-integration.js`
- 位置: 在 `src/` 目录,与 `inject.js` 平级
- 导出: 异步函数供 `src/server.js` 调用

**新配置选项:**
- 文件: `src/config.js`
- 添加: 新的环境变量读取,带默认值
- 示例: `newOption: process.env.NEW_OPTION || 'default'`
- 更新: `.env.example` 以记录新选项

**新工具函数:**
- 文件: `src/utils.js`
- 添加: 新的命名导出函数
- 示例: `export function newHelper() { ... }`

**新测试:**
- 文件: 在项目根目录添加新测试文件 (例如 `test-new-feature.js`)
- 模式: 遵循 `test-client.js` 的结构 (WebSocket 事件监听器,控制台输出)

## 构建输出

**无构建步骤:**
- 不需要编译或转译
- ES 模块直接由 Node.js 运行
- 无 `dist/` 或 `build/` 目录

## 依赖位置

**npm 包:**
- 安装位置: `node_modules/` (git 忽略)
- 锁文件: `yarn.lock` (Yarn) 或 `package-lock.json` (npm)
- 管理: `package.json` 中的 `dependencies`

**外部二进制文件:**
- whisper.cpp: 用户通过 `WHISPER_BIN` 环境变量指定的自定义路径
- 模型文件: 用户通过 `WHISPER_MODEL` 环境变量指定的自定义路径
- 不在项目目录中 - 外部依赖

## 临时/生成文件

**运行时生成:**
- WAV 文件: `${os.tmpdir()}/${uuid}.wav`
- 文本文件: `${os.tmpdir()}/${uuid}.txt`
- 日志文件: `server.log` (如果手动记录)

**Git 忽略:**
```
node_modules/
.env
.DS_Store
.claude/
*.log
```

## 特殊文件

**环境配置:**
- `.env` - 实际秘密和配置 (不提交)
- `.env.example` - 配置模板 (已提交)

**版本控制:**
- `.gitignore` - Git 忽略模式
- `.git/` - Git 仓库元数据

**包管理:**
- `package.json` - npm 元数据和脚本
- `yarn.lock` - Yarn 依赖锁 (精确版本)

**文档:**
- `README.md` - 主项目文档
- `SPEC.md` - 技术规范
- `LICENSE` - 法律许可证文本

---

*结构分析: 2026-02-02*
