"use client";

import dynamic from "next/dynamic";

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
  return <MediaPlayer titleId={titleId} />;
}
