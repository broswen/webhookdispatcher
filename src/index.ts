import { error, json, Router, text } from 'itty-router';
import {
	createWebhookHandler,
	getWebhookHandler,
	validateCreateWebhookRequest,
	validateGetWebhookRequest
} from './handlers';
import { Env } from './types';
import { buildRequest } from './helpers';
export { Webhook } from './webhook';

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
