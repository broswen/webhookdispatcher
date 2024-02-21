import { Env } from './types';


export class Analytics {
	method: string = ""
	path: string = ""
	status: number = 0
	webhookId: string = ""
	event: string = ""
	constructor(readonly env: Env) {
	}

	send() {
		this.env.ANALYTICS.writeDataPoint({
			// THIS ORDER MUST NOT CHANGE, only append new metrics to the end of the lists
			indexes: [this.webhookId],
			blobs: [this.method, this.event, this.path],
			doubles: [this.status]
		})
	}
}
