import type { Metadata } from "next";
import { ReviewsListingView } from "@/components/reviews/ReviewsListingView";
import {
  ALL_REVIEWS_PAGE_SIZE,
  fetchAllReviews,
  fetchReviewFilters,
} from "@/lib/api";
import { getCachedSeoConfig } from "@/lib/server-cache";
import { buildStaticPageMetadata } from "@/lib/static-page-seo";

export const revalidate = 120;

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getCachedSeoConfig();
  return buildStaticPageMetadata("/reviews", seo);
}

export default async function ReviewsPage() {
  const [initialFilters, initialReviews] = await Promise.all([
    fetchReviewFilters({ cached: true, revalidate: 120 }),
    fetchAllReviews(1, ALL_REVIEWS_PAGE_SIZE, undefined, undefined, {
      cached: true,
      revalidate: 120,
    }),
  ]);

  return (
    <ReviewsListingView
      initialFilters={initialFilters}
      initialReviews={initialReviews}
    />
  );
}
