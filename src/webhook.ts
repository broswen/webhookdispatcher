import { CreateWebhookSchema, Env } from './types';
import { z } from 'zod';
import { base64ToArrayBuffer } from './helpers';
import { error, json } from 'itty-router';
import { Analytics } from './analytics';
import * as jose from 'jose';

const ONE_MONTH = 1000*60*60*24*30;
const INITIAL_BACKOFF = 10;
const MAX_ATTEMPTS = 5;
const ATTEMPT_TIMEOUT = 10000;
enum DispatcherStatus {
	UNKNOWN = "UNKNOWN",
	PENDING = "PENDING",
	FAILED = "FAILED",
	SUCCEEDED = "SUCCEEDED",
}

export interface DispatcherState {
	id: string
	target: string
	payload: string
	status: DispatcherStatus
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
		let analytics = new Analytics(this.env);
		let url = new URL(request.url)
		try {
			analytics.method = request.method;
			analytics.path = url.pathname;
			analytics.event = "fetch";

			if (request.method === "GET") {
				if (!this.state) {
					analytics.status = 404
					return error(404, "not found");
				}
				analytics.status = 200
				return json(this.state);
			} else if (request.method === "POST") {
				// if already created, return existing state
				if (this.state) {
					analytics.status = 200
					return json(this.state);
				}

				// parse request
				const createWebhookRequest = await request.json<z.infer<typeof CreateWebhookSchema>>();
				analytics.webhookId = createWebhookRequest.id

				// initialize dispatcher state
				this.state = {
					id: createWebhookRequest.id,
					target: createWebhookRequest.target,
					payload: createWebhookRequest.payload,
					attempts: [],
					provisionedAt: new Date().toISOString(),
					status: DispatcherStatus.PENDING
				};

				// save dispatcher state
				await this.storage.put("state", this.state);
				// schedule first attempt, now!
				await this.storage.setAlarm(new Date());
				analytics.status = 200
				return json(this.state);
			} else {
				analytics.status = 405
				return error(405, "not allowed");
			}
		} finally {
			analytics.send();
		}
	}

	async alarm() {
		let analytics = new Analytics(this.env);
		analytics.event = "alarm";
		try {
			if (this.state) {
				analytics.webhookId = this.state.id
				console.log("running alarm", { state: this.state });
				if (this.state.status === DispatcherStatus.SUCCEEDED || this.state.status === DispatcherStatus.FAILED) {
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
					const privateKey = await crypto.subtle.importKey(
						"jwk",
						JSON.parse(this.env.PRIVATE_KEY),
						{
							name: "RSASSA-PKCS1-v1_5",
							hash: "SHA-256"
						},
						true,
						["sign"]
					);
					const token = await new jose.SignJWT({
						id: this.state.id,
					})
						.setExpirationTime(30)
						.setIssuer("webhookdispatcher")
						.setProtectedHeader({
							alg: "RS256"
						})
						.sign(privateKey);

					const req = new Request(this.state?.target, {
						method: "POST",
						headers: {
							Authorization: `Bearer ${token}`,
						},
						body: base64ToArrayBuffer(this.state.payload)
					});
					const res = await fetch(req, { signal: AbortSignal.timeout(ATTEMPT_TIMEOUT) });

					// set attempt details
					attempt.status = res.status;
					attempt.message = res.statusText;

					// if response wasn't ok, throw error to retry alarm
					if (res.status < 200 || res.status >= 300) {
						throw new Error(`${res.status}: ${res.statusText}`);
					} else {
						// set attempt message to success
						attempt.message = "success";
						this.state.status = DispatcherStatus.SUCCEEDED;
						// set alarm to delete 1 month later
						await this.storage.setAlarm(new Date().getTime() + ONE_MONTH);
					}
				} catch (e) {
					// set attempt message to error message
					attempt.message = String(e);
					// throw unhandled exception so the runtime retries with backoff
				} finally {
					this.state.attempts.push(attempt);
					// if no attempts left and still no succeeded, set failed and schedule for cleanup

					if (this.state.status === DispatcherStatus.SUCCEEDED) {
						// if succeeded, schedule cleanup
						await this.storage.setAlarm(new Date().getTime() + ONE_MONTH);
					} else if (this.state.status === DispatcherStatus.PENDING) {
						// if pending and hit max attempts, mark failed, schedule cleanup
						if (this.state.attempts.length >= MAX_ATTEMPTS) {
							this.state.status = DispatcherStatus.FAILED;
							await this.storage.setAlarm(new Date().getTime() + ONE_MONTH);
						} else {
							// if not hit max attempts, schedule for backoff ^ attempts millis in the future
							await this.storage.setAlarm(new Date().getTime() + Math.pow(INITIAL_BACKOFF, this.state.attempts.length));
						}
					}
					// save dispatcher state
					await this.storage.put("state", this.state);
				}
			} else {
				console.log("skipping alarm invocation as state is undefined");
			}
		} finally {
			analytics.send();
		}
	}
}
