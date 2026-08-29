import { describe, expect, it } from "vitest";
import {
  getReturnIssueLabel,
  getReturnResolutionLabel,
  getReturnStatusMeta,
  resolveReturnEvidenceUrl,
} from "./returnUtils.js";

describe("return UI helpers", () => {
  it("localizes status, issue, and resolution labels", () => {
    expect(getReturnStatusMeta("waiting_customer", "id").label).toBe("Menunggu jawabanmu");
    expect(getReturnStatusMeta("waiting_customer", "en").label).toBe("Waiting for your response");
    expect(getReturnIssueLabel("wrong_item", "en")).toBe("Wrong item delivered");
    expect(getReturnResolutionLabel("replacement", "id")).toBe("Penggantian barang");
  });

  it("resolves local evidence through the configured API base", () => {
    expect(resolveReturnEvidenceUrl("/uploads/a.webp", "https://api.test")).toBe(
      "https://api.test/uploads/a.webp"
    );
    expect(
      resolveReturnEvidenceUrl(
        "https://res.cloudinary.com/demo/image/upload/a.webp",
        "https://api.test"
      )
    ).toBe("https://res.cloudinary.com/demo/image/upload/a.webp");
  });
});
