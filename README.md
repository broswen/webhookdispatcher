# WebhookDispatcher


### TODO
- [ ] set up itty router
- [ ] define typescript interfaces for in memory state
  - config data, metadata/attempts
- [ ] create alarm handler that attempts to POST webhook
  - https://developers.cloudflare.com/durable-objects/api/alarms/
  - fetch should abort after configured timeout
  - https://developers.cloudflare.com/workers/runtime-apis/web-standards/#abortcontroller-and-abortsignal
  - [ ] after success, schedule self delete in 30 days
- [ ] webhook should return 200 on a POST if it already exists
- [ ] webhook should return 404 on a GET if it is empty
- [ ] set up vitest testing
- [ ] define workers analytics engine
  - define doubles, blobs to track
