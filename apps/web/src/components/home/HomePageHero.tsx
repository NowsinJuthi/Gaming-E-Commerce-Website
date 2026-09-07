import { preload } from "react-dom";
import { HomeHeroSlider } from "@/components/home/HomeHeroSlider";
import { getCachedCustomerPanelConfig } from "@/lib/server-cache";
import { resolveMediaSrc } from "@/lib/site-appearance";

export async function HomePageHero() {
  const panelConfig = await getCachedCustomerPanelConfig();
  const homepageSlides = (panelConfig.homepageSlides ?? []).filter(
    (slide) => slide.enabled && slide.imageUrl?.trim(),
  );

  const firstHeroImage = homepageSlides[0]?.imageUrl?.trim();
  if (firstHeroImage) {
    preload(resolveMediaSrc(firstHeroImage), {
      as: "image",
      fetchPriority: "high",
    });
  }

  if (homepageSlides.length === 0) return null;

  return <HomeHeroSlider slides={homepageSlides} />;
}
