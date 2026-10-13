import type { Metadata } from "next";
import dynamic from "next/dynamic";

/** Browser-only: avoids SSR/client DOM mismatch (React #418) breaking seek and controls. */
const MediaPlayer = dynamic(
  () => import("@/components/media/media-player").then((mod) => mod.MediaPlayer),
  {
    ssr: false,
    loading: () => (
      <section
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 80,
          display: "grid",
          placeItems: "center",
          background: "#000",
          color: "rgb(255 255 255 / 0.86)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        Opening player…
      </section>
    ),
  },
);

export const metadata: Metadata = {
  title: "Watch",
  description: "Watch a movie or series on UniQbd.",
};

export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MediaPlayer titleId={id} />;
}
