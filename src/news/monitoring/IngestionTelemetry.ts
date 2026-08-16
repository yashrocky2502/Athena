import { IngestionError } from './HealthMonitor.ts';

export interface IngestionLogEntry {
    timestamp: string;
    count: number;
    duplicates: number;
    collector?: string;
}

export interface MalformedRecordEntry {
    timestamp: string;
    payload: any;
    errors: string[];
}

export class IngestionTelemetry {
    private static instance: IngestionTelemetry | null = null;

    public articlesAdded = 0;
    public duplicatesRejected = 0;
    public ingestionAttempts = 0;
    public ingestionFailures = 0;
    public successfulBatches = 0;
    public malformedRecords = 0;
    public validationFailures = 0;
    public lastSuccessfulIngestion: string | null = null;
    public lastFailedIngestion: string | null = null;

    private ingestionHistory: IngestionLogEntry[] = [];
    private errorLog: IngestionError[] = [];
    private malformedLog: MalformedRecordEntry[] = [];

    private constructor() {}

    public static getInstance(): IngestionTelemetry {
        if (!this.instance) {
            this.instance = new IngestionTelemetry();
        }
        return this.instance;
    }

    public recordAttempt(): void {
        this.ingestionAttempts++;
    }

    public recordSuccess(savedCount: number, duplicatesCount: number, collector = 'UNKNOWN'): void {
        this.articlesAdded += savedCount;
        this.duplicatesRejected += duplicatesCount;
        this.successfulBatches++;
        this.lastSuccessfulIngestion = new Date().toISOString();
        
        this.ingestionHistory.push({
            timestamp: new Date().toISOString(),
            count: savedCount,
            duplicates: duplicatesCount,
            collector
        });

        // Cap history to 500 entries to prevent memory leaks
        if (this.ingestionHistory.length > 500) {
            this.ingestionHistory.shift();
        }
    }

    public recordFailure(errClass: IngestionError['errorClass'], message: string, collector: string): void {
        this.ingestionFailures++;
        this.lastFailedIngestion = new Date().toISOString();
        this.recordError({
            timestamp: new Date().toISOString(),
            collector,
            errorClass: errClass,
            message,
            retryStatus: 'none',
            canonicalStorageModified: false
        });
    }

    public recordMalformed(payload: any, errors: string[]): void {
        this.malformedRecords++;
        this.validationFailures += errors.length;
        this.malformedLog.push({
            timestamp: new Date().toISOString(),
            payload,
            errors
        });

        // Cap malformed log to 100 entries
        if (this.malformedLog.length > 100) {
            this.malformedLog.shift();
        }
    }

    public recordError(error: IngestionError): void {
        this.errorLog.push(error);
        // Cap error log to 100 entries
        if (this.errorLog.length > 100) {
            this.errorLog.shift();
        }
    }

    public getErrors(): IngestionError[] {
        return this.errorLog;
    }

    public getMalformed(): MalformedRecordEntry[] {
        return this.malformedLog;
    }

    public getArticlesAddedInWindow(windowMinutes: number): number {
        const cutoff = Date.now() - windowMinutes * 60 * 1000;
        return this.ingestionHistory
            .filter(entry => new Date(entry.timestamp).getTime() >= cutoff)
            .reduce((sum, entry) => sum + entry.count, 0);
    }

    public getGrowthPerHour(): number {
        return this.getArticlesAddedInWindow(60);
    }

    public getGrowthPerDay(): number {
        return this.getArticlesAddedInWindow(24 * 60);
    }

    public getDuplicateRate(): number {
        const total = this.articlesAdded + this.duplicatesRejected;
        if (total === 0) return 0;
        return parseFloat(((this.duplicatesRejected / total) * 100).toFixed(2));
    }

    public getRejectionRate(): number {
        const total = this.articlesAdded + this.duplicatesRejected + this.malformedRecords;
        if (total === 0) return 0;
        return parseFloat(((this.malformedRecords / total) * 100).toFixed(2));
    }

    public getCurrentIngestionStatus(): 'HEALTHY' | 'IDLE' | 'ERROR' | 'DEGRADED' {
        if (this.ingestionFailures > 0 && this.successfulBatches === 0) {
            return 'ERROR';
        }
        if (this.ingestionFailures > 0 && this.successfulBatches > 0) {
            return 'DEGRADED';
        }
        if (this.ingestionAttempts === 0) {
            return 'IDLE';
        }
        return 'HEALTHY';
    }

    public getTelemetrySummary() {
        return {
            totalIngestionAttempts: this.ingestionAttempts,
            successfulBatches: this.successfulBatches,
            articlesAccepted: this.articlesAdded,
            articlesRejected: this.malformedRecords,
            duplicateArticles: this.duplicatesRejected,
            malformedArticles: this.malformedRecords,
            validationFailures: this.validationFailures,
            ingestionErrors: this.ingestionFailures,
            quarantinedRecords: this.malformedRecords,
            articlesAddedLast5Min: this.getArticlesAddedInWindow(5),
            articlesAddedLast15Min: this.getArticlesAddedInWindow(15),
            articlesAddedLastHour: this.getGrowthPerHour(),
            articlesAddedLast24Hours: this.getGrowthPerDay(),
            duplicateRate: this.getDuplicateRate(),
            rejectionRate: this.getRejectionRate(),
            latestSuccessfulIngestionTime: this.lastSuccessfulIngestion,
            latestFailedIngestionTime: this.lastFailedIngestion,
            currentIngestionStatus: this.getCurrentIngestionStatus(),
            boundedLogSizes: {
                errorLog: this.errorLog.length,
                malformedLog: this.malformedLog.length,
                historyLog: this.ingestionHistory.length
            }
        };
    }

    public reset(): void {
        this.articlesAdded = 0;
        this.duplicatesRejected = 0;
        this.ingestionAttempts = 0;
        this.ingestionFailures = 0;
        this.successfulBatches = 0;
        this.malformedRecords = 0;
        this.validationFailures = 0;
        this.lastSuccessfulIngestion = null;
        this.lastFailedIngestion = null;
        this.ingestionHistory = [];
        this.errorLog = [];
        this.malformedLog = [];
    }
}
