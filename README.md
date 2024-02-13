# WebhookDispatcher


### TODO
- [ ] use custom retry logic with alarm scheduler
  - mark as "done" when all retries have attempted and schedule deletion
- [ ] fetch should abort after configured timeout
  - https://developers.cloudflare.com/workers/runtime-apis/web-standards/#abortcontroller-and-abortsignal
  - [ ] after success, schedule self delete in 30 days
- [ ] set up vitest testing
- [ ] define workers analytics engine
  - define doubles, blobs to track
