import {
  authorizeStorefrontRevalidate,
  extractBearerToken,
} from "./revalidate-auth";

describe("homepage revalidate auth", () => {
  it("rejects unauthenticated requests", async () => {
    const request = new Request("http://localhost/api/revalidate-homepage", {
      method: "POST",
    });
    expect(extractBearerToken(request)).toBeNull();
    const result = await authorizeStorefrontRevalidate(request, async () => {
      throw new Error("must not call auth");
    });
    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "Authentication required",
    });
  });

  it("rejects a non-admin bearer token", async () => {
    const request = new Request("http://localhost/api/revalidate-homepage", {
      method: "POST",
      headers: { Authorization: "Bearer customer-token" },
    });
    const result = await authorizeStorefrontRevalidate(request, async () =>
      new Response(JSON.stringify({ roles: ["customer"] }), { status: 200 }),
    );
    expect(result).toEqual({
      ok: false,
      status: 403,
      error: "Administrator role required",
    });
  });

  it("allows an administrator authenticated by HttpOnly cookies", async () => {
    const request = new Request("http://localhost/api/revalidate-homepage", {
      method: "POST",
      headers: { cookie: "uniqbd_access=admin-cookie" },
    });
    const result = await authorizeStorefrontRevalidate(request, async (url, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("cookie")).toContain("uniqbd_access=admin-cookie");
      expect(headers.get("authorization")).toBeNull();
      return new Response(JSON.stringify({ roles: ["admin"] }), { status: 200 });
    });
    expect(result).toEqual({ ok: true });
  });

  it("allows a strict administrator", async () => {
    const request = new Request("http://localhost/api/revalidate-homepage", {
      method: "POST",
      headers: { Authorization: "Bearer admin-token" },
    });
    const result = await authorizeStorefrontRevalidate(request, async () =>
      new Response(JSON.stringify({ roles: ["admin"] }), { status: 200 }),
    );
    expect(result).toEqual({ ok: true });
  });
});
