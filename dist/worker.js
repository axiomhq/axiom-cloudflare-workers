"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const axiomDataset = "my-dataset"; // Your Axiom dataset
const axiomToken = "xapt-xxx"; // Your Axiom API token
// 8< ----------- snip ------------
const Version = require('../package.json').version;
const axiomEndpoint = "https://api.axiom.co";
let workerTimestamp;
let batch = [];
const generateId = (length) => {
    let text = "";
    const possible = "abcdefghijklmnpqrstuvwxyz0123456789";
    for (let i = 0; i < length; i += 1) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};
const CF_APP_VERSION = "0.1.0";
const WORKER_ID = generateId(6);
const throttle = (fn, wait, maxCalls) => {
    let lastFn;
    let lastTime;
    let callCount = 0;
    return function actual(...args) {
        // @ts-ignore
        const context = this;
        callCount += 1;
        // First call, set lastTime
        if (lastTime == null) {
            lastTime = Date.now();
        }
        clearTimeout(lastFn);
        if (callCount >= maxCalls) {
            fn.apply(context, args);
            callCount = 0;
            lastTime = Date.now();
        }
        else {
            lastFn = setTimeout(() => {
                if (Date.now() - lastTime >= wait) {
                    fn.apply(context, args);
                    lastTime = Date.now();
                }
            }, Math.max(wait - (Date.now() - lastTime), 0));
        }
    };
};
function sendLogs() {
    return __awaiter(this, void 0, void 0, function* () {
        if (batch.length === 0) {
            return;
        }
        const logs = batch;
        batch = [];
        const url = `${axiomEndpoint}/v1/datasets/${axiomDataset}/ingest`;
        return fetch(url, {
            method: "POST",
            keepalive: true,
            body: logs.map(l => JSON.stringify(l)).join("\n"),
            headers: {
                "Content-Type": "application/x-ndjson",
                Authorization: `Bearer ${axiomToken}`,
                "User-Agent": 'axiom-cloudflare/' + Version,
            },
        });
    });
}
// This will send logs every second or every 1000 logs
const throttledSendLogs = throttle(sendLogs, 1000, 1000);
function handleRequest(event) {
    return __awaiter(this, void 0, void 0, function* () {
        const { request } = event;
        const start = Date.now();
        const response = yield fetch(request);
        const duration = Date.now() - start;
        let cf = {};
        if (request.cf) {
            // delete does not work so we copy into a new object
            Object.keys(request.cf).forEach(key => {
                if (key !== "tlsClientAuth" && key !== "tlsExportedAuthenticator") {
                    cf[key] = request.cf[key];
                }
            });
        }
        batch.push({
            _time: Date.now(),
            request: {
                url: request.url,
                headers: request.headers,
                method: request.method,
                cf
            },
            response: {
                duration,
                headers: response.headers,
                status: response.status,
            },
            worker: {
                version: CF_APP_VERSION,
                id: WORKER_ID,
                started: workerTimestamp,
            },
        });
        event.waitUntil(throttledSendLogs());
        return response;
    });
}
// eslint-disable-next-line no-restricted-globals
addEventListener("fetch", (event) => {
    event.passThroughOnException();
    if (!workerTimestamp) {
        workerTimestamp = new Date().toISOString();
    }
    event.waitUntil(sendLogs());
    event.respondWith(handleRequest(event));
});
//# sourceMappingURL=worker.js.map