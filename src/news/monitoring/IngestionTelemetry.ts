import { IngestionError } from './HealthMonitor.ts';

export interface IngestionLogEntry {
    timestamp: string;
    count: number;
}

export class IngestionTelemetry {
    private static instance: IngestionTelemetry | null = null;

    public articlesAdded = 0;
    public duplicatesRejected = 0;
    public ingestionAttempts = 0;
    public ingestionFailures = 0;
    public malformedRecords = 0;
    public lastSuccessfulIngestion: string | null = null;
    public lastFailedIngestion: string | null = null;

    private ingestionHistory: IngestionLogEntry[] = [];
    private errorLog: IngestionError[] = [];
    private malformedLog: any[] = [];

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

    public recordSuccess(savedCount: number, duplicatesCount: number): void {
        this.articlesAdded += savedCount;
        this.duplicatesRejected += duplicatesCount;
        this.lastSuccessfulIngestion = new Date().toISOString();
        if (savedCount > 0) {
            this.ingestionHistory.push({
                timestamp: new Date().toISOString(),
                count: savedCount
            });
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
        this.malformedLog.push({
            timestamp: new Date().toISOString(),
            payload,
            errors
        });
    }

    public recordError(error: IngestionError): void {
        this.errorLog.push(error);
        // Cap the error log at 100 entries
        if (this.errorLog.length > 100) {
            this.errorLog.shift();
        }
    }

    public getErrors(): IngestionError[] {
        return this.errorLog;
    }

    public getMalformed(): any[] {
        return this.malformedLog;
    }

    public getGrowthPerHour(): number {
        const cutoff = Date.now() - 3600 * 1000;
        return this.ingestionHistory
            .filter(entry => new Date(entry.timestamp).getTime() >= cutoff)
            .reduce((sum, entry) => sum + entry.count, 0);
    }

    public getGrowthPerDay(): number {
        const cutoff = Date.now() - 24 * 3600 * 1000;
        return this.ingestionHistory
            .filter(entry => new Date(entry.timestamp).getTime() >= cutoff)
            .reduce((sum, entry) => sum + entry.count, 0);
    }

    public reset(): void {
        this.articlesAdded = 0;
        this.duplicatesRejected = 0;
        this.ingestionAttempts = 0;
        this.ingestionFailures = 0;
        this.malformedRecords = 0;
        this.lastSuccessfulIngestion = null;
        this.lastFailedIngestion = null;
        this.ingestionHistory = [];
        this.errorLog = [];
        this.malformedLog = [];
    }
}
