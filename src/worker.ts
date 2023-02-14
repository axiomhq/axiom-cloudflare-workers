const axiomDataset = "my-dataset" // Your Axiom dataset
const axiomToken = "xapt-xxx" // Your Axiom API token

// 8< ----------- snip ------------
const Version = "0.1.0";
const axiomEndpoint = "https://api.axiom.co"
let workerTimestamp: any
let batch: LogEvent[] = []

const generateId = (length: number) => {
  let text = ""
  const possible = "abcdefghijklmnpqrstuvwxyz0123456789"
  for (let i = 0; i < length; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}

const CF_APP_VERSION = "0.1.0"
const WORKER_ID = generateId(6)

const throttle = (fn: any, wait: any, maxCalls: any) => {
  let lastFn: any;
  let lastTime: any;
  let callCount = 0;
  return function actual(...args: any[]) {
    // @ts-ignore
    const context = this;
    callCount += 1

    // First call, set lastTime
    if (lastTime == null) {
      lastTime = Date.now()
    }

    clearTimeout(lastFn)
    if (callCount >= maxCalls) {
      fn.apply(context, args)
      callCount = 0
      lastTime = Date.now()
    } else {
      lastFn = setTimeout(() => {
        if (Date.now() - lastTime >= wait) {
          fn.apply(context, args)
          lastTime = Date.now()
        }
      }, Math.max(wait - (Date.now() - lastTime), 0))
    }
  }
}

async function sendLogs() {
  if (batch.length === 0) {
    return
  }
  const logs = batch
  batch = []

  const url = `${axiomEndpoint}/v1/datasets/${axiomDataset}/ingest`
  return fetch(url, {
    method: "POST",
    keepalive: true,
    body: logs.map(l => JSON.stringify(l)).join("\n"),
    headers: {
      "Content-Type": "application/x-ndjson",
      Authorization: `Bearer ${axiomToken}`,
      "User-Agent": 'axiom-cloudflare/' + Version,
    },
  })
}

// This will send logs every second or every 1000 logs
const throttledSendLogs = throttle(sendLogs, 1000, 1000)

async function handleRequest(event: any) {
  const { request } = event
  const start = Date.now()

  const response = await fetch(request)
  const duration = Date.now() - start

  let cf: {[key: string]: any} = {}
  if (request.cf) {
    // delete does not work so we copy into a new object
    Object.keys(request.cf).forEach(key => {
      if (key !== "tlsClientAuth" && key !== "tlsExportedAuthenticator") {
        cf[key] = request.cf[key]
      }
    })
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
  })

  event.waitUntil(throttledSendLogs())
  return response
}

// eslint-disable-next-line no-restricted-globals
addEventListener("fetch", (event: any) => {
  event.passThroughOnException()

  if (!workerTimestamp) {
    workerTimestamp = new Date().toISOString()
  }

  event.waitUntil(sendLogs())
  event.respondWith(handleRequest(event))
})


interface LogEvent {
  _time: number;
  request: {
    url: string,
    headers: Headers,
    method: string,
    cf: {[key: string]: any},
  },
  response: {
    duration: number,
    headers: Headers,
    status: number,
  },
  worker: {
    version: string,
    id: string,
    started: string,
  },
}