/**
 * ATHENA NEWS ENGINE V3 — STRUCTURED LOGGER
 * 
 * Institutional structured JSON logger with correlation IDs, 
 * log levels, subscriber hooks, and standardized fields.
 */

export type V3LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface V3LogEntry {
  timestamp: string;
  level: V3LogLevel;
  message: string;
  module: string;
  correlationId?: string;
  requestId?: string;
  data?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export type V3LogListener = (entry: V3LogEntry) => void;

export class V3Logger {
  private static instance: V3Logger;
  private minLevel: V3LogLevel = 'INFO';
  private listeners: Set<V3LogListener> = new Set();
  private recentLogs: V3LogEntry[] = [];
  private maxStoredLogs = 500;

  private levelWeights: Record<V3LogLevel, number> = {
    TRACE: 10,
    DEBUG: 20,
    INFO: 30,
    WARN: 40,
    ERROR: 50
  };

  private constructor() {}

  public static getInstance(): V3Logger {
    if (!V3Logger.instance) {
      V3Logger.instance = new V3Logger();
    }
    return V3Logger.instance;
  }

  public setMinLevel(level: V3LogLevel): void {
    this.minLevel = level;
  }

  public subscribe(listener: V3LogListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public trace(module: string, message: string, data?: Record<string, any>, correlationId?: string): void {
    this.log('TRACE', module, message, data, undefined, correlationId);
  }

  public debug(module: string, message: string, data?: Record<string, any>, correlationId?: string): void {
    this.log('DEBUG', module, message, data, undefined, correlationId);
  }

  public info(module: string, message: string, data?: Record<string, any>, correlationId?: string): void {
    this.log('INFO', module, message, data, undefined, correlationId);
  }

  public warn(module: string, message: string, data?: Record<string, any>, correlationId?: string): void {
    this.log('WARN', module, message, data, undefined, correlationId);
  }

  public error(module: string, message: string, err?: Error | unknown, data?: Record<string, any>, correlationId?: string): void {
    const errorObj = err instanceof Error ? {
      name: err.name,
      message: err.message,
      stack: err.stack
    } : err ? { name: 'UnknownError', message: String(err) } : undefined;

    this.log('ERROR', module, message, data, errorObj, correlationId);
  }

  private log(
    level: V3LogLevel,
    module: string,
    message: string,
    data?: Record<string, any>,
    error?: V3LogEntry['error'],
    correlationId?: string
  ): void {
    if (this.levelWeights[level] < this.levelWeights[this.minLevel]) {
      return;
    }

    const entry: V3LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      correlationId,
      data,
      error
    };

    // Store in buffer
    this.recentLogs.push(entry);
    if (this.recentLogs.length > this.maxStoredLogs) {
      this.recentLogs.shift();
    }

    // Output JSON to console
    const jsonOutput = JSON.stringify(entry);
    if (level === 'ERROR') {
      console.error(jsonOutput);
    } else if (level === 'WARN') {
      console.warn(jsonOutput);
    } else {
      console.log(jsonOutput);
    }

    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(entry);
      } catch (e) {
        // Prevent listener error from breaking log stream
      }
    });
  }

  public getRecentLogs(limit: number = 50, levelFilter?: V3LogLevel): V3LogEntry[] {
    let filtered = this.recentLogs;
    if (levelFilter) {
      filtered = filtered.filter(l => l.level === levelFilter);
    }
    return filtered.slice(-limit);
  }

  public clearLogs(): void {
    this.recentLogs = [];
  }
}
