interface CFRequest extends Request {
  cf?: {
    // Define the properties of the `cf` object that you are using
    tlsClientAuth?: {
      certIssuerDNLegacy?: string;
      certIssuerDN?: string;
    };
    tlsExportedAuthenticator?: {
      id?: string;
    };
    // Add other properties if needed
    [key: string]: any; // Allow other properties with any value
  };
}
type Params<P extends string = any> = Record<P, string | string[]>;
type EventContext<Env, P extends string, Data> = {
  request: Request;
  functionPath: string;
  waitUntil: (promise: Promise<any>) => void;
  passThroughOnException: () => void;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  env: Env & { ASSETS: { fetch: typeof fetch } };
  params: Params<P>;
  data: Data;
};

const axiomDataset: string = process.env.AXIOM_DATASET || 'my-dataset'; // Your Axiom dataset
const axiomToken: string = process.env.AXIOM_TOKEN || 'xapt-xxx'; // Your Axiom API token

const requestHeadersToCapture: string[] = ['user-agent'];
const responseHeadersToCapture: string[] = ['cf-cache-status', 'cf-ray'];

// 8< ----------- snip ------------
const Version: string = '0.3.0';
const axiomEndpoint: string = 'https://api.axiom.co';
let workerTimestamp: string;
let batch: any[] = [];

const generateId = (length: number): string => {
  let text = '';
  const possible = 'abcdefghijklmnpqrstuvwxyz0123456789';
  for (let i = 0; i < length; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const WORKER_ID: string = generateId(6);

const throttle = <T>(fn: Function, wait: number, maxLen: number) => {
  let timeoutInProgress = false;
  return async function actual(this: T,...args: any[]) {
    const context = this;
    if (batch.length >= maxLen) {
      await fn.apply(context, args);
    } else if (!timeoutInProgress) {
      timeoutInProgress = true;
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          timeoutInProgress = false;
          fn.apply(context, args).then(resolve).catch(resolve);
        }, wait);
      });
    }
  };
};

async function sendLogs() {
  if (batch.length === 0) {
    return;
  }
  const logs = batch;
  batch = [];

  const url = `${axiomEndpoint}/v1/datasets/${axiomDataset}/ingest`;
  return fetch(url, {
    signal: AbortSignal.timeout(30_000),
    method: 'POST',
    body: logs.map(log => JSON.stringify(log)).join('\n'),
    headers: {
      'Content-Type': 'application/x-ndjson',
      Authorization: `Bearer ${axiomToken}`,
      'User-Agent': 'axiom-cloudflare/' + Version,
    },
  });
}

// This will send logs every 10 seconds or every 1000 logs
const throttledSendLogs = throttle(sendLogs, 10_000, 1000);

function getHeaderMap(headers: Headers, allowlist: string[]): Record<string, string> {
  if (!allowlist.length) {
    return {};
  }

  return [...headers].reduce((acc: Record<string, string>, [headerKey, headerValue]) => {
    if (allowlist.includes(headerKey)) {
      acc[headerKey] = headerValue;
    }

    return acc;
  }, {});
}

async function handleRequest(
  request: CFRequest,
  context: any
): Promise<Response> {
  const start = Date.now();

  const response = await fetch(request);
  const duration = Date.now() - start;

  const cf: Record<string, any> = {};
  if (request?.cf) {
    // Delete does not work so we copy into a new object
    Object.keys(request.cf).forEach(key => {
      if (key !== 'tlsClientAuth' && key !== 'tlsExportedAuthenticator') {
      
        cf[key] = request.cf![key];
      }
    });
  }

  batch.push({
    _time: Date.now(),
    request: {
      url: request.url,
      headers: getHeaderMap(request.headers, requestHeadersToCapture),
      method: request.method,
      ...cf,
    },
    response: {
      duration,
      headers: getHeaderMap(response.headers, responseHeadersToCapture),
      status: response.status,
    },
    worker: {
      version: Version,
      id: WORKER_ID,
      started: workerTimestamp,
    },
  });

  context.waitUntil(throttledSendLogs());

  return response;
}

export default {
  async fetch(req: Request, _: any, context: EventContext<any, any, any>): Promise<Response> {
    context.passThroughOnException();

    if (!workerTimestamp) {
      workerTimestamp = new Date().toISOString();
    }

    // Cast `req` to `CFRequest` to handle the custom `cf` property
    return handleRequest(req as CFRequest, context);
  },
};

