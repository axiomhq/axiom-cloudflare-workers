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
  type ENV = {
    AXIOM_TOKEN?: string
    AXIOM_DATASET?: string 
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
  
  
  const requestHeadersToCapture: string[] = ['user-agent'];
  const responseHeadersToCapture: string[] = ['cf-cache-status', 'cf-ray'];
  
  // 8< ----------- snip ------------
  const Version: string = '0.4.0';
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
  
//   const throttle = <T>(fn: Function, wait: number, maxLen: number, env: ENV) => {
//     let timeoutInProgress = false;
//     return async function actual(this: T,...args: any[]) {
//       const context = this;
//       if (batch.length >= maxLen) {
//         await fn.apply(context, [env,...args]);
//       } else if (!timeoutInProgress) {
//         timeoutInProgress = true;
//         await new Promise((resolve, reject) => {
//           setTimeout(() => {
//             timeoutInProgress = false;
//             fn.apply(context, [env, ...args]).then(resolve).catch(resolve);
//           }, wait);
//         });
//       }
//     };
//   };

const throttle = async (fn: Function, wait: number, maxLen: number, env: ENV, ...args: any[]) => {
    let timeoutInProgress = false;
    if (batch.length >= maxLen) {
      // If the batch size exceeds the maximum, send the logs immediately
      await fn(env, ...args);
    } else if (!timeoutInProgress) {
      timeoutInProgress = true;
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          timeoutInProgress = false;
          fn(env, ...args).then(resolve).catch(resolve);
        }, wait);
      });
    }
  };
  
  async function sendLogs(env: ENV,  ...args: any[]) {
    if (batch.length === 0) {
      return;
    }
    const logs = batch;
    batch = [];
  
    const url = `${axiomEndpoint}/v1/datasets/${env.AXIOM_DATASET}/ingest`;
    return fetch(url, {
      signal: AbortSignal.timeout(30_000),
      method: 'POST',
      body: logs.map(log => JSON.stringify(log)).join('\n'),
      headers: {
        'Content-Type': 'application/x-ndjson',
        Authorization: `Bearer ${env.AXIOM_TOKEN}`,
        'User-Agent': 'axiom-cloudflare/' + Version,
      },
    });
  }
  
  // This will send logs every 5 seconds or every 1000 logs
  const throttledSendLogs = (env: ENV) => throttle(sendLogs, 10_000, 500, env);
  
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


  async function handleFaviconRequest(request: Request): Promise<Response> {
    // Return a custom response for the /favicon.ico request
    const body = 'Favicon not available.';
    const headers = { 'Content-Type': 'text/plain' };
    return new Response(body, { status: 200, headers });
  }
  
  async function handleRequest(
    request: CFRequest,
    env: ENV,
    context: any
  ): Promise<Response> {


    if (request.url.startsWith('/favicon.ico')){
        return handleFaviconRequest(request)
    }
    const start = Date.now();
  
    const response = await fetch(request);

    console.log({ response: JSON.stringify(response) })
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
    context.waitUntil(throttledSendLogs(env));
  
    return response;
  }
  
  
  function envValidator(env: ENV){
    const dataset = env.AXIOM_DATASET?.trim()
    const token = env.AXIOM_TOKEN?.trim()
    if (dataset === undefined){
      throw new Error("DATASET is undefined")
    }
    if (token === undefined){
      throw new Error("TOKEN is undefined")
    }
  }
  
  export default {
    async fetch(req: Request, env: ENV, context: EventContext<ENV, any, any>): Promise<Response> {
      context.passThroughOnException();
      envValidator(env)
  
      if (!workerTimestamp) {
        workerTimestamp = new Date().toISOString();
      }
      // Cast `req` to `CFRequest` to handle the custom `cf` property
      return handleRequest(req as CFRequest, env, context);
    },
  };
  