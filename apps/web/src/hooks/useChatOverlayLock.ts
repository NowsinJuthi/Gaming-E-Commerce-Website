import { useEffect, useRef } from "react";

/** Locks page scroll and syncs iOS/Android keyboard with chat overlay height. */
export function useChatOverlayLock(active: boolean) {
  const scrollYRef = useRef(0);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;

    const root = document.documentElement;
    scrollYRef.current = window.scrollY;

    // Avoid `body { position: fixed }` — it breaks focus/tap on chat inputs (iOS).
    root.classList.add("chat-messenger-open");
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    const vv = window.visualViewport;

    const syncViewport = () => {
      if (!vv) {
        root.style.setProperty("--chat-vvh", "100dvh");
        root.style.setProperty("--chat-vv-top", "0px");
        return;
      }

      root.style.setProperty("--chat-vvh", `${vv.height}px`);
      root.style.setProperty("--chat-vv-top", `${vv.offsetTop}px`);

      const keyboardLikelyOpen = vv.height < window.innerHeight * 0.82;
      root.classList.toggle("chat-keyboard-open", keyboardLikelyOpen);
    };

    syncViewport();
    vv?.addEventListener("resize", syncViewport);
    vv?.addEventListener("scroll", syncViewport);
    window.addEventListener("orientationchange", syncViewport);

    return () => {
      vv?.removeEventListener("resize", syncViewport);
      vv?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("orientationchange", syncViewport);

      root.classList.remove("chat-messenger-open", "chat-keyboard-open");
      root.style.removeProperty("--chat-vvh");
      root.style.removeProperty("--chat-vv-top");
      root.style.overflow = "";
      document.body.style.overflow = "";

      window.scrollTo(0, scrollYRef.current);
    };
  }, [active]);
}
