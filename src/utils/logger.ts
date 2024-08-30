import { LogReturn, Logs, Metadata } from "@ubiquity-dao/ubiquibot-logger";

export class Logger extends Logs {
    updateId: number | string;

    constructor(updateId: number | string) {
        super("verbose");
        this.updateId = updateId;
    }

    storeUpdateId(updateId: number | string): Logger {
        this.updateId = updateId;
        return this;
    }

    debug(log: string, metadata?: Metadata): LogReturn {
        return super.debug(`[update_id: ${this.updateId}] ${log}`, metadata);
    }

    error(log: string, metadata?: Metadata): LogReturn {
        return super.error(`[update_id: ${this.updateId}] ${log}`, metadata);
    }

    fatal(log: string, metadata?: Metadata): LogReturn {
        return super.fatal(`[update_id: ${this.updateId}] ${log}`, metadata);
    }

    info(log: string, metadata?: Metadata): LogReturn {
        return super.info(`[update_id: ${this.updateId}] ${log}`, metadata);
    }

    ok(log: string, metadata?: Metadata): LogReturn {
        return super.ok(`[update_id: ${this.updateId}] ${log}`, metadata);
    }

    verbose(log: string, metadata?: Metadata): LogReturn {
        return super.verbose(`[update_id: ${this.updateId}] ${log}`, metadata);
    }
}