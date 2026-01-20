import Fastify from "fastify";
import { registry, httpRequestsTotal, httpRequestDurationSeconds, blockedRequestsTotal, denyListSize, authFailuresTotal } from './metrics.js';
import { Denylist } from "./denylist.js";
import { reaquireInternalApiKey } from "./auth.js";
import { getClientIp } from "./utils.js";

const server = Fastify({ logger: true });
const denylist = new Denylist();

const ALLOWLIST_PATHS = new Set(["/health", "/metrics"]);


// Periodically update the denylist size gauge
setInterval(() => {
    denylist.cleanupExpired();
    denyListSize.set(denylist.size());
}, 10_000);

// ---- Metrics hooks ----
// We'll store a timer function on the request so we can stop it later.
declare module "fastify" {
    interface FastifyRequest {
        _metricsTimer?: (labels?: Record<string, string>) => void;
    }
}

// Start timer at the beginning of each request
server.addHook("onRequest", async (req, reply) => {

    const method = req.method;

    // Always available early (before routing is finalized)
    const path = req.url.split("?")[0];

    // Skip internal endpoints so you don't lock yourself out
    if (path.startsWith("/internal")) return;

    const { ip, ipOriginal, source } = getClientIp(req);
    req.log.info({ ip, ipOriginal, source }, "client_ip_resolved");

    // Allowlist essential endpoints
    if (ALLOWLIST_PATHS.has(path)) return;

    const entry = denylist.get(ip);
    if (entry) {
        blockedRequestsTotal.inc({ route: path }, 1);
        req.log.warn({ ip, reason: entry.reason, route: path }, "blocked by denylist");
        return reply.code(403).send({ error: "blocked", reason: entry.reason });
    }

    // Use routeOptions if available, else fallback to path
    const route = req.routeOptions?.url ?? path;

    // startTimer returns a function; calling it with labels records an observation
    const end = httpRequestDurationSeconds.startTimer({ method, route, status: "0" });
    req._metricsTimer = end;
});

// Record final labels at the end
server.addHook("onResponse", async (req, reply) => {
    const method = req.method;
    const path = req.url.split("?")[0];
    const route = req.routeOptions?.url ?? path;
    const status = String(reply.statusCode);

    httpRequestsTotal.inc({ method, route, status }, 1);

    // Finish the timer if it exists
    req._metricsTimer?.({ method, route, status });
});



server.get('/health', async () => {
    return { ok: true, message: "Hello Cutie, I love you meri Fulu!" };
});

// Prometheus scrape endpoint
server.get("/metrics", async (_req, reply) => {
    denyListSize.set(denylist.size());
    reply.header("Content-Type", registry.contentType);
    return registry.metrics();
});


// ---- Internal endpoints (API-key protected) ----
server.post("/internal/block-ip", async (req, reply) => {
    if (!reaquireInternalApiKey(req)) {
        reply.code(401).send({ error: "unauthorized" });
        return;
    }

    const body = req.body as any;
    const ip = String(body?.ip ?? "");
    const reason = String(body?.reason ?? "unspecified");
    const ttlSeconds = Number(body?.ttlSeconds ?? 0);

    if (!ip || !Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
        return reply.code(400).send(
            {
                error: "invalid payload",
                expected: { ip: "string", reason: "string", ttlSeconds: "positive number" }
            }
        );
    }

    denylist.add(ip, ttlSeconds, reason);
    denyListSize.set(denylist.size());
    req.log.info({ ip, ttlSeconds, reason }, "added to denylist");

    return { ok: true, deny_list_size: denylist.size() };
});

server.post("/internal/unblock-ip", async (req, reply) => {
    if (!reaquireInternalApiKey(req)) {
        reply.code(401).send({ error: "unauthorized" });
        return;
    }

    const body = req.body as any;
    const ip = String(body?.ip ?? "");

    if (!ip) return reply.code(400).send(
        { error: "invalid payload", expected: { ip: "string" } }
    );

    denylist.remove(ip);
    denyListSize.set(denylist.size());
    req.log.info({ ip }, "removed from denylist");

    return { ok: true, deny_list_size: denylist.size() };
});

// ---- Auction Logic (The Victim Features) ----
import fastifyStatic from "@fastify/static";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from public/ directory
server.register(fastifyStatic, {
    root: path.join(__dirname, "../public"),
    prefix: "/",
});

// ---- Auction Logic (The Victim Features) ----

// Simple in-memory state for the auction
let currentBid = 100;
let highestBidder = "House";
const bidHistory: Array<{ bidder: string; amount: number; ts: string }> = [];

// (GET / is handled by fastify-static -> index.html)

server.get("/state", async () => {
    return { currentBid, highestBidder, history: bidHistory.slice(-5) };
});

server.post("/bid", async (req, reply) => {
    const body = req.body as any;
    const amount = Number(body?.amount ?? 0);
    const bidder = String(body?.bidder ?? "Anonymous");

    if (amount <= 0) return reply.code(400).send({ error: "Bid must be positive" });

    currentBid += amount;
    highestBidder = bidder;
    bidHistory.push({ bidder, amount, ts: new Date().toISOString() });

    // Simulate some "business logic" latency
    await new Promise(r => setTimeout(r, Math.random() * 50));

    return { status: "accepted", currentBid, highestBidder };
});


// Authentication endpoint (Target for credential stuffing)
// ---- Auth (JSON File Persistence) ----
import fs from "fs/promises";

const DB_PATH = path.join(__dirname, "../data/users.json");

// Returns Record<username, { pass, role }>
async function getUsers() {
    try {
        const data = await fs.readFile(DB_PATH, "utf-8");
        return JSON.parse(data);
    } catch { return {}; }
}

async function saveUsers(users: Record<string, any>) {
    await fs.writeFile(DB_PATH, JSON.stringify(users, null, 2));
}

server.post("/signup", async (req, reply) => {
    const body = req.body as any;
    const user = String(body?.username ?? "").trim();
    const pass = String(body?.password ?? "").trim();

    if (!user || !pass) return reply.code(400).send({ error: "Missing fields" });

    const users = await getUsers();
    if (users[user]) {
        return reply.code(409).send({ error: "User already exists" });
    }

    // Default role is "user"
    users[user] = { pass, role: "user" };
    await saveUsers(users);

    return { status: "created", username: user, role: "user" };
});

server.post("/login", async (req, reply) => {
    const body = req.body as any;
    const user = String(body?.username ?? "");
    const pass = String(body?.password ?? "");

    const users = await getUsers();
    const foundData = users[user]; // O(1) lookup

    if (foundData && foundData.pass === pass) {
        return {
            token: "valid-session-token-" + Math.floor(Math.random() * 10000),
            username: user,
            role: foundData.role
        };
    }

    // Track failures for detection
    authFailuresTotal.inc();
    req.log.warn({ user, ip: req.ip }, "login_failed");

    return reply.code(401).send({ error: "Invalid credentials" });
});

// Chaos endpoint (for Scenario A)
let shouldCrash = false;
server.post("/crash", async (req, reply) => {
    shouldCrash = true;
    req.log.fatal("POISON PILL RECEIVED. SERVICE WILL CRASH.");
    return { status: "dying" };
});

// Middleware to simulate the crash loop
server.addHook("onRequest", async (_req, reply) => {
    if (shouldCrash) {
        // Return 500s indefinitely
        reply.code(500).send({ error: "Internal Server Error (Simulated Crash)" });
        // In a real crash loop, the process might exit, but returning 500s is easier to keep the pod running for metrics
        throw new Error("Simulated Crash");
    }
});

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

await server.listen({ port, host });
server.log.info({ port, host }, "api-service listening");