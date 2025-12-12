import fs from 'fs'
import path from 'path'
import type { LogObject } from 'consola'
import { createConsola } from 'consola'

const logDir = path.join(process.cwd(), 'data', 'logs')
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

const logFilePath = path.join(logDir, 'app.log')

// Safe JSON stringify that handles circular references
const safeStringify = (obj: any, space?: number): string => {
  const seen = new WeakSet()
  return JSON.stringify(
    obj,
    (key, value) => {
      // Skip circular references
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]'
        }
        seen.add(value)
      }
      // Remove common circular reference sources
      if (key === 'req' || key === 'res' || key === 'socket' || key === 'client') {
        return '[Object]'
      }
      // Handle Error objects
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack,
        }
      }
      return value
    },
    space
  )
}

const logFileReporter = {
  log: (logObj: LogObject) => {
    try {
      const logLine = `${safeStringify(logObj)}\n`
      fs.appendFile(logFilePath, logLine, (err) => {
        if (err) {
          console.error('Failed to write log to file:', err)
        }
      })
    } catch (error) {
      // Fallback if stringify still fails
      const fallbackLog = {
        date: logObj.date,
        level: logObj.level,
        tag: logObj.tag,
        type: logObj.type,
        args: logObj.args?.map((arg: any) => {
          if (arg instanceof Error) {
            return { name: arg.name, message: arg.message, stack: arg.stack }
          }
          if (typeof arg === 'object' && arg !== null) {
            try {
              return safeStringify(arg)
            } catch {
              return '[Object]'
            }
          }
          return arg
        }) || [],
      }
      const logLine = `${safeStringify(fallbackLog)}\n`
    fs.appendFile(logFilePath, logLine, (err) => {
      if (err) {
        console.error('Failed to write log to file:', err)
      }
    })
    }
  },
}

const mConsola = createConsola({
  formatOptions: {
    date: true,
    colors: true,
    compact: false,
  },
})

mConsola.addReporter(logFileReporter)

export const logger = {
  chrono: mConsola.withTag('cframe/main'),
  storage: mConsola.withTag('cframe/storage'),
  fs: mConsola.withTag('cframe/fs'),
  image: mConsola.withTag('cframe/image'),
  location: mConsola.withTag('cframe/location'),
  dynamic: (id: string) => mConsola.withTag(`cframe/${id}`),
}

export type Logger = Omit<typeof logger, 'dynamic'>
export type DynamicLogger = typeof logger.dynamic
