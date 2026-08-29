import { describe, expect, it } from "vitest";
import {
  createNotificationBaseline,
  filterNotificationsAfterBaseline,
  getNotificationTime,
  isNotificationAfterBaseline,
  isNotificationBaselineValid,
} from "./notificationInbox.js";

const OLD_TIME = "2026-07-25T07:13:00.000Z";
const LATEST_TIME = "2026-07-29T10:00:00.000Z";
const NEW_TIME = "2026-07-30T12:00:00.000Z";

describe("notification browser baseline", () => {
  it("membuat baseline dari notifikasi terbaru yang sudah ada", () => {
    const baseline = createNotificationBaseline([
      { id: "old", sentAt: OLD_TIME },
      { id: "latest", sentAt: LATEST_TIME },
    ]);

    expect(baseline).toEqual({
      version: 1,
      sentAtMs: Date.parse(LATEST_TIME),
      idsAtSentAt: ["latest"],
    });
    expect(isNotificationBaselineValid(baseline)).toBe(true);
  });

  it("menyembunyikan seluruh riwayat saat browser pertama kali diinisialisasi", () => {
    const existing = [
      { id: "review-old", sentAt: OLD_TIME },
      { id: "promo-old", sentAt: LATEST_TIME },
    ];
    const baseline = createNotificationBaseline(existing);

    expect(filterNotificationsAfterBaseline(existing, baseline)).toEqual([]);
  });

  it("hanya menampilkan notifikasi yang dibuat sesudah baseline", () => {
    const baseline = createNotificationBaseline([
      { id: "promo-old", sentAt: LATEST_TIME },
    ]);
    const notifications = [
      { id: "new-article", sentAt: NEW_TIME },
      { id: "promo-old", sentAt: LATEST_TIME },
      { id: "review-old", sentAt: OLD_TIME },
    ];

    expect(filterNotificationsAfterBaseline(notifications, baseline)).toEqual([
      { id: "new-article", sentAt: NEW_TIME },
    ]);
  });

  it("menerima ID baru pada milidetik yang sama tanpa memunculkan ID baseline", () => {
    const baseline = createNotificationBaseline([
      { id: "existing", sentAt: LATEST_TIME },
    ]);

    expect(isNotificationAfterBaseline({ id: "existing", sentAt: LATEST_TIME }, baseline)).toBe(false);
    expect(isNotificationAfterBaseline({ id: "new-id", sentAt: LATEST_TIME }, baseline)).toBe(true);
  });

  it("memakai waktu inisialisasi ketika database masih kosong", () => {
    const now = Date.parse("2026-07-30T11:00:00.000Z");
    const baseline = createNotificationBaseline([], now);

    expect(baseline.sentAtMs).toBe(now);
    expect(filterNotificationsAfterBaseline([
      { id: "future", sentAt: NEW_TIME },
    ], baseline)).toHaveLength(1);
  });

  it("mendukung bentuk timestamp Firestore dan menolak tanggal rusak", () => {
    expect(getNotificationTime({ sentAt: { seconds: 1_700_000_000 } })).toBe(1_700_000_000_000);
    expect(getNotificationTime({ sentAt: { _seconds: 1_700_000_001 } })).toBe(1_700_000_001_000);
    expect(getNotificationTime({ sentAt: "tanggal-rusak" })).toBeNull();
  });
});
