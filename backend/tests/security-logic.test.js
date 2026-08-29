// backend/tests/security-logic.test.js
// Test logika keamanan yang kini bisa diuji langsung: filter IP webhook (CIDR)
// dan deteksi gambar via magic bytes.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseCidr, ipMatchesCidrs } from "../src/utils/webhookIp.js";
import { sniffImageType } from "../src/utils/imageType.js";

describe("parseCidr", () => {
  it("parse IP tunggal sebagai /32", () => {
    const parsed = parseCidr("103.208.23.1");
    assert.notEqual(parsed, null);
    assert.equal(parsed.maskInt >>> 0, 0xffffffff);
  });

  it("parse CIDR /24", () => {
    const parsed = parseCidr("103.208.23.0/24");
    assert.notEqual(parsed, null);
    assert.equal(parsed.maskInt >>> 0, 0xffffff00);
  });

  it("menolak format tidak valid", () => {
    assert.equal(parseCidr("999.1.1.1"), null);
    assert.equal(parseCidr("bukan-ip"), null);
    assert.equal(parseCidr("1.2.3.4/40"), null);
  });
});

describe("ipMatchesCidrs", () => {
  const cidrs = [parseCidr("103.208.23.0/24"), parseCidr("10.0.0.5")].filter(Boolean);

  it("cocok untuk IP di dalam range /24", () => {
    assert.equal(ipMatchesCidrs("103.208.23.77", cidrs), true);
  });

  it("cocok untuk IP tunggal /32", () => {
    assert.equal(ipMatchesCidrs("10.0.0.5", cidrs), true);
  });

  it("tidak cocok untuk IP di luar range", () => {
    assert.equal(ipMatchesCidrs("8.8.8.8", cidrs), false);
    assert.equal(ipMatchesCidrs("103.208.24.1", cidrs), false);
  });

  it("menormalkan prefix IPv4-mapped IPv6 (::ffff:)", () => {
    assert.equal(ipMatchesCidrs("::ffff:103.208.23.10", cidrs), true);
  });

  it("daftar kosong tidak pernah cocok", () => {
    assert.equal(ipMatchesCidrs("103.208.23.1", []), false);
  });
});

describe("sniffImageType", () => {
  it("mengenali JPEG dari magic bytes", () => {
    assert.equal(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
  });

  it("mengenali PNG", () => {
    assert.equal(
      sniffImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
      "image/png"
    );
  });

  it("mengenali WebP (RIFF....WEBP)", () => {
    const webp = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from("WEBP", "ascii"),
    ]);
    assert.equal(sniffImageType(webp), "image/webp");
  });

  it("menolak byte non-gambar (mis. skrip PHP)", () => {
    assert.equal(sniffImageType(Buffer.from("<?php echo 1; ?>", "ascii")), null);
  });

  it("menolak buffer kosong / tidak valid", () => {
    assert.equal(sniffImageType(Buffer.alloc(0)), null);
    assert.equal(sniffImageType(null), null);
  });
});
