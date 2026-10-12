import sanitizeHtmlLib from "sanitize-html";

const SANITIZE_OPTIONS: sanitizeHtmlLib.IOptions = {
  allowedTags: [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "p",
    "a",
    "ul",
    "ol",
    "nl",
    "li",
    "b",
    "i",
    "strong",
    "em",
    "strike",
    "code",
    "hr",
    "br",
    "div",
    "span",
    "table",
    "thead",
    "caption",
    "tbody",
    "tr",
    "th",
    "td",
    "pre",
    "img",
    "sub",
    "sup",
    "del",
    "ins",
    "abbr",
    "cite",
    "dfn",
    "kbd",
    "samp",
    "var",
  ],
  allowedAttributes: {
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "width", "height"],
    span: ["style", "class"],
    p: ["style", "class"],
    div: ["style", "class"],
    h1: ["style", "class"],
    h2: ["style", "class"],
    h3: ["style", "class"],
    h4: ["style", "class"],
    h5: ["style", "class"],
    h6: ["style", "class"],
    li: ["style", "class"],
    "*": ["class"],
  },
  allowedStyles: {
    "*": {
      color: [
        /^#[0-9a-f]{3,8}$/i,
        /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i,
        /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*(0|1|0?\.\d+)\s*\)$/i,
      ],
    },
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowProtocolRelative: false,
  enforceHtmlBoundary: true,
  disallowedTagsMode: "discard",
  transformTags: {
    a: (tagName, attribs) => {
      const next = { ...attribs };
      const href = next.href?.trim() ?? "";
      if (/^(javascript|data|vbscript):/i.test(href)) {
        delete next.href;
      }
      if (next.target === "_blank") {
        next.rel = "noopener noreferrer";
      }
      return { tagName, attribs: next };
    },
    img: (tagName, attribs) => {
      const next = { ...attribs };
      const src = next.src?.trim() ?? "";
      // Rich-text images must come from the controlled upload endpoint. This
      // prevents stored content from loading arbitrary tracking resources.
      if (!src.startsWith("/api/uploads/")) {
        delete next.src;
      }
      return { tagName, attribs: next };
    },
  },
};

/**
 * Sanitizes admin-authored HTML before it is rendered with
 * `dangerouslySetInnerHTML`, stripping scripts/event handlers so stored content
 * can never execute as XSS in another visitor's browser. Uses sanitize-html so
 * SSR works without jsdom (isomorphic-dompurify breaks Next.js bundles).
 */
export function sanitizeHtml(html: string | undefined | null): string {
  if (!html) return "";
  return sanitizeHtmlLib(html, SANITIZE_OPTIONS);
}
