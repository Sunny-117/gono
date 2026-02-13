/**
 * Logger utility using consola
 * Provides styled and colorful terminal output
 */

import { consola, createConsola } from 'consola'

// Create a custom consola instance with gono tag
const gonoLogger = createConsola({
  defaults: {
    tag: 'gono',
  },
})

export const logger = {
  /**
   * Log successful execution with timing
   */
  success(file: string, duration: number): void {
    gonoLogger.success(`Ran \`${file}\` in ${duration}ms`)
  },

  /**
   * Log file change event in watch mode
   */
  change(event: string, relativePath: string): void {
    const eventEmoji: Record<string, string> = {
      add: '➕',
      addDir: '📁',
      change: '✏️',
      unlink: '🗑️',
      unlinkDir: '📂',
    }

    const emoji = eventEmoji[event] || '•'
    gonoLogger.info(`${emoji} ${event} ${relativePath}`)
  },

  /**
   * Log watch mode start message
   */
  watching(): void {
    gonoLogger.start('Watching for changes...')
  },

  /**
   * Log error messages
   */
  error(error: unknown): void {
    if (error instanceof Error) {
      gonoLogger.error(error)
    }
    else {
      gonoLogger.error(String(error))
    }
  },

  /**
   * Log warning messages
   */
  warn(message: string): void {
    gonoLogger.warn(message)
  },

  /**
   * Log unknown options error
   */
  unknownOptions(options: string[]): void {
    const label = options.length > 1 ? 'options' : 'option'
    gonoLogger.error(`Unknown ${label}: ${options.join(', ')}`)
    gonoLogger.info('Run `gono --help` to see available options.')
  },

  /**
   * Log version
   */
  version(version: string): void {
    consola.log(version)
  },

  /**
   * Log info message
   */
  info(message: string): void {
    gonoLogger.info(message)
  },

  /**
   * Log ready state
   */
  ready(message: string): void {
    gonoLogger.ready(message)
  },

  /**
   * Log box message (for important announcements)
   */
  box(message: string): void {
    gonoLogger.box(message)
  },
}
