import {
  HOME_CONTAINER_CLS,
  HOME_PAGE_BG,
} from "@/components/home/home-container";

export default function MarketingLoading() {
  return (
    <main className={`pb-4 pt-2 sm:pb-8 sm:pt-4 ${HOME_PAGE_BG}`}>
      <div className={`${HOME_CONTAINER_CLS} space-y-6`}>
        <div
          className="home-hero-skeleton aspect-[2.4/1] w-full animate-pulse rounded-2xl bg-border/30"
          aria-hidden
        />
        <div className="space-y-4" aria-busy="true" aria-label="Loading">
          <div className="h-6 w-40 animate-pulse rounded bg-border/40" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl bg-border/25 p-3">
                <div className="aspect-square rounded-lg bg-border/40" />
                <div className="mt-3 h-4 w-3/4 rounded bg-border/40" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
