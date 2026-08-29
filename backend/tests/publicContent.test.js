import assert from "node:assert/strict";
import test from "node:test";
import { isPublicBlog, serializeBlog } from "../src/routes/publicContent.js";

test("public blog filter excludes drafts and archives", () => {
  assert.equal(isPublicBlog({ status: "published" }), true);
  assert.equal(isPublicBlog({ status: "draft" }), false);
  assert.equal(isPublicBlog({ isArchived: true }), false);
});

test("public blog serializer normalizes Firestore timestamps", () => {
  const document = {
    id: "blog-1",
    data: () => ({
      title: "Test",
      date: { seconds: 1_750_000_000 },
      createdAt: { seconds: 1_749_000_000 },
    }),
  };
  const serialized = serializeBlog(document);

  assert.equal(serialized.id, "blog-1");
  assert.match(serialized.date, /^2025-/);
  assert.equal(serialized.createdAt, 1_749_000_000_000);
});
