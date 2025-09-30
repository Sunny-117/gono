#!/usr/bin/env node

import chokidar from 'chokidar'
import { performance } from 'node:perf_hooks'
import { relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { run, runWithWatch } from './index.js'

const WATCH_EVENTS = new Set(['add', 'addDir', 'change', 'unlink', 'unlinkDir'])

interface ParsedArguments {
  entry?: string
  entryArgs: string[]
  watch: boolean
}

function parseArguments(argv: string[]): ParsedArguments {
  let watch = false
  const normalized: string[] = []

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]

    if (index === 0 && value === 'watch') {
      watch = true
      continue
    }

    if (value === '--watch' || value === '-w') {
      watch = true
      continue
    }

    normalized.push(value)
  }

  const [entry, ...entryArgs] = normalized

  return { entry, entryArgs, watch }
}

async function startWatch(entryPath: string, scriptArgv: string[]): Promise<void> {
  let closing = false
  let restartPending = false
  let restartTimer: NodeJS.Timeout | null = null
  let running: Promise<void> | null = null
  let watchedFiles = new Set<string>([entryPath])

  const watcher = chokidar.watch(entryPath, { ignoreInitial: true })

  const finalize = async () => {
    if (closing) return
    closing = true
    if (restartTimer) {
      clearTimeout(restartTimer)
      restartTimer = null
    }
    if (running) {
      try {
        await running
      } catch {
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
      console.log(`[rono] Ran ${relative(process.cwd(), entryPath)} in ${duration}ms`)
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.stack ?? error.message)
      } else {
        console.error(error)
      }
    }
  }

  const scheduleRestart = () => {
    if (closing) return
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
    if (closing) return
    if (!WATCH_EVENTS.has(event)) return
    const relativePath = relative(process.cwd(), changedPath)
    console.log(`[rono] ${event} ${relativePath}`)
    scheduleRestart()
  })

  watcher.on('error', (error) => {
    if (closing) return
    console.error(error)
  })

  running = runEntry()
  try {
    await running
  } finally {
    running = null
  }

  console.log('[rono] Watching for changes...')

  await closePromise
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const { entry, entryArgs, watch } = parseArguments(argv)

  if (!entry) {
    console.error('Usage: rono [watch|--watch|-w] <entry-file> [...args]')
    return 1
  }

  const entryPath = resolve(entry)
  const scriptArgv = [process.execPath, entryPath, ...entryArgs]

  if (watch) {
    await startWatch(entryPath, scriptArgv)
    return 0
  }

  try {
    await run(entryPath, { argv: scriptArgv, sourcemap: true })
    return 0
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.stack ?? error.message)
    } else {
      console.error(error)
    }
    return 1
  }
}

let invokedAsScript = false
if (typeof process.argv[1] === 'string') {
  invokedAsScript = pathToFileURL(process.argv[1]).href === import.meta.url
}

if (invokedAsScript) {
  const code = await main()
  if (code !== 0) {
    process.exit(code)
  }
}
