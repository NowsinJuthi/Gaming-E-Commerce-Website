"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "@/components/admin/icons";

type Props = {
  src: string | null;
  open: boolean;
  onClose: () => void;
};

export function ChatImagePreview({ src, open, onClose }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!mounted || !open || !src) return null;

  return createPortal(
    <div
      className="chat-image-preview-root"
      role="dialog"
      aria-modal="true"
      aria-label="Chat image preview"
    >
      <button
        type="button"
        className="chat-image-preview-backdrop"
        aria-label="Close image preview"
        onClick={onClose}
      />
      <button
        type="button"
        className="chat-image-preview-close"
        aria-label="Close image"
        onClick={onClose}
      >
        <CloseIcon className="h-6 w-6" aria-hidden />
      </button>
      <div className="chat-image-preview-stage">
        <Image
          src={src}
          alt="Chat attachment preview"
          width={1600}
          height={1200}
          className="chat-image-preview-image"
          unoptimized
        />
      </div>
    </div>,
    document.body,
  );
}
