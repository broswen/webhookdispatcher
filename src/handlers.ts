import { CreateWebhookRequest, CreateWebhookSchema, GetWebhookRequest } from './types';
import { formatZodError } from './helpers';
import { error } from 'itty-router';
import { z } from 'zod';


export async function validateGetWebhookRequest(
	request: GetWebhookRequest
): Promise<Response | undefined> {
	try {
		const result = z.string().uuid().safeParse(request.params["id"])
		if (!result.success) {
			return error(400, formatZodError(result.error));
		}
		request.id = result.data;
		return undefined;
	} catch (e) {
		console.log(e);
		return error(400, "bad request");
	}
}
export async function getWebhookHandler(request: GetWebhookRequest): Promise<Response> {
	const id = request.env.WEBHOOK.idFromName(request.id);
	const obj = request.env.WEBHOOK.get(id);
	return obj.fetch(request);
}


export async function validateCreateWebhookRequest(
	request: CreateWebhookRequest
): Promise<Response | undefined> {
	const body = await request.json().catch(() => ({}));
	try {
		const result = CreateWebhookSchema.safeParse(body);
		if (!result.success) {
			return error(400, formatZodError(result.error));
		}
		request.parsedBody = result.data;
		return undefined;
	} catch (e) {
		console.log(e);
		return error(400, "bad request");
	}
}
export async function createWebhookHandler(request: CreateWebhookRequest): Promise<Response> {
	const id = request.env.WEBHOOK.idFromName(request.parsedBody.id);
	const obj = request.env.WEBHOOK.get(id);
	return obj.fetch(request, {body: JSON.stringify(request.parsedBody)});
}
