export type LogLevel = "debug" | "info" | "warn" | "error";

const rank: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export class Logger {
  constructor(private readonly minimum: LogLevel = "info") {}

  private write(level: LogLevel, message: string, data: Record<string, unknown> = {}): void {
    if (rank[level] < rank[this.minimum]) return;
    const entry = { timestamp: new Date().toISOString(), level, message, ...data };
    const output = JSON.stringify(entry);
    if (level === "error") console.error(output);
    else if (level === "warn") console.warn(output);
    else console.log(output);
  }

  debug(message: string, data?: Record<string, unknown>): void { this.write("debug", message, data); }
  info(message: string, data?: Record<string, unknown>): void { this.write("info", message, data); }
  warn(message: string, data?: Record<string, unknown>): void { this.write("warn", message, data); }
  error(message: string, data?: Record<string, unknown>): void { this.write("error", message, data); }
}
