import { ZodError } from 'zod';
import { Env, WorkerRequest } from './types';

export function buildRequest(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
): WorkerRequest {
	const temp: WorkerRequest = request as WorkerRequest;
	temp.req = request;
	temp.env = env;
	temp.ctx = ctx;
	return temp;
}

export function formatZodError(e: ZodError): string {
	return e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
}



export function base64ToArrayBuffer(base64: string): ArrayBuffer {
	const binaryString = atob(base64);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes.buffer;
}

export function arrayBufferToBase64( buffer: ArrayBuffer) {
	let binary = '';
	const bytes = new Uint8Array( buffer );
	const len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		binary += String.fromCharCode( bytes[ i ] );
	}
	return btoa( binary );
}
