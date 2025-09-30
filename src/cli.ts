#!/usr/bin/env node

import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { run } from './index.js'

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  if (argv.length === 0) {
    console.error('Usage: rono <entry-file> [...args]')
    return 1
  }

  const [entry, ...entryArgs] = argv
  const entryPath = resolve(entry)
  const scriptArgv = [process.execPath, entryPath, ...entryArgs]

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
