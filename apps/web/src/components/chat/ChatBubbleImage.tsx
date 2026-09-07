"use client";

import Image from "next/image";

type Props = {
  src: string;
  onOpen: () => void;
};

export function ChatBubbleImage({ src, onOpen }: Props) {
  return (
    <button
      type="button"
      className="chat-bubble-image-link"
      aria-label="View chat image"
      onClick={onOpen}
    >
      <Image
        src={src}
        alt="Chat attachment"
        width={640}
        height={480}
        className="chat-bubble-image"
        unoptimized
      />
    </button>
  );
}
