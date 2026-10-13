import type { Metadata } from "next";
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
  return <WatchPlayer titleId={id} />;
}
