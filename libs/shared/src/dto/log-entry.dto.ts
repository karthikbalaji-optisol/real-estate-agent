export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
export type LogService = 'nestjs-api' | 'python';

export class LogEntryDto {
  level: LogLevel;
  timestamp: string;
  service: LogService;
  context: string;
  message: string;
  metadata?: Record<string, unknown>;
}
