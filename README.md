# gono [![npm](https://img.shields.io/npm/v/gono.svg)](https://npmjs.com/package/gono)

> ⚡️ Run and iterate on TypeScript entrypoints with Rolldown-powered bundling, sourcemaps, and a fast watch mode.

## Features

- **Instant TypeScript execution** – bundle once with Rolldown and execute in Node.js without manual compilation.
- **First-class watch mode** – run `gono watch <entry.ts>` (or use `--watch` / `-w`) to automatically rebuild and rerun on dependency changes with concise console feedback.
- **Inline sourcemaps** – stack traces map back to your original TypeScript thanks to inline sourcemaps.
- **Programmatic API** – import `run`, `runWithWatch`, or `bundle` for advanced workflows like testing or embedding in custom CLIs.

## Requirements

- Node.js **16.0.0 or newer** (matching the engine range of Rolldown bindings).

## Installation

```bash
# choose the package manager you prefer
pnpm add -D gono
npm install -D gono
yarn add -D gono
```

## CLI Usage

Run a TypeScript entry file once:

```bash
npx gono src/index.ts --flag value
```

Start watch mode (also available through the `--watch` or `-w` flag):

```bash
npx gono watch src/server.ts
# equivalent
npx gono --watch src/server.ts
```

The CLI resolves the entry path, bundles it with Rolldown, and executes the output in a Node.js runtime. When watch mode is enabled, gono listens to all imported files, logs file system events, and reruns the bundle after a short debounce.

## Why gono when Node has `--watch` and TypeScript loaders?

Recent versions of Node.js add `node --watch` and experimental TypeScript execution, but gono still fills several gaps:

- **Consistent support from Node 18+** – no need to require the very latest Node release or toggle experimental flags; gono works anywhere Rolldown runs.
- **Bundler-grade transforms** – Rolldown handles modern TypeScript/JS syntax, JSX, decorators, and path aliases the same way as production builds, avoiding surprises between dev and build stages.
- **Dependency-aware watch mode** – gono watches only the files that Rolldown discovers, debounces restarts, and prints uniform feedback so long-running scripts remain readable.
- **Programmatic control** – libraries or tooling can call `runWithWatch` to embed the same workflow without shelling out to `node`.
- **Single binary UX** – no manual `--loader`, `--watch`, or config wiring; `gono` encapsulates the setup for teams that just want `gono entry.ts` to work.

## Programmatic API

```ts
import { bundle, run, runWithWatch } from 'gono'

// Produce an ESM bundle as a string
const code = await bundle('src/entry.ts', { sourcemap: true })

// Execute an entry once
const module = await run('src/entry.ts', { argv: [process.execPath, 'src/entry.ts', '--flag'] })

// Execute and retrieve the file graph (useful for custom watchers)
const { module: watchedModule, watchFiles } = await runWithWatch('src/entry.ts')
```

All APIs accept the same `sourcemap` option as the CLI. `runWithWatch` returns both the module exports and the list of files Rolldown touched, which underpins the CLI watch mode.

## Development

Clone the repository and install dependencies with your preferred package manager (`pnpm install` is recommended). The main scripts are:

**Node.js Version v20.19.4+**

```bash
pnpm test       # run vitest test suite
pnpm build      # produce distribution files via tsup
pnpm lint       # run eslint
pnpm typecheck  # ensure TypeScript types are sound
```

## License

MIT © Sunny-117
