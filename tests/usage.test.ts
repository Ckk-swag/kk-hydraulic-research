import "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { buildApp } from "../apps/api/src/app.ts";
import { closeDb, sql } from "@aihot/backend/db";
import { usageOverview } from "@aihot/backend/admin/usage";

const app = await buildApp();
after(async () => { await app.close(); await closeDb(); });

test("anonymous events store only a keyed browser hash and reach the aggregate dashboard", async () => {
  const visitorId = "11111111-1111-4111-8111-111111111111";
  const page = await app.inject({ method: "POST", url: "/api/usage/events", payload: { event: "page_view", visitorId, path: "/topics" } });
  assert.equal(page.statusCode, 204);
  const search = await app.inject({ method: "POST", url: "/api/usage/events", payload: { event: "search", visitorId, path: "/all", term: "泥沙输运" } });
  assert.equal(search.statusCode, 204);
  const [row] = await sql<{ visitor_hash: string; path: string }[]>`SELECT visitor_hash, path FROM usage_events WHERE path = '/topics' ORDER BY id DESC LIMIT 1`;
  assert.equal(row!.visitor_hash.length, 64);
  assert.ok(!row!.visitor_hash.includes(visitorId));
  const overview = await usageOverview(7);
  assert.ok(overview.totals.page_views >= 1);
  assert.ok(overview.totals.active_browsers >= 1);
  assert.ok(overview.terms.some((x) => x.term === "泥沙输运"));
  assert.equal((await app.inject({ url: "/api/admin/usage" })).statusCode, 401);
});

test("usage endpoint rejects malformed and cross-site events", async () => {
  const payload = { event: "favorite_add", visitorId: "11111111-1111-4111-8111-111111111111", path: "/items/example" };
  assert.equal((await app.inject({ method: "POST", url: "/api/usage/events", payload: { ...payload, visitorId: "not-a-uuid" } })).statusCode, 400);
  assert.equal((await app.inject({ method: "POST", url: "/api/usage/events", headers: { "sec-fetch-site": "cross-site" }, payload })).statusCode, 403);
});
