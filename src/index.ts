import { error, json, Router, text } from 'itty-router';
import {
	createWebhookHandler,
	getWebhookHandler,
	validateCreateWebhookRequest,
	validateGetWebhookRequest
} from './handlers';
import { CreateWebhookSchema, Env } from './types';
import { z } from 'zod';
import { base64ToArrayBuffer, buildRequest } from './helpers';

const ONE_MONTH = 60*60*24*30;

export interface DispatcherState {
	id: string
	target: string
	payload: string
	succeeded: boolean
	provisionedAt: string
	attempts: Attempt[]
}

export interface Attempt {
	timestamp: string
	status: number
	message: string
}

export class Webhook {
	storage: DurableObjectStorage
	env: Env
	state: DispatcherState | undefined;
	constructor(state: DurableObjectState, env: Env) {
		this.storage = state.storage;
		this.env = env;
		// load existing dispatcher state if it exists
		state.blockConcurrencyWhile(async () => {
			this.state = await this.storage.get<DispatcherState>("state");
		})
}
	async fetch(request: Request): Promise<Response> {
		if (request.method === "GET") {
			if (!this.state) return error(404, "not found");
			return json(this.state);
		} else if (request.method === "POST") {
			// if already created, return existing state
			if (this.state) return json(this.state);

			// parse request
			const createWebhookRequest = await request.json<z.infer<typeof CreateWebhookSchema>>();

			// initialize dispatcher state
			this.state = {
				id: createWebhookRequest.id,
				target: createWebhookRequest.target,
				payload: createWebhookRequest.payload,
				attempts: [],
				provisionedAt: new Date().toISOString(),
				succeeded: false
			};

			// save dispatcher state
			await this.storage.put("state", this.state);
			// schedule first attempt, now!
			await this.storage.setAlarm(new Date());
			return json(this.state);
		} else {
			return error(405, "not allowed");
		}
	}

	async alarm() {
		if (this.state) {
			console.log("running alarm", {state: this.state});
			if (this.state.succeeded) {
				// if run after succeeded, delete all
				console.log("cleanup")
				await this.storage.deleteAll()
				return
			}

			const attempt: Attempt = {
				timestamp: new Date().toISOString(),
				status: 0,
				message: ""
			};
			try {

				const req = new Request(this.state?.target, {
					method: "POST",
					body: base64ToArrayBuffer(this.state.payload)
				});
				const res = await fetch(req);

				// set attempt details
				attempt.status = res.status;
				attempt.message = res.statusText;

				// if response wasn't ok, throw error to retry alarm
				if (res.status < 200 || res.status >= 300) {
					throw new Error(`${res.status}: ${res.statusText}`);
				} else {
					// set attempt message to success
					attempt.message = "success"
					this.state.succeeded = true
					// set alarm to delete 1 month later
					await this.storage.setAlarm(new Date().getTime() + ONE_MONTH)
				}
			} catch (e) {
				// set attempt message to error message
				attempt.message = String(e);
				// throw unhandled exception so the runtime retries with backoff
				throw e;
			} finally {
				// save dispatcher state
				this.state.attempts.push(attempt)
				await this.storage.put("state", this.state);
			}
		} else {
			console.log("skipping alarm invocation as state is undefined")
		}
	}
}

const router = Router();

router
	.get("/_health", () => text("ok"))
	.post("/api/webhooks", validateCreateWebhookRequest, createWebhookHandler)
	.get("/api/webhooks/:id", validateGetWebhookRequest, getWebhookHandler)
	.all("*", () => error(404, "not found"))

export default {

	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const incomingRequest = buildRequest(request, env, ctx);
		return router.handle(incomingRequest, env, ctx)
			.catch((e) => {
				console.log(e)
				return error(500, "internal server error")
			});
	},
};
