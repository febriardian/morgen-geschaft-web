import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifySmtpError,
  getSmtpConfig,
  smtpTransportOptions,
  verifySmtpConnection,
} from "../src/services/email.js";

const COMPLETE_ENV = {
  SMTP_HOST: "mail.morgengeschaft.com",
  SMTP_PORT: "465",
  SMTP_USER: "noreply@morgengeschaft.com",
  SMTP_PASS: "test-only-password",
};

describe("SMTP configuration", () => {
  it("uses implicit TLS for port 465 and finite connection timeouts", () => {
    const config = getSmtpConfig(COMPLETE_ENV);
    const options = smtpTransportOptions(COMPLETE_ENV);

    assert.equal(config.configured, true);
    assert.equal(config.secure, true);
    assert.equal(options.secure, true);
    assert.equal(options.connectionTimeout, 10000);
    assert.equal(options.greetingTimeout, 10000);
    assert.equal(options.socketTimeout, 15000);
    assert.equal(options.tls.minVersion, "TLSv1.2");
  });

  it("reports all missing required variables without exposing values", () => {
    const config = getSmtpConfig({ SMTP_HOST: "mail.example.com" });
    assert.equal(config.configured, false);
    assert.deepEqual(config.missing, ["SMTP_USER", "SMTP_PASS"]);
  });
});

describe("SMTP verification", () => {
  it("returns latency and closes the transport after a successful handshake", async () => {
    let closed = false;
    const result = await verifySmtpConnection({
      env: COMPLETE_ENV,
      transportFactory: () => ({
        async verify() {},
        close() {
          closed = true;
        },
      }),
    });

    assert.equal(result.status, "ok");
    assert.equal(result.configured, true);
    assert.equal(result.latencyMs >= 0, true);
    assert.equal(closed, true);
  });

  it("classifies authentication, connection, and TLS failures", () => {
    assert.equal(classifySmtpError({ code: "EAUTH" }), "authentication_error");
    assert.equal(classifySmtpError({ code: "ETIMEDOUT" }), "connection_error");
    assert.equal(classifySmtpError({ message: "certificate has expired" }), "tls_error");
  });
});
