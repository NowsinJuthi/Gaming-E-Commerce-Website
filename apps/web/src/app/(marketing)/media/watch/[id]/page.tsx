import type { Metadata } from "next";
import { Suspense } from "react";

import { WatchPlayer } from "@/components/media/watch-player";



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

  return (
    <Suspense
      fallback={
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
      }
    >
      <WatchPlayer titleId={id} />
    </Suspense>
  );

}

