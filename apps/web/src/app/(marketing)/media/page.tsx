import type { Metadata } from "next";
import { MediaHome } from "@/components/media/media-home";
import { HOME_CONTAINER_CLS, HOME_PAGE_BG } from "@/components/home/home-container";
import { getMediaHome } from "@/lib/media-home-api";

export const metadata: Metadata = {
  title: "Media",
  description: "Movies and series on UniQbd.",
};

export default async function MediaPage() {
  const home = await getMediaHome();
  return (
    <main className={`pb-8 pt-2 sm:pb-12 sm:pt-4 ${HOME_PAGE_BG}`}>
      <h1 className="sr-only">Media</h1>
      <div className={HOME_CONTAINER_CLS}>
        <MediaHome home={home} />
      </div>
    </main>
  );
}
