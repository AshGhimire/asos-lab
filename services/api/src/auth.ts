import type { FastifyRequest } from  "fastify";

export function reaquireInternalApiKey(req: FastifyRequest) {
    const expected = process.env.ASOS_INTERNAL_KEY;
    if (!expected) {
        throw new Error("ASOS_INTERNAL_KEY is not set");
    }

    const header = req.headers["authorization"];
    if (!header || typeof header !== "string") return false;

    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer") return false;

    return token === expected;
}

