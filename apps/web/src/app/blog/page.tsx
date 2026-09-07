import type { Metadata } from "next";
import { Suspense } from "react";
import { BlogListingView } from "@/components/blog/BlogListingView";
import { getCachedSeoConfig } from "@/lib/server-cache";
import { buildStaticPageMetadata } from "@/lib/static-page-seo";

export const revalidate = 120;

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getCachedSeoConfig();
  return buildStaticPageMetadata("/blog", seo);
}

export default function BlogIndexPage() {
  return (
    <Suspense fallback={null}>
      <BlogListingView />
    </Suspense>
  );
}
