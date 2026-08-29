import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildContentSecurityPolicyDirectives } from "../src/config/contentSecurityPolicy.js";

describe("content security policy", () => {
  it("mengizinkan Cloudflare Web Analytics tanpa wildcard script global", () => {
    const directives = buildContentSecurityPolicyDirectives(true);

    assert.ok(directives.scriptSrc.includes("https://static.cloudflareinsights.com"));
    assert.ok(directives.connectSrc.includes("'self'"));
    assert.ok(!directives.scriptSrc.includes("*"));
    assert.ok(!directives.scriptSrc.includes("'unsafe-inline'"));
    assert.deepEqual(directives.scriptSrcAttr, ["'none'"]);
  });

  it("memisahkan endpoint Midtrans production dan sandbox", () => {
    const production = buildContentSecurityPolicyDirectives(true);
    const sandbox = buildContentSecurityPolicyDirectives(false);

    assert.ok(production.scriptSrc.includes("https://app.midtrans.com"));
    assert.ok(!production.scriptSrc.includes("https://app.sandbox.midtrans.com"));
    assert.ok(sandbox.scriptSrc.includes("https://app.sandbox.midtrans.com"));
    assert.ok(sandbox.connectSrc.includes("https://api.sandbox.midtrans.com"));
  });
});
