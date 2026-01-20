Detection Rules (Deterministic First)
Prometheus Queries (examples)

SERVICE_DEGRADATION

Error rate over last 2 minutes:

sum(rate(http_requests_total{service="api-service",status=~"5.."}[2m]))

Request rate:

sum(rate(http_requests_total{service="api-service"}[2m]))

Latency p95 (if histogram):

histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{service="api-service"}[2m])) by (le))

Trigger condition example:

5xx rate > 1/sec OR 5xx ratio > 5% for 2 minutes

AUTH_ABUSE

Auth failures over last 2 minutes:

sum(rate(auth_failures_total{service="api-service"}[2m]))
Trigger condition example:

auth failures rate > N/sec sustained for 60–120 seconds

Debounce / Dedupe

Dedupe key: {type}:{service}:{window_bucket}

If incident OPEN already, attach new evidence instead of creating new incident