import client from 'prom-client';

// 1) Create a dedicated registry (cleaner than using the global default)
export const registry = new client.Registry();

// 2) Add default Node.js process metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics({ register: registry });

// 3) HTTP request counter
export const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [registry],
});

// 4) Request duration histogram
export const httpRequestDurationSeconds = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "status"] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
});

// Blocked requests counter
export const blockedRequestsTotal = new client.Counter({
    name: "blocked_requests_total",
    help: "Total number of requests blocked by denylist",
    labelNames: ["route"] as const,
    registers: [registry],
});

export const authFailuresTotal = new client.Counter({
    name: "auth_failures_total",
    help: "Total number of failed login attempts",
    registers: [registry],
});

export const denyListSize = new client.Gauge({
    name: "denylist_size",
    help: "Number of currently active IP Blocks in the denylist",
    registers: [registry],
});