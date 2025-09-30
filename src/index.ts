import { builtinModules } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { OutputChunk } from 'rolldown'

const NODE_BUILTINS = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)])
const MISSING_NATIVE_BINDING = /Cannot find module '@rolldown\/binding/

function isMissingRolldownBinding(error: unknown): error is Error {
  return (
    error instanceof Error &&
    ((typeof error.message === 'string' && error.message.includes('Cannot find native binding')) ||
      MISSING_NATIVE_BINDING.test(error.message))
  )
}

type RolldownModule = typeof import('rolldown')

let rolldownPromise: Promise<RolldownModule> | null = null

async function loadRolldown(): Promise<RolldownModule> {
  if (rolldownPromise) return rolldownPromise

  rolldownPromise = (async () => {
    try {
      return await import('rolldown')
    } catch (error) {
      if (isMissingRolldownBinding(error)) {
        if (!process.env.NAPI_RS_FORCE_WASI) {
          process.env.NAPI_RS_FORCE_WASI = '1'
        }
        return import('rolldown')
      }
      throw error
    }
  })()

  return rolldownPromise
}

export interface BundleOptions {
  sourcemap?: boolean
}

export interface RunOptions extends BundleOptions {
  argv?: string[]
}

export async function bundle(entry: string, options: BundleOptions = {}): Promise<string> {
  const entryPath = resolve(entry)
  const { rolldown } = await loadRolldown()
  const bundleObject = await rolldown({
    input: entryPath,
    platform: 'node',
    external: (id) => NODE_BUILTINS.has(id) || id === 'rolldown',
    treeshake: false,
  })

  try {
    const { output } = await bundleObject.generate({
      format: 'esm',
      sourcemap: options.sourcemap ? 'inline' : false,
      hoistTransitiveImports: false,
    })

    const chunk = output.find((item): item is OutputChunk => item.type === 'chunk')
    if (!chunk) {
      throw new Error('Failed to produce output chunk')
    }

    return chunk.code
  } finally {
    await bundleObject.close()
  }
}

export async function run<TModule extends Record<string, unknown> = Record<string, unknown>>(
  entry: string,
  options: RunOptions = {},
): Promise<TModule> {
  const entryPath = resolve(entry)
  const code = await bundle(entryPath, options)
  const sourceUrl = pathToFileURL(entryPath).href
  const payload = `${code}\n//# sourceURL=${sourceUrl}`
  const dataUrl = `data:text/javascript;base64,${Buffer.from(payload, 'utf8').toString('base64')}`

  const originalArgv = process.argv
  const nextArgv = options.argv ?? [process.execPath, entryPath]
  process.argv = nextArgv

  try {
    return (await import(dataUrl)) as TModule
  } finally {
    process.argv = originalArgv
  }
}
