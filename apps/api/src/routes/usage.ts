import { createHmac } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { credential } from "@aihot/backend/config";
import { sql } from "@aihot/backend/db";

type Kind = "page_view" | "search" | "favorite_add" | "favorite_remove" | "export";
const KINDS = new Set<Kind>(["page_view", "search", "favorite_add", "favorite_remove", "export"]);
const recentByIp = new Map<string, number[]>();

function rateLimited(req: FastifyRequest): boolean {
  const now = Date.now();
  const recent = (recentByIp.get(req.ip) ?? []).filter((time) => now - time < 60_000);
  if (recent.length >= 120) return true;
  recent.push(now);
  recentByIp.set(req.ip, recent);
  if (recentByIp.size > 10_000) recentByIp.clear();
  return false;
}

export function registerUsage(app: FastifyInstance): void {
  app.post("/api/usage/events", { bodyLimit: 1024 }, async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    if (req.headers["sec-fetch-site"] === "cross-site") return reply.code(403).send();
    if (rateLimited(req)) return reply.code(429).send();
    const input = (req.body ?? {}) as Record<string, unknown>;
    const event = input.event;
    const visitorId = input.visitorId;
    if (typeof event !== "string" || !KINDS.has(event as Kind) || typeof visitorId !== "string" || !/^[a-f0-9-]{36}$/.test(visitorId)) {
      return reply.code(400).send();
    }
    const rawPath = typeof input.path === "string" ? input.path : "";
    const path = rawPath.startsWith("/") && !rawPath.startsWith("/admin") ? rawPath.split("?")[0]!.slice(0, 160) : null;
    if (!path) return reply.code(400).send();
    const rawTerm = typeof input.term === "string" ? input.term.trim().slice(0, 120) : "";
    const term = event === "search" && rawTerm && !/@|sk-[a-z0-9_-]{12,}/i.test(rawTerm) ? rawTerm : null;
    if (event === "search" && !term) return reply.code(400).send();
    const secret = credential("auth", "SESSION_SECRET");
    if (!secret) return reply.code(503).send();
    const visitorHash = createHmac("sha256", secret).update(visitorId).digest("hex");
    await sql`INSERT INTO usage_events (event_type, visitor_hash, path, search_term) VALUES (${event}, ${visitorHash}, ${path}, ${term})`;
    return reply.code(204).send();
  });
}
