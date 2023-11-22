export type AxiomLog = {
	message: string
	_time: string
	invocationId: string
	data: any
}

export type AxiomLoggerArgs = {
	ctx: ExecutionContext
	/** Axiom API token with ingest permissions for the dataset */
	apiToken: string
	/** Axiom dataset: https://axiom.co/docs/reference/settings#dataset */
	dataset: string
	/** Version of the Workers application */
	version?: string
	/** Data included in every log */
	data?: any
	/** ID unique to each invocation. Default: crypto.randomUUID() */
	invocationId?: string
	/** Axiom ingest API endpoint. Default: https://api.axiom.co */
	endpoint?: string
	/** Flush after this many ms. Default: 10,000 */
	flushAfterMs?: number
	/** Flush after this many logs. Default: 100 */
	flushAfterLogs?: number
}

/** Cloudflare Workers logger for Axiom: https://axiom.co */
export class AxiomLogger {
	private readonly ctx: ExecutionContext
	private readonly apiToken: string
	private readonly dataset: string
	private readonly version?: string
	private readonly logs: AxiomLog[] = []
	private readonly invocationId: string
	private readonly endpoint: string
	private readonly data?: any

	/* flushTimeout is a timeout set by setTimeout() to flush the logs after a certain amount of time */
	private flushTimeout: any | null = null
	private flushPromise: Promise<any> | null = null
	private flushAfterMs: number
	private flushAfterLogs: number

	constructor(args: AxiomLoggerArgs) {
		this.ctx = args.ctx
		this.apiToken = args.apiToken
		this.dataset = args.dataset
		this.version = args.version
		this.endpoint = args.endpoint ?? 'https://api.axiom.co'
		this.data = args.data
		this.invocationId = args.invocationId ?? crypto.randomUUID()
		this.flushAfterMs = args.flushAfterMs ?? 10_000
		this.flushAfterLogs = args.flushAfterLogs ?? 100
	}

	private _log(message: string, level: string, data?: any) {
		if (data && data.level) {
			level = data.level
			delete data.level
		}

		const log: AxiomLog = {
			message,
			level,
			invocationId: this.invocationId,
			version: this.version,
			...this.data,
			...data,
		}

		this.logs.push(log)

		if (this.logs.length >= this.flushAfterLogs) {
			// Reset scheduled if there is one
			if (this.flushTimeout) {
				this.scheduleFlush(this.flushAfterMs, true)
			}
			// Flush right away in background
			this.ctx.waitUntil(this.flush({ skipIfInProgress: true }))
		} else {
			// Always schedule a flush (if there isn't one already)
			this.scheduleFlush(this.flushAfterMs)
		}
	}

	/** Flush after X ms if there's not already
	 * a flush scheduled / running
	 * @param reset If true, cancel the current flush timeout
	 */
	scheduleFlush(timeout: number, reset = false) {
		if (reset && this.flushTimeout) {
			clearTimeout(this.flushTimeout)
			this.flushTimeout = null
		}

		if (!this.flushTimeout && !this.flushPromise) {
			this.flushTimeout = setTimeout(() => {
				const doFlush = async () => {
					await this.flush({ skipIfInProgress: true })
					this.flushTimeout = null
				}
				this.ctx.waitUntil(doFlush())
			}, timeout)
		}
	}

	async flush({ skipIfInProgress = false }: { skipIfInProgress?: boolean } = {}) {
		if (skipIfInProgress && this.flushPromise) return // already flushing

		const doFlush = async () => {
			if (this.logs.length === 0) return // Nothing to do

			const logsCount = this.logs.length
			const logsBody = this.logs.map((log) => JSON.stringify(log)).join('\n')

			try {
				const res = await fetch(`${this.endpoint}/v1/datasets/${this.dataset}/ingest`, {
					signal: AbortSignal.timeout(30_000),
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-ndjson',
						Authorization: `Bearer ${this.apiToken}`,
						'User-Agent': 'axiom-cloudflare',
					},
					body: logsBody,
				})
				if (res.ok) {
					// Remove the logs we sent
					this.logs.splice(0, logsCount)
					await res.arrayBuffer() // Read the body to completion
				} else {
					console.log(`axiom failed to ingest logs: ${res.status} ${res.statusText} ${await res.text()}`)
				}
			} catch (err) {
				console.error(`axiom failed to ingest logs: ${err}`)
			}
		}

		// Make sure the last one is done before starting a flush
		await this.flushPromise

		this.flushPromise = doFlush()
		await this.flushPromise
		this.flushPromise = null
	}

	log(msg: string, data?: any) {
		this._log(msg, 'info', data)
	}

	info(msg: string, data?: any) {
		this._log(msg, 'info', data)
	}

	warn(msg: string, data?: any) {
		this._log(msg, 'warning', data)
	}

	error(msg: string | Error | unknown, data?: any) {
		const m: string =
			msg instanceof Error ? msg.message + (msg.stack ? `: ${msg.stack}` : '') : typeof msg === 'string' ? msg : JSON.stringify(msg)
		this._log(m, 'error', data)
	}

	debug(msg: string, data?: any) {
		this._log(msg, 'debug', data)
	}
}
