import { getPostLoginRedirect, isSafeRedirectPath } from "./auth-roles";

describe("isSafeRedirectPath", () => {
  it("accepts internal paths", () => {
    expect(isSafeRedirectPath("/dashboard")).toBe(true);
    expect(isSafeRedirectPath("/admin/sales/orders")).toBe(true);
  });

  it("rejects open redirects", () => {
    expect(isSafeRedirectPath("https://evil.test")).toBe(false);
    expect(isSafeRedirectPath("//evil.test")).toBe(false);
    expect(isSafeRedirectPath("/\\evil.test")).toBe(false);
    expect(isSafeRedirectPath("/login")).toBe(false);
  });
});

describe("getPostLoginRedirect", () => {
  it("uses a safe next path for customers", () => {
    expect(getPostLoginRedirect(["customer"], null, "/orders")).toBe("/orders");
  });

  it("ignores an external next path", () => {
    expect(getPostLoginRedirect(["customer"], null, "//evil.test")).toBe(
      "/dashboard",
    );
  });
});
