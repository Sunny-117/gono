import { mkdir, rm, writeFile } from 'node:fs/promises'
import { builtinModules } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
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

interface BundleArtifacts {
  code: string
  entryPath: string
  sourceUrl: string
  watchFiles: string[]
}

function isFilePath(id: string): boolean {
  return !id.startsWith('\0') && !id.startsWith('virtual:')
}

async function createBundle(entry: string, options: BundleOptions = {}): Promise<BundleArtifacts> {
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

    const watchFiles = new Set<string>()
    if (chunk.modules) {
      for (const id of Object.keys(chunk.modules)) {
        if (isFilePath(id)) {
          watchFiles.add(resolve(id))
        }
      }
    }
    watchFiles.add(entryPath)

    return {
      code: chunk.code,
      entryPath,
      sourceUrl: pathToFileURL(entryPath).href,
      watchFiles: [...watchFiles],
    }
  } finally {
    await bundleObject.close()
  }
}

export async function bundle(entry: string, options: BundleOptions = {}): Promise<string> {
  const { code } = await createBundle(entry, options)
  return code
}

interface ExecuteOptions {
  argv: string[]
  code: string
  sourceUrl: string
}

async function executeModule<TModule extends Record<string, unknown>>({
  argv,
  code,
  sourceUrl,
}: ExecuteOptions): Promise<TModule> {
  const payload = `${code}\n//# sourceURL=${sourceUrl}`
  const uniqueSuffix = `gono-${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  const tempDir = join(tmpdir(), uniqueSuffix)
  const tempFile = join(tempDir, 'module.mjs')

  await mkdir(tempDir, { recursive: true })

  try {
    await writeFile(tempFile, payload, 'utf8')

    const originalArgv = process.argv
    process.argv = argv

    try {
      const fileUrl = pathToFileURL(tempFile).href
      return (await import(fileUrl)) as TModule
    } finally {
      process.argv = originalArgv
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}

export interface RunWithWatchResult<TModule> {
  module: TModule
  watchFiles: string[]
}

export async function run<TModule extends Record<string, unknown> = Record<string, unknown>>(
  entry: string,
  options: RunOptions = {},
): Promise<TModule> {
  const { module } = await runWithWatch<TModule>(entry, options)
  return module
}

export async function runWithWatch<
  TModule extends Record<string, unknown> = Record<string, unknown>,
>(entry: string, options: RunOptions = {}): Promise<RunWithWatchResult<TModule>> {
  const { code, entryPath, sourceUrl, watchFiles } = await createBundle(entry, options)
  const argv = options.argv ?? [process.execPath, entryPath]

  const module = await executeModule<TModule>({ argv, code, sourceUrl })

  return { module, watchFiles }
}
