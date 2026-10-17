"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

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

export function WatchPlayer({ titleId }: { titleId: string }) {
  const search = useSearchParams();
  const rawEpisode = Number(search.get("episode") ?? "0");
  const initialEpisodeIndex =
    Number.isFinite(rawEpisode) && rawEpisode >= 0 ? Math.floor(rawEpisode) : 0;

  return <MediaPlayer titleId={titleId} initialEpisodeIndex={initialEpisodeIndex} />;
}
