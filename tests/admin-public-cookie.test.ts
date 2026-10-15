import "./setup.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { adminCookieSecure } from "../apps/api/src/routes/admin-auth.ts";

test("the public HTTPS host keeps Secure cookies while the private admin preview remains usable", () => {
  const hosts = new Set(["localhost", "127.0.0.1", "100.64.0.10"]);
  const site = "https://kk-hydraulic-research.cn";
  assert.equal(adminCookieSecure("kk-hydraulic-research.cn", site, hosts), true);
  assert.equal(adminCookieSecure("100.64.0.10:3000", site, hosts), false);
  assert.equal(adminCookieSecure("127.0.0.1:3000", site, hosts), false);
  assert.equal(adminCookieSecure("kk-hydraulic-research.cn", "http://100.64.0.10:3000", hosts), false);
});
