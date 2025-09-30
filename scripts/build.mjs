#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { builtinModules } from 'node:module'
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { build } from 'rolldown'

const execFileAsync = promisify(execFile)
const distDir = resolve('dist')

const external = [...new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`), 'rolldown'])]

async function run() {
  await rm(distDir, { recursive: true, force: true })

  await build({
    input: {
      index: './src/index.ts',
      cli: './src/cli.ts',
    },
    external,
    treeshake: false,
    platform: 'node',
    output: {
      dir: distDir,
      format: 'esm',
      entryFileNames: '[name].js',
      chunkFileNames: 'chunks/[name]-[hash].js',
      sourcemap: true,
      exports: 'named',
    },
  })

  await build({
    input: {
      index: './src/index.ts',
    },
    external,
    treeshake: false,
    platform: 'node',
    output: {
      dir: distDir,
      format: 'cjs',
      entryFileNames: '[name].cjs',
      chunkFileNames: 'chunks/[name]-[hash].cjs',
      sourcemap: true,
      exports: 'named',
    },
  })

  await execFileAsync('tsc', ['--emitDeclarationOnly', '--outDir', distDir])
}

try {
  await run()
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
