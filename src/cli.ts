#!/usr/bin/env node

import { realpathSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import cac from 'cac'
import chokidar from 'chokidar'
import pkg from '../package.json' assert { type: 'json' }
import { run, runWithWatch } from './index.js'

const WATCH_EVENTS = new Set(['add', 'addDir', 'change', 'unlink', 'unlinkDir'])

interface CLIArguments {
  entry?: string
  entryArgs: string[]
  watch: boolean
}

function resolveArguments(argv: readonly string[], hasWatchOption: boolean): CLIArguments {
  let watch = hasWatchOption
  const normalized: string[] = []

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]

    if (value === '--watch' || value === '-w') {
      watch = true
      continue
    }

    normalized.push(value)
  }

  let entry = normalized.shift()

  if (!watch && entry === 'watch') {
    watch = true
    entry = normalized.shift()
  }

  return { entry, entryArgs: normalized, watch }
}

async function startWatch(entryPath: string, scriptArgv: string[]): Promise<void> {
  let closing = false
  let restartPending = false
  let restartTimer: NodeJS.Timeout | null = null
  let running: Promise<void> | null = null
  let watchedFiles = new Set<string>([entryPath])

  const watcher = chokidar.watch(entryPath, { ignoreInitial: true })

  const finalize = async () => {
    if (closing)
      return
    closing = true
    if (restartTimer) {
      clearTimeout(restartTimer)
      restartTimer = null
    }
    if (running) {
      try {
        await running
      }
      catch {
        // ignore errors during shutdown
      }
    }
    await watcher.close()
  }

  const closePromise = new Promise<void>((resolve) => {
    const handleSignal = () => {
      void finalize().finally(resolve)
    }
    process.once('SIGINT', handleSignal)
    process.once('SIGTERM', handleSignal)
  })

  const updateWatchFiles = (files: readonly string[]) => {
    const next = new Set<string>([entryPath])
    for (const file of files) {
      next.add(resolve(file))
    }

    const toAdd: string[] = []
    const toRemove: string[] = []

    for (const file of next) {
      if (!watchedFiles.has(file)) {
        toAdd.push(file)
      }
    }

    for (const file of watchedFiles) {
      if (!next.has(file)) {
        toRemove.push(file)
      }
    }

    if (toAdd.length > 0) {
      watcher.add(toAdd)
    }

    if (toRemove.length > 0) {
      watcher.unwatch(toRemove)
    }

    watchedFiles = next
  }

  const runEntry = async () => {
    const start = performance.now()
    try {
      const { watchFiles } = await runWithWatch(entryPath, { argv: scriptArgv, sourcemap: true })
      updateWatchFiles(watchFiles)
      const duration = Math.round(performance.now() - start)
      console.log(`[gono] Ran ${relative(process.cwd(), entryPath)} in ${duration}ms`)
    }
    catch (error) {
      if (error instanceof Error) {
        console.error(error.stack ?? error.message)
      }
      else {
        console.error(error)
      }
    }
  }

  const scheduleRestart = () => {
    if (closing)
      return
    restartPending = true

    if (restartTimer) {
      clearTimeout(restartTimer)
    }

    restartTimer = setTimeout(() => {
      restartTimer = null
      if (running) {
        return
      }

      restartPending = false
      running = runEntry()
        .finally(() => {
          running = null
          if (restartPending) {
            restartPending = false
            scheduleRestart()
          }
        })
        .catch((error) => {
          console.error(error)
        })
    }, 50)
  }

  watcher.on('all', (event, changedPath) => {
    if (closing)
      return
    if (!WATCH_EVENTS.has(event))
      return
    const relativePath = relative(process.cwd(), changedPath)
    console.log(`[gono] ${event} ${relativePath}`)
    scheduleRestart()
  })

  watcher.on('error', (error) => {
    if (closing)
      return
    console.error(error)
  })

  running = runEntry()
  try {
    await running
  }
  finally {
    running = null
  }

  console.log('[gono] Watching for changes...')

  await closePromise
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const cli = cac('gono')

  cli
    .usage('[options] <entry-file> [...args]')
    .option('--watch, -w', 'Run the entry file in watch mode')

  cli.help()
  cli.version(pkg.version)
  cli.showVersionOnExit = false

  const parsed = cli.parse(['node', 'gono', ...argv], { run: false })

  if (parsed.options.help) {
    cli.outputHelp()
    return 0
  }

  if (parsed.options.version) {
    console.log(pkg.version)
    return 0
  }

  const { entry, entryArgs, watch } = resolveArguments(argv, Boolean(parsed.options.watch))

  if (!entry) {
    cli.outputHelp()
    return 1
  }

  const entryPath = resolve(entry)
  const scriptArgv = [process.execPath, entryPath, ...entryArgs]

  try {
    if (watch) {
      await startWatch(entryPath, scriptArgv)
    }
    else {
      await run(entryPath, { argv: scriptArgv, sourcemap: true })
    }
    return 0
  }
  catch (error) {
    if (error instanceof Error) {
      console.error(error.stack ?? error.message)
    }
    else {
      console.error(error)
    }
    return 1
  }
}

let invokedAsScript = false
if (typeof process.argv[1] === 'string') {
  try {
    const argvRealPath = realpathSync(process.argv[1])
    const scriptRealPath = realpathSync(fileURLToPath(import.meta.url))
    invokedAsScript = argvRealPath === scriptRealPath
  }
  catch {
    invokedAsScript = false
  }

  if (!invokedAsScript) {
    invokedAsScript = pathToFileURL(process.argv[1]).href === import.meta.url
  }
}

if (invokedAsScript) {
  const code = await main()
  if (code !== 0) {
    process.exit(code)
  }
}
