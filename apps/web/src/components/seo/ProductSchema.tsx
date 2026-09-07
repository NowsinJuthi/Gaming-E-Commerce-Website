import { JsonLd } from "@/components/seo/JsonLd";
import type { PublicProductReview } from "@/lib/api";
import {
  productSchema,
  type ProductReviewSchemaEntry,
  type ProductSchemaInput,
} from "@/lib/structured-data";

/** Cap the number of Review entries embedded in JSON-LD to keep the page light. */
const MAX_SCHEMA_REVIEWS = 10;

/**
 * Maps published customer reviews (public API shape) to schema.org Review
 * entries. The public reviews endpoint only returns published reviews, so no
 * extra status filtering is needed here.
 */
export function toReviewSchemaEntries(
  reviews: PublicProductReview[],
): ProductReviewSchemaEntry[] {
  return reviews.slice(0, MAX_SCHEMA_REVIEWS).map((review) => ({
    author: review.customerName,
    rating: review.rating,
    body: review.body,
    title: review.title,
    date: review.createdAt,
  }));
}

export type ProductSchemaProps = ProductSchemaInput;

/**
 * Product JSON-LD (Product + Offer + AggregateRating + Review) for Google
 * Product Rich Results. Render exactly once per product page.
 */
export function ProductSchema(props: ProductSchemaProps) {
  return <JsonLd data={productSchema(props)} />;
}
