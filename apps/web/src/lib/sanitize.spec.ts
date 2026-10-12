import { sanitizeHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  it("strips script tags and event handlers", () => {
    const dirty =
      '<p onclick="alert(1)">ok</p><script>alert(1)</script><img src=x onerror=alert(1)>';
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("onerror");
  });

  it("drops javascript URLs", () => {
    const clean = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    expect(clean.toLowerCase()).not.toContain("javascript:");
  });

  it("drops remote images outside /api/uploads", () => {
    const clean = sanitizeHtml(
      '<img src="https://evil.test/track.png" alt="x">',
    );
    expect(clean).not.toContain("evil.test");
  });

  it("keeps controlled upload images", () => {
    const clean = sanitizeHtml(
      '<img src="/api/uploads/blog/photo.webp" alt="blog">',
    );
    expect(clean).toContain("/api/uploads/blog/photo.webp");
  });
});
