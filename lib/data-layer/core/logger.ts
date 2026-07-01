export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LogContext {
  providerId?: string;
  operation?: string;
  durationMs?: number;
  cached?: boolean;
  attempt?: number;
  [key: string]: unknown;
}

class DataLayerLogger {
  private minLevel: LogLevel = "info";

  setLevel(level: LogLevel) {
    this.minLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.minLevel];
  }

  private format(level: LogLevel, message: string, context?: LogContext): string {
    const payload = {
      ts: new Date().toISOString(),
      level,
      layer: "data-layer",
      message,
      ...context,
    };
    return JSON.stringify(payload);
  }

  debug(message: string, context?: LogContext) {
    if (this.shouldLog("debug")) console.debug(this.format("debug", message, context));
  }

  info(message: string, context?: LogContext) {
    if (this.shouldLog("info")) console.info(this.format("info", message, context));
  }

  warn(message: string, context?: LogContext) {
    if (this.shouldLog("warn")) console.warn(this.format("warn", message, context));
  }

  error(message: string, context?: LogContext) {
    if (this.shouldLog("error")) console.error(this.format("error", message, context));
  }
}

export const dataLayerLogger = new DataLayerLogger();
