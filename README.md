# gono [![npm](https://img.shields.io/npm/v/gono.svg)](https://npmjs.com/package/gono)

> ⚡️ Run and iterate on TypeScript entrypoints with Rolldown-powered bundling, sourcemaps, and a fast watch mode.

## Features

- **Instant TypeScript execution** – bundle once with Rolldown and execute in Node.js without manual compilation.
- **First-class watch mode** – run `gono watch <entry.ts>` (or use `--watch` / `-w`) to automatically rebuild and rerun on dependency changes with concise console feedback.
- **Inline sourcemaps** – stack traces map back to your original TypeScript thanks to inline sourcemaps.
- **Programmatic API** – import `run`, `runWithWatch`, or `bundle` for advanced workflows like testing or embedding in custom CLIs.

## Requirements

- Node.js **18.12.0 or newer** (matching the engine range of Rolldown bindings).

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

```bash
pnpm test       # run vitest test suite
pnpm build      # produce distribution files via tsup
pnpm lint       # run eslint
pnpm typecheck  # ensure TypeScript types are sound
```

## License

MIT © Sunny-117

