"use client";

import { useState } from "react";
import { UserIcon } from "@/components/admin/icons";
import { resolveAvatarSrc } from "@/lib/site-appearance";

type BlogAuthorAvatarProps = {
  name: string;
  avatarUrl?: string;
  className?: string;
};

export function BlogAuthorAvatar({
  name,
  avatarUrl,
  className = "",
}: BlogAuthorAvatarProps) {
  const resolved = avatarUrl?.trim() ? resolveAvatarSrc(avatarUrl.trim()) : "";
  const [showPhoto, setShowPhoto] = useState(Boolean(resolved));

  return (
    <span
      className={`blog-post-hero__avatar${
        showPhoto ? " blog-post-hero__avatar--photo" : ""
      } ${className}`.trim()}
      title={name}
    >
      {showPhoto && resolved ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolved}
          alt=""
          className="blog-post-hero__avatar-img"
          loading="lazy"
          decoding="async"
          onError={() => setShowPhoto(false)}
        />
      ) : (
        <span className="blog-post-hero__avatar-fallback" aria-hidden>
          <UserIcon className="blog-post-hero__avatar-icon" />
        </span>
      )}
    </span>
  );
}
