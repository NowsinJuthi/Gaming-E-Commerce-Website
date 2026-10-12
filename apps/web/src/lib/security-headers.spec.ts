import {
  CSP_INLINE_STYLE_RESIDUALS,
  CSP_STYLE_SRC_ATTR_UNSAFE_INLINE,
} from "./csp-inline-styles";
import { buildContentSecurityPolicy } from "./security-headers";

describe("content security policy", () => {
  it("uses a nonce and omits script-src unsafe-inline when a nonce is supplied", () => {
    const csp = buildContentSecurityPolicy("abc123nonce");
    expect(csp).toContain("'nonce-abc123nonce'");
    const scriptSrc = csp
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("script-src"));
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it("keeps object-src none and form-action self", () => {
    const csp = buildContentSecurityPolicy("n");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
  });

  it("drops style-src unsafe-inline when a nonce is present and keeps style attributes", () => {
    const csp = buildContentSecurityPolicy("styleNonce");
    const styleSrc = csp
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("style-src "));
    expect(styleSrc).toContain("'nonce-styleNonce'");
    expect(styleSrc).not.toContain("'unsafe-inline'");
    expect(csp).toContain(CSP_STYLE_SRC_ATTR_UNSAFE_INLINE);
  });

  it("documents residual inline style attributes that block dropping style-src-attr", () => {
    expect(CSP_INLINE_STYLE_RESIDUALS.length).toBeGreaterThan(5);
    expect(CSP_STYLE_SRC_ATTR_UNSAFE_INLINE).toBe("style-src-attr 'unsafe-inline'");
  });
});
