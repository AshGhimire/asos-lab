export type DenyEntry = {
    ip: string;
    reason: string;
    expiresAtMs: number;
};

export class Denylist {
    private readonly entries = new Map<string, DenyEntry>();

    add(ip: string, ttlSeconds: number , reason: string) {
        const expiresAtMs = Date.now() + ttlSeconds * 1000;
        this.entries.set(ip, { ip, reason, expiresAtMs });
    }

    remove(ip: string) {
        this.entries.delete(ip);
    }

    get(ip: string): DenyEntry | undefined {
        const entry = this.entries.get(ip);

        if (!entry) return undefined;

        if (entry.expiresAtMs <= Date.now()) {
            this.entries.delete(ip);
            return undefined;
        }
    
        return entry;
    }

    list(): DenyEntry[] {
        this.cleanupExpired();
        return Array.from(this.entries.values());
    }

    size(): number {
        this.cleanupExpired();
        return this.entries.size;
    }

    cleanupExpired() {
        const now = Date.now();
        for (const [ip, entry] of this.entries) {
            if (entry.expiresAtMs <= now) this.entries.delete(ip);
        }
    }
}