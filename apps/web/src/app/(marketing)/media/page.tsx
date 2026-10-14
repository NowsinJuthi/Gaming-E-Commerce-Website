import type { Metadata } from "next";
import { MediaHome } from "@/components/media/media-home";
import { HOME_CONTAINER_CLS, HOME_PAGE_BG } from "@/components/home/home-container";
import { getMediaBootstrap, MEDIA_PAGE_SIZE_MOBILE } from "@/lib/media-home-api";

export const metadata: Metadata = {
  title: "Media",
  description: "Movies and series on UniQbd.",
};

export const revalidate = 30;

export default async function MediaPage() {
  const { home, browse: initialBrowse } = await getMediaBootstrap(MEDIA_PAGE_SIZE_MOBILE);
  return (
    <main
      className={`media-page-root pb-8 pt-2 sm:pb-12 sm:pt-4 ${HOME_PAGE_BG}`}
      data-media-page=""
    >
      <div className={HOME_CONTAINER_CLS}>
        <MediaHome home={home} initialBrowse={initialBrowse} />
      </div>
    </main>
  );
}
