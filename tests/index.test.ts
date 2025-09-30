import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { main } from '../src/cli'
import { run } from '../src/index'

let workspace: string

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'rono-test-'))
})

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true })
})

test('run executes TypeScript modules and returns exports', async () => {
  const entry = join(workspace, 'hello.ts')
  await writeFile(
    entry,
    `export const answer: number = 42
export default function greet(name: string): string {
  return 'Hello ' + name
}
`,
    'utf8',
  )

  const module = (await run(entry)) as { answer: number; default: (name: string) => string }
  expect(module.answer).toBe(42)
  expect(module.default('Rolldown')).toBe('Hello Rolldown')
})

test('cli runs entry file and forwards arguments', async () => {
  const entry = join(workspace, 'cli-entry.ts')
  await writeFile(
    entry,
    `if (process.argv[3] !== 'ok') {
  throw new Error('Expected argument')
}
console.log('cli-ran')
`,
    'utf8',
  )

  const logs: string[] = []
  const spy = vi.spyOn(console, 'log').mockImplementation((value?: unknown) => {
    logs.push(String(value))
  })

  const exitCode = await main([entry, '--flag', 'ok'])
  spy.mockRestore()

  expect(exitCode).toBe(0)
  expect(logs).toContain('cli-ran')
})
