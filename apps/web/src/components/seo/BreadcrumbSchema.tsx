import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema, type BreadcrumbItem } from "@/lib/structured-data";

export type BreadcrumbSchemaProps = {
  /** Ordered trail, e.g. Home > Category > Product. Paths are site-relative. */
  items: BreadcrumbItem[];
  /** Admin canonical domain — keeps JSON-LD URLs aligned with metadataBase. */
  siteUrl?: string;
};

/** BreadcrumbList JSON-LD. Render exactly once per page. */
export function BreadcrumbSchema({ items, siteUrl }: BreadcrumbSchemaProps) {
  return <JsonLd data={breadcrumbSchema(items, { siteUrl })} />;
}
