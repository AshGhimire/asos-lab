// utils.ts

function normalizeIp(ip: string) {
  // IPv6 localhost → IPv4 localhost
  if (ip === "::1") return "127.0.0.1";

  // IPv4-mapped IPv6 → IPv4
  // ::ffff:127.0.0.1 → 127.0.0.1
  if (ip.startsWith("::ffff:")) return ip.slice(7);

  return ip;
}

/**
 * Return true only if the TCP peer is a proxy we trust
 * (i.e. something we control, not a random internet client)
 */
function isTrustedProxyPeer(remoteAddress?: string) {
  if (!remoteAddress) return false;

  const ip = normalizeIp(remoteAddress);

  // localhost
  if (ip === "127.0.0.1") return true;

  // private IPv4 ranges (good enough for MVP)
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;

  // 172.16.0.0 – 172.31.255.255
  if (ip.startsWith("172.")) {
    const second = Number(ip.split(".")[1]);
    if (Number.isFinite(second) && second >= 16 && second <= 31) {
      return true;
    }
  }

  return false;
}

export function getClientIp(req: any) {
  let ipOriginal: string | undefined;
  let source: "req.ip" | "x-forwarded-for" | "socket" | "unknown" = "unknown";

  /**
   * 1) Preferred: Fastify-derived IP
   * - Safe
   * - Respects trustProxy if you enable it later
   */
  if (typeof req.ip === "string" && req.ip.length > 0) {
    ipOriginal = req.ip;
    source = "req.ip";
  }

  /**
   * 2) x-forwarded-for
   * ONLY if the TCP peer is a trusted proxy
   */
  if (!ipOriginal && isTrustedProxyPeer(req.socket?.remoteAddress)) {
    const xff = req.headers["x-forwarded-for"];
    if (typeof xff === "string" && xff.length > 0) {
      ipOriginal = xff.split(",")[0].trim(); // first hop only
      source = "x-forwarded-for";
    }
  }

  /**
   * 3) Final fallback: raw socket IP
   */
  if (!ipOriginal && req.socket?.remoteAddress) {
    ipOriginal = req.socket.remoteAddress;
    source = "socket";
  }

  const ip = ipOriginal ? normalizeIp(ipOriginal) : "unknown";

  return {
    ip,
    ipOriginal,
    source,
  };
}
