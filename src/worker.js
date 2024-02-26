const axiomDataset = 'my-dataset' // Your Axiom dataset
const axiomToken = 'xapt-xxx' // Your Axiom API token
const logsHttpMinStatusCode = 400 // Filter logs and send only logs with status code above

const requestHeadersToCapture = ['user-agent'];
const responseHeadersToCapture = ['cf-cache-status', 'cf-ray'];

// 8< ----------- snip ------------
const Version = '0.3.0'
const axiomEndpoint = 'https://api.axiom.co'
let workerTimestamp
let batch = []

const generateId = length => {
  let text = ''
  const possible = 'abcdefghijklmnpqrstuvwxyz0123456789'
  for (let i = 0; i < length; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}

const WORKER_ID = generateId(6)

const throttle = (fn, wait, maxLen) => {
  let timeoutInProgress = false
  return async function actual(...args) {
    const context = this

    if (batch.length >= maxLen) {
      await fn.apply(context, args)
    } else if (!timeoutInProgress) {
      timeoutInProgress = true
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          timeoutInProgress = false
          fn.apply(context, args).then(resolve).catch(resolve);
        }, wait)
      })
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
    signal: AbortSignal.timeout(30_000),
    method: 'POST',
    body: logs.map(log => JSON.stringify(log)).join('\n'),
    headers: {
      'Content-Type': 'application/x-ndjson',
      Authorization: `Bearer ${axiomToken}`,
      'User-Agent': 'axiom-cloudflare/' + Version
    }
  })
}

// This will send logs every 10 seconds or every 1000 logs
const throttledSendLogs = throttle(sendLogs, 10_000, 1000)

function getHeaderMap(headers, allowlist) {
  if (!allowlist.length) {
    return {};
  }

  return [...headers].reduce((acc, [headerKey, headerValue]) => {
    if (allowlist.includes(headerKey)) {
      acc[headerKey] = headerValue;
    }

    return acc;
  }, {});
}

async function handleRequest(request, context) {
  const start = Date.now()

  const response = await fetch(request)
  const duration = Date.now() - start

  const cf = {}
  if (request.cf) {
    // delete does not work so we copy into a new object
    Object.keys(request.cf).forEach(key => {
      if (key !== 'tlsClientAuth' && key !== 'tlsExportedAuthenticator') {
        cf[key] = request.cf[key]
      }
    })
  }
  if (response.status >= logsHttpMinStatusCode) {
    batch.push({
      _time: Date.now(),
      request: {
        url: request.url,
        headers: getHeaderMap(request.headers, requestHeadersToCapture),
        method: request.method,
        ...cf
      },
      response: {
        duration,
        headers: getHeaderMap(response.headers, responseHeadersToCapture),
        status: response.status
      },
      worker: {
        version: Version,
        id: WORKER_ID,
        started: workerTimestamp
      }
    })
  }
  context.waitUntil(throttledSendLogs())

  return response
}

export default {
  async fetch(req, _, context) {
    context.passThroughOnException()

    if (!workerTimestamp) {
      workerTimestamp = new Date().toISOString()
    }

    return handleRequest(req, context)
  }
}
