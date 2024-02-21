import { CreateWebhookRequest, CreateWebhookSchema, GetWebhookRequest, WorkerRequest } from './types';
import { arrayBufferToBase64, base64ToArrayBuffer, formatZodError } from './helpers';
import { error, IRequestStrict, json } from 'itty-router';
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


export async function keysHandler(request: WorkerRequest): Promise<Response> {
	const publicKey = await crypto.subtle.importKey(
		"jwk",
		JSON.parse(request.env.PUBLIC_KEY),
		{
		name: "RSASSA-PKCS1-v1_5",
			hash: "SHA-256"
		},
		true,
		["verify"]
	);

	const exportedSpki = await crypto.subtle.exportKey("spki", publicKey) as ArrayBuffer ;
	let data = arrayBufferToBase64(exportedSpki);
	let finalPem = "-----BEGIN PUBLIC KEY-----\n"
	while (data.length > 0) {
		finalPem += data.substring(0, 64) + "\n"
		data = data.substring(64)
	}
	finalPem += "-----END PUBLIC KEY-----"

	const exportedJwk = await crypto.subtle.exportKey("jwk", publicKey);

	return json({jwk: exportedJwk, pem: finalPem})
}
