# 项目介绍：gono

## 项目概述

gono 是一个基于 Rolldown 的 TypeScript 运行时工具，目标是在 Node.js 环境中以最少的配置获得快速的编译、执行与调试体验。项目提供命令行工具与可编程接口，既能满足脚本式的一次性执行，也能支撑持续迭代的开发场景。

## 核心特性

- **Rolldown 打包驱动**：使用 Rolldown 将 TypeScript 源码打包成单个 ESM 模块，并向 Node.js 注入 sourcemap，保证调试体验。
- **极速 Watch 模式**：内置 chokidar 文件监听，自动追踪 Rolldown 返回的依赖列表，文件变更后快速重新打包与执行。
- **双重接口形态**：提供命令行入口与 `run` / `runWithWatch` / `bundle` 等 API，方便在脚本、测试框架或自定义工具中复用。
- **Node.js 原生兼容**：默认 External Node.js 内置模块与 Rolldown 自身依赖，避免额外打包体积，并兼容 WASI 绑定加载逻辑。

## 组件结构

| 模块 | 说明 |
| --- | --- |
| `src/index.ts` | 暴露核心的打包与执行函数，处理 Rolldown 加载、依赖获取与 sourcemap 注入。
| `src/cli.ts` | CLI 入口，负责解析命令参数、管理 watch 生命周期及信号处理。
| `tests/index.test.ts` | 使用 Vitest 覆盖 CLI 与 API 的关键行为，确保打包与 watch 输出稳定。

### Watch 模式执行流程

1. CLI 解析命令参数，确定入口文件与是否启用 watch。
2. 首次执行时调用 `runWithWatch`，获得模块导出与 Rolldown 返回的依赖列表。
3. 将依赖列表注册到 chokidar，并在文件变更时触发重新执行。
4. 采用短暂的去抖机制防止频繁重启，同时为每次执行打印耗时信息与文件事件提示。

## 命令行使用速览

```bash
# 单次运行
npx gono src/main.ts

# watch 语法糖
npx gono watch src/main.ts
# 等价写法
npx gono --watch src/main.ts
```

命令行会自动为入口文件拼接 Node.js `argv`，并在出错时打印 stack trace（映射回 TypeScript 源码）。

## 可编程 API

```ts
import { bundle, run, runWithWatch } from 'gono'

await bundle('src/task.ts', { sourcemap: true })
await run('src/task.ts', { argv: [process.execPath, 'src/task.ts'] })
const { module, watchFiles } = await runWithWatch('src/task.ts')
```

- `bundle(entry, options)`：仅生成打包后的代码字符串，适合自定义执行逻辑。
- `run(entry, options)`：执行入口文件并返回模块导出，自动处理 `argv`。
- `runWithWatch(entry, options)`：在执行的基础上返回依赖文件列表，便于集成其他监听方案。

## 适用场景

- 需要快速运行 TypeScript 脚本或原型验证的 Node.js 项目。
- 对 CLI 工具、自动化脚本、测试框架等进行本地调试时，希望获得实时重载体验。
- 想要将 Rolldown 引入到现有工作流，但又希望保持最小接入成本的团队。

## 开发与维护

- **依赖管理**：推荐使用 `pnpm`，项目内置 `pnpm test`、`pnpm lint`、`pnpm build` 等脚本。
- **测试**：Vitest 覆盖运行接口和 watch 功能，新增能力时应补充相应测试用例。
- **发布流程**：通过 `pnpm run release` 与 `pnpm publish` 自动 bump 版本并推送至 npm。

## 后续拓展方向

- 增强 CLI 输出格式，提供静默/详细模式切换。
- 支持自定义 Rolldown 配置或插件注入，满足更复杂的打包场景。
- 集成 TypeScript 类型检查缓存，提升 watch 模式下的类型诊断效率。
