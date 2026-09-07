"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { SocialMediaUrls } from "@/components/SocialMediaLinks";

const ContactSocialContext = createContext<SocialMediaUrls>({});

export function ContactSocialProvider({
  children,
  facebookUrl = "",
  youtubeUrl = "",
  whatsappUrl = "",
}: SocialMediaUrls & { children: ReactNode }) {
  const value = useMemo(
    () => ({
      facebookUrl: facebookUrl.trim(),
      youtubeUrl: youtubeUrl.trim(),
      whatsappUrl: whatsappUrl.trim(),
    }),
    [facebookUrl, youtubeUrl, whatsappUrl],
  );

  return (
    <ContactSocialContext.Provider value={value}>
      {children}
    </ContactSocialContext.Provider>
  );
}

export function useContactSocial(): SocialMediaUrls {
  return useContext(ContactSocialContext);
}
