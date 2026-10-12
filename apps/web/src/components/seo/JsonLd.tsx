type JsonLdProps = {
  /** One schema object, or several to emit as separate JSON-LD blocks. */
  data: Record<string, unknown> | Array<Record<string, unknown>>;
  nonce?: string;
};

/**
 * Renders structured data as `application/ld+json`. The payload is
 * machine-generated JSON (never raw user HTML); `<` is escaped so the script
 * tag can never be broken out of, keeping it XSS-safe.
 */
export function JsonLd({ data, nonce }: JsonLdProps) {
  const blocks = Array.isArray(data) ? data : [data];
  return (
    <>
      {blocks.map((block, index) => (
        <script
          key={index}
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(block).replace(/</g, "\\u003c"),
          }}
        />
      ))}
    </>
  );
}
