declare const axiomDataset = "my-dataset";
declare const axiomToken = "xapt-xxx";
declare const Version: any;
declare const axiomEndpoint = "https://api.axiom.co";
declare let workerTimestamp: any;
declare let batch: LogEvent[];
declare const generateId: (length: number) => string;
declare const CF_APP_VERSION = "0.1.0";
declare const WORKER_ID: string;
declare const throttle: (fn: any, wait: any, maxCalls: any) => (...args: any[]) => void;
declare function sendLogs(): Promise<Response | undefined>;
declare const throttledSendLogs: (...args: any[]) => void;
declare function handleRequest(event: any): Promise<Response>;
interface LogEvent {
    _time: number;
    request: {
        url: string;
        headers: Headers;
        method: string;
        cf: {
            [key: string]: any;
        };
    };
    response: {
        duration: number;
        headers: Headers;
        status: number;
    };
    worker: {
        version: string;
        id: string;
        started: string;
    };
}
//# sourceMappingURL=worker.d.ts.map