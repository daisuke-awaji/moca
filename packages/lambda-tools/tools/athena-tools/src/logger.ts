/**
 * Structured logging utility
 *
 * Outputs single-line JSON logs with automatic request ID injection
 * and log level filtering.
 */

interface LogContext {
  [key: string]: unknown;
}

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

class Logger {
  private reqId?: string;
  private logLevel: LogLevel = 'INFO';

  /**
   * Set the request ID (auto-injected into all logs)
   */
  setRequestId(reqId: string): void {
    this.reqId = reqId;
  }

  /**
   * Set the log level threshold
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private getLogLevelValue(level: LogLevel): number {
    const levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
    return levels[level];
  }

  private log(level: LogLevel, tag: string, data: LogContext): void {
    if (this.getLogLevelValue(level) < this.getLogLevelValue(this.logLevel)) {
      return;
    }

    const logData = this.reqId ? { reqId: this.reqId, ...data } : data;
    const processedData = this.processErrorObjects(logData);
    const logMessage = `[${tag}] ${JSON.stringify(processedData)}`;

    switch (level) {
      case 'ERROR':
        console.error(logMessage);
        break;
      case 'WARN':
        console.warn(logMessage);
        break;
      case 'DEBUG':
      case 'INFO':
      default:
        console.log(logMessage);
        break;
    }
  }

  private processErrorObjects(obj: unknown): unknown {
    if (obj instanceof Error) {
      return {
        message: obj.message,
        name: obj.name,
        stack: obj.stack,
      };
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.processErrorObjects(item));
    }

    if (typeof obj === 'object' && obj !== null) {
      const processed: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        processed[key] = this.processErrorObjects(value);
      }
      return processed;
    }

    return obj;
  }

  debug(tag: string, data: LogContext = {}): void {
    this.log('DEBUG', tag, data);
  }

  info(tag: string, data: LogContext = {}): void {
    this.log('INFO', tag, data);
  }

  warn(tag: string, data: LogContext = {}): void {
    this.log('WARN', tag, data);
  }

  error(tag: string, data: LogContext = {}): void {
    this.log('ERROR', tag, data);
  }
}

/**
 * Singleton logger instance
 */
export const logger = new Logger();

// Configure log level from environment variable
const envLogLevel = process.env.LOG_LEVEL?.toUpperCase() as LogLevel;
if (envLogLevel && ['DEBUG', 'INFO', 'WARN', 'ERROR'].includes(envLogLevel)) {
  logger.setLogLevel(envLogLevel);
}
