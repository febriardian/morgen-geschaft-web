import { describe, expect, it } from "vitest";
import { isPublicBlog, sortBlogs, sortProducts } from "./publicContent.js";

describe("public storefront content", () => {
  it("orders active products without exposing archived rows", () => {
    expect(
      sortProducts([
        { id: "p2", name: "Second", order: 2 },
        { id: "p1", name: "First", order: 1 },
        { id: "p3", name: "Archived", order: 0, isArchived: true },
      ]).map((product) => product.id)
    ).toEqual(["p1", "p2"]);
  });

  it("keeps only public articles and sorts newest first", () => {
    const posts = sortBlogs([
      { id: "old", date: "2026-01-01", status: "published" },
      { id: "draft", date: "2026-12-01", status: "draft" },
      { id: "new", date: "2026-07-01", status: "published" },
    ]);

    expect(posts.map((post) => post.id)).toEqual(["new", "old"]);
    expect(isPublicBlog({ status: "published" })).toBe(true);
    expect(isPublicBlog({ status: "archived" })).toBe(false);
  });
});
