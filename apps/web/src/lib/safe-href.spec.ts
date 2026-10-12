import { isSafeMenuHref } from "./safe-href";

describe("isSafeMenuHref", () => {
  it("accepts site-relative paths and absolute http(s) URLs", () => {
    expect(isSafeMenuHref("/products")).toBe(true);
    expect(isSafeMenuHref("/products?type=topup")).toBe(true);
    expect(isSafeMenuHref("https://uniqbd.com/about")).toBe(true);
  });

  it("rejects protocol-relative and javascript URLs", () => {
    expect(isSafeMenuHref("//evil.test")).toBe(false);
    expect(isSafeMenuHref("/\\evil.test")).toBe(false);
    expect(isSafeMenuHref("javascript:alert(1)")).toBe(false);
    expect(isSafeMenuHref("data:text/html,hi")).toBe(false);
  });
});
