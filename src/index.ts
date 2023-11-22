import { AxiomLogger } from './axiom'

export interface Env {
	// Your Axiom API token.
	// Set via `npx wrangler secret put AXIOM_TOKEN`
	AXIOM_TOKEN: string
	// Version of your application. Set via `npx wrangler deploy --var`
	// or manually when initializing AxiomLogger below
	VERSION?: string
}

type AppContext = {
	request: Request
	env: Env
	ctx: ExecutionContext
	logger?: AxiomLogger
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const logger = new AxiomLogger({
			apiToken: env.AXIOM_TOKEN,
			ctx,
			dataset: 'my-dataset', // Your axiom dataset
			version: env.VERSION ?? '0.1.0',
			data: {
				// Data included in every request
				worker: 'workers-axiom-example',
			},
		})
		try {
			return handleFetch({
				request,
				env,
				ctx,
				logger,
			})
		} catch (err) {
			logger.error(err)
			return new Response('internal error', { status: 500 })
		} finally {
			ctx.waitUntil(logger.flush())
		}
	},
}

async function handleFetch(c: AppContext): Promise<Response> {
	c.logger?.log(`${c.request.method} ${new URL(c.request.url).pathname}`, {
		foo: 'hello world!',
	})
	return new Response('Hello World!')
}
