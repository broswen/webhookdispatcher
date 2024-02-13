import { z } from 'zod';
import {IRequestStrict} from 'itty-router';

export interface Env {
	WEBHOOK: DurableObjectNamespace;
	VERSION: string;
}

export type WorkerRequest = {
	req: Request;
	env: Env;
	ctx: ExecutionContext;
} & IRequestStrict;

export type CreateWebhookRequest = WorkerRequest & {
	parsedBody: z.infer<typeof CreateWebhookSchema>;
}

export type GetWebhookRequest = WorkerRequest & {
	id: string
}

export const CreateWebhookSchema = z.object({
	id: z.string().uuid(),
	target: z.string().url(),
	payload: z.string()
});
