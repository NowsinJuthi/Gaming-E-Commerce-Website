"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type Hls from "hls.js";
import { API_BASE } from "@/lib/api";
import {
  canSeekWithinCurrentPack,
  displayTimelineSeconds,
  localTimelineSeconds,
} from "@/lib/media-playback-timeline";
import { useLiveMediaWatch } from "@/hooks/useLiveMediaWatch";
import { persistWatchProgress, touchRecentWatched } from "@/lib/media-recent-watched";
import styles from "./media-player.module.css";

/** Bust CDN/browser cache when ffmpeg starts a new pack (Movie Server uses t= + g=). */
function hlsPlaylistSource(playlistUrl: string, startSeconds: number, loadToken: number): string {
  const joiner = playlistUrl.includes("?") ? "&" : "?";
  const path = `${playlistUrl}${joiner}t=${Math.floor(startSeconds)}&v=${loadToken}`;
  if (/^https?:\/\//i.test(path) || typeof window === "undefined") return path;
  return `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;
}

type Quality = "auto" | "1080" | "720" | "480";
type Aspect = "fit" | "fill" | "stretch";
type RepeatMode = "off" | "one" | "all";
type Sheet =
  | "settings"
  | "quality"
  | "speed"
  | "audio"
  | "subtitles"
  | "episodes"
  | "aspect"
  | "repeat"
  | null;
type DockTab = "info" | "chapters" | "cast";
type TitleDetails = {
  posterUrl: string | null;
  overview: string;
  runtimeMinutes: number | null;
  rating: number | null;
  genres: string[];
  directors: string[];
  writers: string[];
  cast: { name: string; profileUrl: string | null }[];
};

type PlaybackSession = {
  sessionId: string;
  status: "preparing" | "ready" | "error";
  message: string;
  playlistUrl: string;
  title: string;
  year: number;
  kind: "movie" | "series";
  episodeName: string | null;
  durationSeconds: number;
  startSeconds: number;
  quality: Quality;
  audioIndex: number;
  episodeIndex: number;
  complete: boolean;
  progress: number | null;
  episodes: { index: number; name: string }[];
  audioTracks: { index: number; label: string }[];
  subtitles: { index: number; label: string; url: string }[];
};

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const QUALITIES: { id: Quality; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "1080", label: "1080p" },
  { id: "720", label: "720p" },
  { id: "480", label: "480p" },
];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function errorMessage(data: { message?: string | string[] } | null, fallback: string): string {
  if (Array.isArray(data?.message)) return data.message.join(" ");
  if (typeof data?.message === "string" && data.message) return data.message;
  return fallback;
}

function unlockPlaybackOrientation() {
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* iOS Safari does not allow unlock. */
  }
}

async function lockPlaybackLandscape() {
  const type = screen.orientation?.type ?? "";
  if (type.startsWith("portrait")) return;
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (mode: string) => Promise<void>;
  };
  await orientation.lock?.("landscape").catch(() => undefined);
}

/** iPhone/iPad play native HLS. Android uses the same direct stream as desktop. */
function isPhonePlayback(): boolean {
  if (typeof window === "undefined") return false;
  return appleMobile();
}

function appleMobile(): boolean {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function nativeHls(video: HTMLVideoElement): boolean {
  if (appleMobile()) return true;
  const safari = /Safari/i.test(navigator.userAgent) && !/Chrome|Chromium|Edg|OPR|Android/i.test(navigator.userAgent);
  return safari && video.canPlayType("application/vnd.apple.mpegurl") !== "";
}

function volumeReadOnly(): boolean {
  const probe = document.createElement("video");
  const before = probe.volume;
  try {
    probe.volume = before === 0.5 ? 0.25 : 0.5;
  } catch {
    return true;
  }
  return probe.volume === before;
}

/** 0 at the start of the bar, 1 at the end, including a CSS-rotated phone player. */
function sliderRatioFromClient(el: HTMLElement, clientX: number, clientY: number): number {
  let angle = 0;
  if (typeof DOMMatrixReadOnly === "function") {
    for (let node: HTMLElement | null = el; node; node = node.parentElement) {
      const transform = window.getComputedStyle(node).transform;
      if (!transform || transform === "none") continue;
      try {
        const matrix = new DOMMatrixReadOnly(transform);
        angle += Math.atan2(matrix.b, matrix.a);
      } catch {
        /* ignore a transform the browser cannot parse */
      }
    }
  }
  const rect = el.getBoundingClientRect();
  const dx = clientX - (rect.left + rect.width / 2);
  const dy = clientY - (rect.top + rect.height / 2);
  const localX = dx * Math.cos(-angle) - dy * Math.sin(-angle);
  const width = el.offsetWidth || 1;
  return Math.min(1, Math.max(0, localX / width + 0.5));
}

function applyVideoSeek(video: HTMLVideoElement, target: number) {
  video.currentTime = target;
}

function SeekTrack({
  value,
  max,
  teal = false,
  onScrub,
  onCommit,
}: {
  value: number;
  max: number;
  teal?: boolean;
  onScrub: (seconds: number) => void;
  onCommit: (ratio: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragId = useRef<number | null>(null);
  const previewRatioRef = useRef<number | null>(null);
  const onScrubRef = useRef(onScrub);
  const onCommitRef = useRef(onCommit);
  const [dragging, setDragging] = useState(false);
  onScrubRef.current = onScrub;
  onCommitRef.current = onCommit;
  const limit = Math.max(max, 1);
  const ratio = Math.min(1, Math.max(0, value / limit));

  const endScrub = useCallback(() => {
    const finalRatio = previewRatioRef.current;
    dragId.current = null;
    previewRatioRef.current = null;
    setDragging(false);
    if (finalRatio != null) onCommitRef.current(finalRatio);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: PointerEvent) => {
      if (dragId.current == null || event.pointerId !== dragId.current) return;
      const el = trackRef.current;
      if (!el) return;
      const ratio = sliderRatioFromClient(el, event.clientX, event.clientY);
      previewRatioRef.current = ratio;
      onScrubRef.current(Math.round(ratio * Math.max(max, 1)));
    };
    const onUp = (event: PointerEvent) => {
      if (dragId.current == null || event.pointerId !== dragId.current) return;
      event.preventDefault();
      event.stopPropagation();
      endScrub();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, endScrub, max]);

  function pointAt(clientX: number, clientY: number) {
    const el = trackRef.current;
    if (!el) return;
    const ratio = sliderRatioFromClient(el, clientX, clientY);
    previewRatioRef.current = ratio;
    onScrubRef.current(Math.round(ratio * Math.max(max, 1)));
  }

  return (
    <div
      ref={trackRef}
      className={`${styles.seekTrack} ${teal ? styles.seekTrackTeal : ""}`}
      role="slider"
      tabIndex={-1}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.floor(limit)}
      aria-valuenow={Math.min(Math.floor(value), Math.floor(limit))}
      dir="ltr"
      style={{ "--seek": `${ratio * 100}%` } as React.CSSProperties}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        dragId.current = event.pointerId;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          /* window listeners still follow the pointer */
        }
        pointAt(event.clientX, event.clientY);
        setDragging(true);
      }}
      onPointerMove={(event) => {
        if (dragId.current !== event.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        pointAt(event.clientX, event.clientY);
      }}
      onPointerUp={(event) => {
        if (dragId.current !== event.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        endScrub();
      }}
      onPointerCancel={(event) => {
        if (dragId.current !== event.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        endScrub();
      }}
      onLostPointerCapture={() => {
        if (dragId.current != null) endScrub();
      }}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 30 : 5;
        if (event.key === "ArrowRight" || event.key === "ArrowUp") {
          event.preventDefault();
          event.stopPropagation();
          onCommit(Math.min(1, (value + step) / limit));
        } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
          event.preventDefault();
          event.stopPropagation();
          onCommit(Math.max(0, (value - step) / limit));
        }
      }}
    >
      <div className={styles.seekTrackBar}>
        <div className={styles.seekTrackFill} />
      </div>
      <div className={styles.seekTrackThumb} />
    </div>
  );
}

function Icon({ d, filled = false }: { d: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={filled ? styles.filled : undefined}>
      <path d={d} fill={filled ? "currentColor" : "none"} stroke={filled ? "none" : "currentColor"} />
    </svg>
  );
}

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

function CaptionsIcon() {
  return (
    <Glyph>
      <rect width="18" height="14" x="3" y="5" rx="2" ry="2" />
      <path d="M7 15h4M15 15h2M7 11h2M13 11h4" />
    </Glyph>
  );
}

function AudioLinesIcon() {
  return (
    <Glyph>
      <path d="M2 10v3" />
      <path d="M6 6v11" />
      <path d="M10 3v18" />
      <path d="M14 8v7" />
      <path d="M18 5v13" />
      <path d="M22 10v3" />
    </Glyph>
  );
}

function GaugeIcon() {
  return (
    <Glyph>
      <path d="m12 14 4-4" />
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </Glyph>
  );
}

function SettingsIcon() {
  return (
    <Glyph>
      <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
      <circle cx="12" cy="12" r="3" />
    </Glyph>
  );
}

function Volume2Icon() {
  return (
    <Glyph>
      <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />
      <path d="M16 9a5 5 0 0 1 0 6" />
      <path d="M19.364 18.364a9 9 0 0 0 0-12.728" />
    </Glyph>
  );
}

function VolumeXIcon() {
  return (
    <Glyph>
      <path d="M11 4.702a.7.7 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.7.7 0 0 0 11 19.298z" />
      <path d="m16.5 14.5 5-5" />
      <path d="m16.5 9.5 5 5" />
    </Glyph>
  );
}

function CastIcon() {
  return (
    <Glyph>
      <path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
      <path d="M2 12a9 9 0 0 1 8 8" />
      <path d="M2 16a5 5 0 0 1 4 4" />
      <path d="M2 20h.01" />
    </Glyph>
  );
}

function PipIcon() {
  return (
    <Glyph>
      <path d="M21 9V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h4" />
      <rect width="10" height="7" x="12" y="13" rx="2" />
    </Glyph>
  );
}

function MaximizeIcon() {
  return (
    <Glyph>
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </Glyph>
  );
}

function MinimizeIcon() {
  return (
    <Glyph>
      <path d="M8 3v3a2 2 0 0 1-2 2H3" />
      <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
      <path d="M3 16h3a2 2 0 0 1 2 2v3" />
      <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
    </Glyph>
  );
}

function PlaySpinner() {
  return (
    <svg className={styles.playSpin} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
    </svg>
  );
}

function BusyMark({ buffering }: { buffering: boolean }) {
  return (
    <div className={`${styles.mark} ${buffering ? styles.markSmall : ""}`} aria-hidden="true">
      <span className={styles.glow} />
      <svg className={styles.rings} viewBox="0 0 80 80">
        <circle className={styles.track} cx="40" cy="40" r="34" />
        <circle className={styles.arc} cx="40" cy="40" r="34" />
        <circle className={styles.arcInner} cx="40" cy="40" r="26" />
      </svg>
      <span className={styles.core}>
        <Icon d="M8 5v14l11-7z" filled />
      </span>
    </div>
  );
}

export function MediaPlayer({ titleId }: { titleId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const sessionRef = useRef<PlaybackSession | null>(null);
  const hideTimer = useRef<number | null>(null);
  const lastTap = useRef<{ zone: string; at: number } | null>(null);
  const zoneTimer = useRef<number | null>(null);
  const skipAt = useRef<number | null>(null);
  const seekingRef = useRef(false);
  const pendingSeekRef = useRef<number | null>(null);
  const originRef = useRef(0);
  const packRestartRef = useRef(false);
  const scrubbingRef = useRef(false);
  const seekLockRef = useRef(false);
  const loadTokenRef = useRef(0);
  const attachSeqRef = useRef(0);
  const attachedPackRef = useRef("");
  const rateRef = useRef(1);
  const durationHintRef = useRef(0);
  const [session, setSession] = useState<PlaybackSession | null>(null);
  useLiveMediaWatch({
    active: session?.status === "ready",
    titleId,
    titleName: session?.title ?? "Media",
    episodeName: session?.episodeName,
  });
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [holdFrame, setHoldFrame] = useState<string | null>(null);
  const captureHoldRef = useRef<() => void>(() => undefined);
  captureHoldRef.current = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth < 2) return;
    try {
      const canvas = document.createElement("canvas");
      const width = Math.min(video.videoWidth, 960);
      const height = Math.max(1, Math.round((width * video.videoHeight) / video.videoWidth));
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(video, 0, 0, width, height);
      setHoldFrame(canvas.toDataURL("image/jpeg", 0.72));
    } catch {
      /* frame not readable yet */
    }
  };
  const [starting, setStarting] = useState(false);
  const startTimer = useRef<number | null>(null);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  scrubbingRef.current = scrub !== null;
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [rate, setRate] = useState(1);
  rateRef.current = rate;
  const [chrome, setChrome] = useState(true);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [aspect, setAspect] = useState<Aspect>("fit");
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [subtitleIndex, setSubtitleIndex] = useState<number | null>(null);
  const [dock, setDock] = useState<DockTab | null>(null);
  const [details, setDetails] = useState<TitleDetails | null>(null);
  const [locked, setLocked] = useState(false);
  const statsOn = false;
  const [notice, setNotice] = useState("");
  const [skipFlash, setSkipFlash] = useState<"back" | "forward" | null>(null);
  const [mobile, setMobile] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const mobileRef = useRef(false);
  mobileRef.current = mobile;
  const [pipOn, setPipOn] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const [volumeLocked, setVolumeLocked] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const repeatRef = useRef(repeat);
  const subtitleRef = useRef(subtitleIndex);
  repeatRef.current = repeat;
  subtitleRef.current = subtitleIndex;
  sessionRef.current = session;
  if (session?.durationSeconds && session.durationSeconds > 0) {
    durationHintRef.current = session.durationSeconds;
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/media/titles/${titleId}`)
      .then((response) => (response.ok ? (response.json() as Promise<TitleDetails>) : null))
      .then((data) => {
        if (!cancelled) setDetails(data);
      })
      .catch(() => {
        if (!cancelled) setDetails(null);
      });
    return () => {
      cancelled = true;
    };
  }, [titleId]);

  const reveal = useCallback(() => {
    setChrome(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      const video = videoRef.current;
      if (video && !video.paused) setChrome(false);
    }, 3200);
  }, []);

  const remember = useCallback(
    (seconds: number) => {
      const durationSeconds =
        durationHintRef.current ||
        sessionRef.current?.durationSeconds ||
        (details?.runtimeMinutes ? details.runtimeMinutes * 60 : 0);
      if (seconds > 8) {
        persistWatchProgress(titleId, seconds, durationSeconds);
        touchRecentWatched(titleId);
      }
    },
    [details?.runtimeMinutes, titleId],
  );

  const post = useCallback(async (url: string, body: Record<string, unknown>) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as PlaybackSession & { message?: string | string[] } | null;
    if (!res.ok || !data || !("sessionId" in data)) {
      throw new Error(errorMessage(data, "Playback could not start."));
    }
    return data;
  }, []);

  /** Stop segment requests before API clears the pack (seek/retarget would otherwise 404 old seg*.m2ts). */
  const stopActivePlayback = useCallback(() => {
    attachSeqRef.current += 1;
    const hls = hlsRef.current;
    if (hls) {
      try {
        hls.stopLoad();
      } catch {
        /* destroyed */
      }
      hls.destroy();
    }
    hlsRef.current = null;
    const video = videoRef.current;
    if (video) {
      captureHoldRef.current();
      video.pause();
      video.removeAttribute("src");
      if (!isPhonePlayback()) video.load();
    }
  }, []);

  const attachPlaybackPack = useCallback(async (pack: PlaybackSession): Promise<void> => {
    const video = videoRef.current;
    if (!video) throw new Error("Playback failed.");
    if (pack.status !== "ready") throw new Error("Playback is still preparing.");
    const seq = ++attachSeqRef.current;
    const packStart = pack.startSeconds;
    const loadToken = ++loadTokenRef.current;
    const playbackUrl = isPhonePlayback()
      ? pack.playlistUrl.replace(/\/media\.mp4(?=$|\?)/i, "/index.m3u8")
      : pack.playlistUrl;
    const playlist = hlsPlaylistSource(playbackUrl, packStart, loadToken);

    hlsRef.current?.destroy();
    hlsRef.current = null;
    captureHoldRef.current();
    video.removeAttribute("src");
    const phone = isPhonePlayback();
    if (!phone) video.load();

    originRef.current = packStart;
    packRestartRef.current = true;

    const finishAttach = () => {
      if (seq !== attachSeqRef.current) return;
      video.currentTime = 0.001;
      setCurrent(packStart);
      seekingRef.current = false;
      setBuffering(false);
      video.playbackRate = rateRef.current;
      void video.play().then(() => setNeedsGesture(false)).catch(() => setNeedsGesture(true));
    };

    const waitForAttach = (bind: (resolve: () => void, reject: (error: Error) => void) => void) =>
      new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (fn: () => void) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          fn();
        };
        const timer = window.setTimeout(
          () => finish(() => reject(new Error("Playback timed out. Try again."))),
          90_000,
        );
        bind(
          () => finish(resolve),
          (error) => finish(() => reject(error)),
        );
      });

    const progressive = /\/media\.mp4(?:\?|$)/i.test(playlist);
    if (progressive || nativeHls(video)) {
      await waitForAttach((resolve, reject) => {
        const onMeta = () => {
          video.removeEventListener("loadedmetadata", onMeta);
          if (seq !== attachSeqRef.current) {
            reject(new Error("Playback cancelled."));
            return;
          }
          finishAttach();
          resolve();
        };
        let armed = false;
        video.addEventListener("loadedmetadata", onMeta);
        video.addEventListener("error", () => {
          if (!armed) return;
          reject(new Error("Playback failed."));
        });
        video.src = playlist;
        armed = true;
        video.load();
      });
      return;
    }

    const mod = await import("hls.js");
    if (seq !== attachSeqRef.current) throw new Error("Playback cancelled.");
    if (!mod.default.isSupported()) {
      await waitForAttach((resolve, reject) => {
        const onMeta = () => {
          video.removeEventListener("loadedmetadata", onMeta);
          if (seq !== attachSeqRef.current) {
            reject(new Error("Playback cancelled."));
            return;
          }
          finishAttach();
          resolve();
        };
        let armed = false;
        video.addEventListener("loadedmetadata", onMeta);
        video.addEventListener("error", () => {
          if (!armed) return;
          reject(new Error("Playback failed."));
        });
        video.src = playlist;
        armed = true;
        video.load();
      });
      return;
    }

    const hls = new mod.default({
      enableWorker: true,
      lowLatencyMode: false,
      autoStartLoad: false,
      liveDurationInfinity: false,
      startPosition: 0.001,
      liveSyncDurationCount: 1,
      liveMaxLatencyDurationCount: 10,
      initialLiveManifestSize: 1,
      maxLiveSyncPlaybackRate: 1,
      maxBufferSize: 400_000_000,
      backBufferLength: 180,
      maxBufferLength: 60,
      maxMaxBufferLength: 180,
      maxBufferHole: 0.5,
      nudgeOffset: 0.2,
      nudgeMaxRetry: 4,
      startFragPrefetch: false,
    });
    hlsRef.current = hls;
    hls.attachMedia(video);
    hls.loadSource(playlist);

    await waitForAttach((resolve, reject) => {
      let fatalRetries = 0;
      hls.on(mod.default.Events.MANIFEST_PARSED, () => {
        if (seq !== attachSeqRef.current) {
          reject(new Error("Playback cancelled."));
          return;
        }
        hls.startLoad(0.001);
        finishAttach();
        resolve();
      });
      hls.on(mod.default.Events.ERROR, (_event, data) => {
        if (!data.fatal || seq !== attachSeqRef.current) return;
        if (data.type === mod.default.ErrorTypes.NETWORK_ERROR && fatalRetries < 6) {
          fatalRetries += 1;
          hls.startLoad(0.001);
          return;
        }
        if (data.type === mod.default.ErrorTypes.MEDIA_ERROR && fatalRetries < 4) {
          fatalRetries += 1;
          hls.recoverMediaError();
          return;
        }
        reject(new Error("Playback stopped. Try again."));
      });
    });
  }, []);

  const waitForSessionReady = useCallback(async (sessionId: string): Promise<PlaybackSession> => {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const res = await fetch(`${API_BASE}/media/playback/sessions/${sessionId}`);
      const data = (await res.json().catch(() => null)) as PlaybackSession | null;
      if (!res.ok || !data) throw new Error("Seek failed.");
      if (data.status === "error") throw new Error(data.message || "Seek failed.");
      if (data.status === "ready") return data;
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    }
    throw new Error("Seek timed out. Try again.");
  }, []);

  const retarget = useCallback(
    async (patch: Record<string, unknown>) => {
      const currentSession = sessionRef.current;
      if (!currentSession) return;
      setError("");
      setBuffering(true);
      seekLockRef.current = true;
      attachedPackRef.current = "";
      stopActivePlayback();
      try {
        const next = await post(`${API_BASE}/media/playback/sessions/${currentSession.sessionId}`, {
          startSeconds: patch.startSeconds ?? currentSession.startSeconds,
          episodeIndex: patch.episodeIndex ?? currentSession.episodeIndex,
          audioIndex: patch.audioIndex ?? currentSession.audioIndex,
          quality: patch.quality ?? currentSession.quality,
        });
        setSession(next);
        const ready = next.status === "ready" ? next : await waitForSessionReady(currentSession.sessionId);
        await attachPlaybackPack(ready);
        attachedPackRef.current = `${ready.sessionId}:${ready.startSeconds}`;
        originRef.current = ready.startSeconds;
        setCurrent(ready.startSeconds);
        setSession(ready);
      } catch (reason) {
        attachedPackRef.current = "";
        setError(reason instanceof Error ? reason.message : "Playback could not restart.");
      } finally {
        seekLockRef.current = false;
        setBuffering(false);
      }
    },
    [attachPlaybackPack, post, stopActivePlayback, waitForSessionReady],
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px), (hover: none) and (pointer: coarse)");
    const sync = () => setMobile(media.matches);
    sync();
    setVolumeLocked(volumeReadOnly());
    setPipSupported(document.pictureInPictureEnabled || appleMobile());
    media.addEventListener("change", sync);
    const portraitMedia = window.matchMedia("(orientation: portrait)");
    const syncPortrait = () => setPortrait(portraitMedia.matches);
    syncPortrait();
    portraitMedia.addEventListener("change", syncPortrait);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.classList.add("media-player-open");
    return () => {
      media.removeEventListener("change", sync);
      portraitMedia.removeEventListener("change", syncPortrait);
      document.body.style.overflow = previous;
      document.documentElement.classList.remove("media-player-open");
      unlockPlaybackOrientation();
    };
  }, []);

  useEffect(() => {
    let stop = false;
    const saved = Number(localStorage.getItem(`uniqbd-watch:${titleId}`) || 0);
    void post(`${API_BASE}/media/playback/${titleId}`, {
      startSeconds: saved > 15 ? saved : 0,
    })
      .then((next) => {
        if (!stop) {
          setSession(next);
          touchRecentWatched(titleId);
        }
      })
      .catch((reason: unknown) => {
        if (!stop) setError(reason instanceof Error ? reason.message : "Playback could not start.");
      });
    return () => {
      stop = true;
    };
  }, [post, titleId]);

  useEffect(() => {
    if (!session?.sessionId || session.status === "error") return;
    const timer = window.setInterval(() => {
      void fetch(`${API_BASE}/media/playback/sessions/${session.sessionId}`)
        .then(async (res) => {
          const data = (await res.json().catch(() => null)) as PlaybackSession | null;
          if (!res.ok || !data) return;
          setSession((previous) => {
            if (seekLockRef.current) return previous ?? data;
            if (!previous || previous.sessionId !== data.sessionId) return data;
            if (previous.status === "ready" && data.status === "ready" && previous.startSeconds === data.startSeconds) {
              const sameSubtitles = JSON.stringify(previous.subtitles) === JSON.stringify(data.subtitles);
              const sameDuration = previous.durationSeconds === data.durationSeconds;
              if (
                sameSubtitles &&
                sameDuration &&
                previous.complete === data.complete &&
                previous.message === data.message
              ) {
                return previous;
              }
              return {
                ...previous,
                subtitles: data.subtitles,
                complete: data.complete,
                message: data.message,
                durationSeconds: data.durationSeconds || previous.durationSeconds,
              };
            }
            return data;
          });
          if (data.status === "error") setError(data.message || "The video could not be opened.");
        })
        .catch(() => undefined);
    }, session.status === "ready" ? 5000 : 1000);
    return () => window.clearInterval(timer);
  }, [session?.sessionId, session?.status]);

  useEffect(() => {
    if (!session || session.status !== "ready") return;
    if (seekLockRef.current) return;
    const packKey = `${session.sessionId}:${session.startSeconds}`;
    if (attachedPackRef.current === packKey) return;
    attachedPackRef.current = packKey;
    void attachPlaybackPack(session).catch((reason: unknown) => {
      attachedPackRef.current = "";
      setError(reason instanceof Error ? reason.message : "Playback failed.");
      setBuffering(false);
      seekingRef.current = false;
    });
  }, [attachPlaybackPack, session?.sessionId, session?.status, session?.startSeconds]);

  useEffect(() => {
    return () => {
      attachSeqRef.current += 1;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      const video = videoRef.current;
      if (video) {
        video.removeAttribute("src");
        video.load();
      }
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => {
      if (scrubbingRef.current || video.seeking || seekingRef.current) return;
      if (packRestartRef.current && video.currentTime < 1.25) return;
      if (packRestartRef.current) packRestartRef.current = false;
      const origin = originRef.current;
      const movie = sessionRef.current?.durationSeconds ?? 0;
      const mediaTime = displayTimelineSeconds(video.currentTime, origin, movie);
      setCurrent(mediaTime);
      const snap = sessionRef.current;
      const known = snap?.durationSeconds ?? 0;
      const packComplete = snap?.complete ?? false;
      let nextDuration = known;
      if (nextDuration <= 0) {
        const fromMedia = origin + (Number.isFinite(video.duration) ? video.duration : 0);
        if (fromMedia > 0 && packComplete) nextDuration = fromMedia;
      }
      if (nextDuration > 0) durationHintRef.current = nextDuration;
      setDuration(nextDuration);
    };
    const onPlay = () => {
      setPlaying(true);
      reveal();
      if (mobileRef.current) setImmersive(true);
    };
    const onPause = () => {
      setPlaying(false);
      setBuffering(false);
      if (startTimer.current) window.clearTimeout(startTimer.current);
      startTimer.current = null;
      setStarting(false);
    };
    const onWaiting = () => {
      captureHoldRef.current();
      setBuffering(true);
    };
    const onPlaying = () => {
      seekingRef.current = false;
      setBuffering(false);
      setHoldFrame(null);
    };
    const onEnded = () => {
      const currentSession = sessionRef.current;
      if (!currentSession) return;
      if (repeatRef.current === "one") {
        video.currentTime = 0;
        void video.play().catch(() => undefined);
        return;
      }
      const next = currentSession.episodes.find((episode) => episode.index === currentSession.episodeIndex + 1);
      if (repeatRef.current === "all" && next) {
        void retarget({ episodeIndex: next.index, startSeconds: 0, audioIndex: 0 });
        return;
      }
      if (repeatRef.current === "all") {
        void retarget({ episodeIndex: 0, startSeconds: 0 });
      }
    };
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("ended", onEnded);
    };
  }, [retarget, reveal]);

  useEffect(() => {
    if (session?.durationSeconds && session.durationSeconds > 0) {
      durationHintRef.current = session.durationSeconds;
      setDuration(session.durationSeconds);
    }
  }, [session?.durationSeconds]);

  useEffect(() => () => {
    if (startTimer.current) window.clearTimeout(startTimer.current);
    if (zoneTimer.current) window.clearTimeout(zoneTimer.current);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => remember(current), 5000);
    return () => window.clearInterval(timer);
  }, [current, remember]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !session) return;
    for (const track of session.subtitles) {
      const existing = [...video.querySelectorAll("track")].find((item) => item.getAttribute("data-index") === String(track.index));
      if (existing) continue;
      const element = document.createElement("track");
      element.kind = "subtitles";
      element.src = track.url;
      element.label = track.label;
      element.srclang = "und";
      element.dataset.index = String(track.index);
      video.appendChild(element);
    }
    const tracks = video.textTracks;
    for (let index = 0; index < tracks.length; index += 1) {
      const track = tracks[index];
      if (!track) continue;
      const match = session.subtitles.find((item) => item.label === track.label);
      track.mode = match && match.index === subtitleIndex ? "showing" : "disabled";
    }
  }, [session, subtitleIndex]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.closest("[role='slider']"))) return;
      if (event.key === " " || event.key.toLowerCase() === "k") {
        event.preventDefault();
        togglePlay();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        skip(-10);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        skip(10);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        changeVolume(Math.min(1, volume + 0.05));
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        changeVolume(Math.max(0, volume - 0.05));
      } else if (event.key.toLowerCase() === "m") {
        toggleMute();
      } else if (event.key.toLowerCase() === "f") {
        void toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (startTimer.current) window.clearTimeout(startTimer.current);
      setStarting(true);
      startTimer.current = window.setTimeout(() => {
        startTimer.current = null;
        setStarting(false);
      }, 700);
      void video.play().then(() => setNeedsGesture(false)).catch(() => {
        setNeedsGesture(true);
        if (startTimer.current) window.clearTimeout(startTimer.current);
        startTimer.current = null;
        setStarting(false);
      });
    } else {
      if (startTimer.current) window.clearTimeout(startTimer.current);
      startTimer.current = null;
      setStarting(false);
      video.pause();
    }
    reveal();
  }

  function changeVolume(next: number) {
    const video = videoRef.current;
    if (!video || volumeLocked) return;
    video.volume = next;
    video.muted = next === 0;
    setVolume(next);
    setMuted(next === 0);
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video || volumeLocked) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }

  function skip(delta: number) {
    const video = videoRef.current;
    const currentSession = sessionRef.current;
    if (!video || !currentSession) return;
    setSkipFlash(delta < 0 ? "back" : "forward");
    window.setTimeout(() => setSkipFlash(null), 700);
    const movieLen = currentSession.durationSeconds;
    const display =
      skipAt.current ??
      displayTimelineSeconds(video.currentTime, originRef.current, movieLen);
    const movie = currentSession.durationSeconds;
    let next = Math.max(0, display + delta);
    if (movie > 0) next = Math.min(movie, next);
    skipAt.current = next;
    window.setTimeout(() => {
      if (skipAt.current === next) skipAt.current = null;
    }, 500);
    void seekTo(next);
    reveal();
  }

  async function restartPlaybackAt(absolute: number, beforeSeek: number, previousOrigin: number) {
    const currentSession = sessionRef.current;
    if (!currentSession) return;
    const target = Math.round(absolute);
    seekLockRef.current = true;
    seekingRef.current = true;
    pendingSeekRef.current = null;
    setBuffering(true);
    packRestartRef.current = true;
    attachedPackRef.current = "";
    stopActivePlayback();
    originRef.current = target;
    remember(target);
    setCurrent(target);
    let queued: number | null = null;
    try {
      const next = await post(`${API_BASE}/media/playback/sessions/${currentSession.sessionId}`, {
        startSeconds: target,
        episodeIndex: currentSession.episodeIndex,
        audioIndex: currentSession.audioIndex,
        quality: currentSession.quality,
      });
      setSession(next);
      const ready = next.status === "ready" ? next : await waitForSessionReady(currentSession.sessionId);
      await attachPlaybackPack(ready);
      attachedPackRef.current = `${ready.sessionId}:${ready.startSeconds}`;
      originRef.current = ready.startSeconds;
      setCurrent(ready.startSeconds);
      setSession(ready);
    } catch (reason) {
      attachedPackRef.current = "";
      packRestartRef.current = false;
      originRef.current = previousOrigin;
      setCurrent(beforeSeek);
      setError(reason instanceof Error ? reason.message : "Could not seek.");
      try {
        const res = await fetch(`${API_BASE}/media/playback/sessions/${currentSession.sessionId}`);
        const data = (await res.json().catch(() => null)) as PlaybackSession | null;
        if (res.ok && data?.status === "ready") setSession(data);
      } catch {
        /* keep error state */
      }
    } finally {
      seekLockRef.current = false;
      seekingRef.current = false;
      setBuffering(false);
      queued = pendingSeekRef.current;
      pendingSeekRef.current = null;
    }
    if (queued != null) void seekTo(queued);
  }

  async function seekTo(target: number) {
    const video = videoRef.current;
    const currentSession = sessionRef.current;
    if (!video || !currentSession || currentSession.status !== "ready") return;
    const movie = durationHintRef.current || currentSession.durationSeconds;
    let absolute = movie > 0 ? Math.min(Math.max(0, target), movie) : Math.max(0, target);
    absolute = Math.round(absolute);
    if (seekingRef.current) {
      pendingSeekRef.current = absolute;
      setCurrent(absolute);
      return;
    }
    const origin = originRef.current;
    const beforeSeek = displayTimelineSeconds(video.currentTime, origin, movie);
    const previousOrigin = origin;
    const localTarget = localTimelineSeconds(absolute, origin);
    const targetIsInCurrentPack = absolute >= origin - 0.35;

    setCurrent(absolute);
    remember(absolute);

    const packComplete = currentSession.complete;
    if (
      targetIsInCurrentPack &&
      canSeekWithinCurrentPack(video, localTarget, packComplete)
    ) {
      applyVideoSeek(video, localTarget);
      setCurrent(absolute);
      return;
    }

    await restartPlaybackAt(absolute, beforeSeek, previousOrigin);
  }

  useEffect(() => {
    if (!immersive) {
      unlockPlaybackOrientation();
      return;
    }
    if (!portrait) void lockPlaybackLandscape();
  }, [immersive, portrait]);

  async function toggleFullscreen() {
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    const shell = video?.parentElement;
    if (!video || !shell) return;
    if (mobile) {
      if (immersive) {
        setImmersive(false);
        unlockPlaybackOrientation();
        return;
      }
      setImmersive(true);
      await lockPlaybackLandscape();
      return;
    }
    if (document.fullscreenElement) await document.exitFullscreen();
    else await shell.requestFullscreen();
  }

  async function togglePip() {
    const video = videoRef.current as (HTMLVideoElement & {
      webkitSetPresentationMode?: (mode: string) => void;
      webkitPresentationMode?: string;
    }) | null;
    if (!video) return;
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      setPipOn(false);
      return;
    }
    if (video.requestPictureInPicture) {
      await video.requestPictureInPicture();
      setPipOn(true);
      return;
    }
    if (video.webkitSetPresentationMode) {
      const next = video.webkitPresentationMode === "picture-in-picture" ? "inline" : "picture-in-picture";
      video.webkitSetPresentationMode(next);
      setPipOn(next === "picture-in-picture");
      return;
    }
    setNotice("Picture in picture is not available in this browser.");
    window.setTimeout(() => setNotice(""), 2800);
  }

  function cast() {
    const video = videoRef.current as (HTMLVideoElement & { webkitShowPlaybackTargetPicker?: () => void }) | null;
    if (video?.webkitShowPlaybackTargetPicker) {
      video.webkitShowPlaybackTargetPicker();
      return;
    }
    setNotice("Cast is not available in this browser. On iPhone, use AirPlay from fullscreen.");
    window.setTimeout(() => setNotice(""), 2800);
  }

  function onZone(zone: "left" | "middle" | "right") {
    const now = Date.now();
    const previous = lastTap.current;
    lastTap.current = { zone, at: now };
    if (zone === "left" || zone === "right") {
      if (previous && previous.zone === zone && now - previous.at < 450) {
        if (zoneTimer.current) window.clearTimeout(zoneTimer.current);
        zoneTimer.current = null;
        skip(zone === "left" ? -10 : 10);
        return;
      }
      if (zoneTimer.current) window.clearTimeout(zoneTimer.current);
      zoneTimer.current = window.setTimeout(() => {
        zoneTimer.current = null;
        if (needsGesture) togglePlay();
        else setChrome((value) => !value);
      }, 450);
      return;
    }
    if (zoneTimer.current) window.clearTimeout(zoneTimer.current);
    zoneTimer.current = null;
    if (needsGesture) togglePlay();
    else setChrome((value) => !value);
  }

  function onShellPointerUp(event: React.PointerEvent<HTMLElement>) {
    if (!mobile || locked || sheet) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("a, input, textarea, select")) return;
    const control = target?.closest("button");
    const skinClass = styles.skin ?? "";
    const zoneClass = styles.tapZones ?? "";
    const inTapZone = zoneClass.length > 0 && Boolean(control?.closest(`.${zoneClass}`));
    if (control && !control.classList.contains(skinClass) && !inTapZone) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width < 8) return;
    const x = (event.clientX - rect.left) / rect.width;
    onZone(x < 0.3 ? "left" : x > 0.7 ? "right" : "middle");
  }

  const shown = scrub ?? current;

  function commitSeek(ratio: number) {
    setScrub(null);
    skipAt.current = null;
    const movie = durationHintRef.current || sessionRef.current?.durationSeconds || duration;
    if (movie <= 0) return;
    const clamped = Math.min(1, Math.max(0, ratio));
    void seekTo(Math.round(movie * clamped));
    reveal();
  }

  const preparing = !error && session?.status !== "ready";
  const playBusy = !error && (preparing || buffering || starting);
  const subtitleLabel = session?.subtitles.find((track) => track.index === subtitleIndex)?.label ?? "Off";
  const audioLabel = session?.audioTracks.find((track) => track.index === session.audioIndex)?.label ?? "Default";
  const qualityLabel = QUALITIES.find((item) => item.id === session?.quality)?.label ?? "Auto";

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  return (
    <section
      className={`${styles.shell} ${immersive && portrait ? styles.landscapeEmulate : ""}`}
      tabIndex={-1}
      onMouseMove={() => {
        if (!locked) reveal();
      }}
      onPointerUp={onShellPointerUp}
    >
      <video
        ref={videoRef}
        className={`${styles.video} ${aspect === "fill" ? styles.videoFill : ""} ${aspect === "stretch" ? styles.videoStretch : ""}`}
        playsInline
        preload="auto"
        controlsList="nodownload"
        {...({ "webkit-playsinline": "true", "x-webkit-airplay": "allow" } as Record<string, string>)}
      />
      {(preparing || buffering) && !error && holdFrame ? (
        <img
          className={`${styles.hold} ${styles.holdFrame} ${aspect === "fill" ? styles.videoFill : ""} ${aspect === "stretch" ? styles.videoStretch : ""}`}
          src={holdFrame}
          alt=""
        />
      ) : null}

      {mobile && !locked ? (
        <div className={styles.tapZones}>
          <button type="button" className={styles.side} aria-label="Rewind 10 seconds" tabIndex={-1} />
          <button type="button" className={styles.middle} aria-label="Show controls" tabIndex={-1} />
          <button type="button" className={styles.side} aria-label="Forward 10 seconds" tabIndex={-1} />
        </div>
      ) : null}

      {skipFlash ? <div className={`${styles.skipFlash} ${skipFlash === "back" ? styles.skipLeft : styles.skipRight}`}>{skipFlash === "back" ? "-10s" : "+10s"}</div> : null}

      {!mobile && (preparing || (buffering && !error)) ? (
        <div className={styles.busy} role="status" aria-live="polite" aria-label={preparing ? "Loading" : "Buffering"}>
          <BusyMark buffering={buffering && !preparing} />
        </div>
      ) : null}
      {error ? (
        <div className={styles.error}>
          <div>
            <p>{error}</p>
            <Link href="/media">Back to Media</Link>
          </div>
        </div>
      ) : null}

      {statsOn && session ? (
        <div className={styles.stats}>
          <p>time {formatTime(current)} / {formatTime(duration)}</p>
          <p>quality {qualityLabel}</p>
          <p>audio {audioLabel}</p>
          <p>speed {rate}x</p>
          <p>{session.complete ? "ready" : "packaging"}</p>
        </div>
      ) : null}
      {notice ? <p className={styles.notice}>{notice}</p> : null}

      {locked ? (
        <button type="button" className={`${styles.icon} ${styles.lockOnly}`} aria-label="Unlock player" onClick={() => setLocked(false)}>
          <Icon d="M8 11V7a4 4 0 0 1 8 0M6 11h12v10H6z" />
        </button>
      ) : (
        <div className={`${styles.chrome} ${chrome ? "" : styles.hiddenChrome} ${mobile ? styles.mobileChrome : ""}`}>
          <div className={`${styles.shade} ${(preparing || buffering) && !error ? styles.shadeOff : ""}`} />
          <header className={`${styles.top} ${styles.deskOnly}`}>
            <div className={styles.titleBlock}>
              <Link href="/media" className={`${styles.icon} ${styles.backLink}`} aria-label="Back">
                <Icon d="M15 18l-6-6 6-6" />
              </Link>
              <Link href="/media" className={styles.brand} aria-label={`Back from ${session?.title || "video"}`}>
                <span className={styles.brandTitle}>{session?.title || "Video"}</span>
                {session?.episodeName ? <span className={styles.brandSub}>{session.episodeName}</span> : null}
              </Link>
            </div>
            <div className={styles.iconRow}>
              {volumeLocked ? null : (
                <div className={styles.volume}>
                  <input
                    aria-label="Volume"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={muted ? 0 : volume}
                    onChange={(event) => changeVolume(Number(event.target.value))}
                  />
                  <button type="button" className={styles.icon} aria-label={muted ? "Unmute" : "Mute"} onClick={toggleMute}>
                    {muted || volume === 0 ? <VolumeXIcon /> : <Volume2Icon />}
                  </button>
                </div>
              )}
              <button type="button" className={styles.icon} aria-label="Cast" onClick={cast}>
                <CastIcon />
              </button>
              {pipSupported ? (
                <button type="button" className={styles.icon} aria-label="Picture in picture" aria-pressed={pipOn} onClick={() => void togglePip()}>
                  <PipIcon />
                </button>
              ) : null}
              {mobile ? (
                <button type="button" className={styles.icon} aria-label="Lock controls" onClick={() => setLocked(true)}>
                  <Icon d="M8 11V8a4 4 0 0 1 8 0v3M6 11h12v10H6z" />
                </button>
              ) : null}
              <button type="button" className={styles.icon} aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={() => void toggleFullscreen()}>
                {fullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
              </button>
            </div>
          </header>

          <header className={`${styles.mTop} ${styles.mobileOnly}`}>
            <Link href="/media" className={styles.mBack} aria-label="Back">
              <Icon d="M15 18l-6-6 6-6" />
            </Link>
            <div className={styles.mTitle}>
              <p>{session?.title || "Video"}</p>
              {session?.year || session?.episodeName ? (
                <span>{[session?.year || "", session?.episodeName || ""].filter(Boolean).join(" · ")}</span>
              ) : null}
            </div>
            <div className={styles.mTools}>
              {volumeLocked ? null : volumeOpen ? (
                <input
                  className={styles.mVolume}
                  aria-label="Volume"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(event) => changeVolume(Number(event.target.value))}
                />
              ) : null}
              {volumeLocked ? null : (
                <button
                  type="button"
                  className={styles.mIcon}
                  aria-label={volumeOpen ? (muted ? "Unmute" : "Mute") : "Volume"}
                  onClick={() => {
                    if (volumeLocked) return;
                    if (!volumeOpen) {
                      setVolumeOpen(true);
                      return;
                    }
                    toggleMute();
                  }}
                >
                  {muted || volume === 0 ? <VolumeXIcon /> : <Volume2Icon />}
                </button>
              )}
              {volumeOpen ? null : (
                <>
                  <button type="button" className={styles.mIcon} aria-label={immersive ? "Exit landscape" : "Landscape"} onClick={() => void toggleFullscreen()}>
                    {immersive ? <MinimizeIcon /> : <MaximizeIcon />}
                  </button>
                  {pipSupported ? (
                    <button type="button" className={styles.mIcon} aria-label="Picture in picture" onClick={() => void togglePip()}>
                      <PipIcon />
                    </button>
                  ) : null}
                  <button type="button" className={`${styles.mIcon} ${sheet === "settings" ? styles.iconOn : ""}`} aria-label="Settings" onClick={() => setSheet(sheet === "settings" ? null : "settings")}>
                    <SettingsIcon />
                  </button>
                </>
              )}
            </div>
          </header>

          <button type="button" className={styles.skin} aria-label={playing ? "Pause" : "Play"} onClick={() => { if (!mobile) togglePlay(); }} />

          <div className={`${styles.bottom} ${styles.deskOnly}`}>
            <div className={styles.titleRow}>
              <div className={styles.meta}>
                {session?.year ? <p className={styles.year}>{session.year}</p> : null}
                <h1>{session?.title || "Video"}</h1>
              </div>
              <div className={styles.iconRow}>
                <button type="button" className={`${styles.icon} ${sheet === "subtitles" ? styles.iconOn : ""}`} aria-label="Subtitles" onClick={() => setSheet(sheet === "subtitles" ? null : "subtitles")}>
                  <CaptionsIcon />
                </button>
                <button type="button" className={`${styles.icon} ${sheet === "audio" ? styles.iconOn : ""}`} aria-label="Audio" onClick={() => setSheet(sheet === "audio" ? null : "audio")}>
                  <AudioLinesIcon />
                </button>
                <button type="button" className={`${styles.icon} ${sheet === "speed" ? styles.iconOn : ""}`} aria-label="Playback speed" onClick={() => setSheet(sheet === "speed" ? null : "speed")}>
                  <GaugeIcon />
                </button>
                <button type="button" className={`${styles.icon} ${sheet === "settings" ? styles.iconOn : ""}`} aria-label="Settings" onClick={() => setSheet(sheet === "settings" ? null : "settings")}>
                  <SettingsIcon />
                </button>
              </div>
            </div>
            <div className={styles.seek}>
              <SeekTrack
                value={shown}
                max={duration}
                onScrub={(seconds) => {
                  reveal();
                  setScrub(seconds);
                }}
                onCommit={commitSeek}
              />
            </div>
            <div className={styles.transport}>
              <div className={styles.transportLeft}>
                <span className={styles.timeDesk}>{formatTime(shown)}</span>
                <button type="button" className={styles.icon} aria-label="Rewind 10 seconds" onClick={() => skip(-10)}>
                  <span className={styles.skipIcon}>10</span>
                </button>
                <button type="button" className={styles.icon} aria-label={playing ? "Pause" : "Play"} onClick={togglePlay}>
                  <Icon filled d={playing ? "M7 5h4v14H7zM13 5h4v14h-4z" : "M8 5v14l11-7z"} />
                </button>
                <button type="button" className={styles.icon} aria-label="Forward 10 seconds" onClick={() => skip(10)}>
                  <span className={styles.skipIcon}>10</span>
                </button>
                {(session?.episodes.length ?? 0) > 1 ? (
                  <button type="button" className={styles.pill} aria-label="Next episode" onClick={() => void retarget({ episodeIndex: (session?.episodeIndex ?? 0) + 1, startSeconds: 0 })}>
                    Next
                  </button>
                ) : null}
                <span className={styles.timeMobile}>{formatTime(shown)}</span>
              </div>
              <div className={styles.timeEnd}>
                <span>-{formatTime(Math.max(0, duration - shown))}</span>
                <span className={styles.timeTotal}> / {formatTime(duration)}</span>
                <span className={styles.qualityTag}>{qualityLabel}</span>
              </div>
            </div>
          <div className={styles.dock}>
            <button type="button" className={dock === "info" ? styles.dockOn : ""} onClick={() => setDock(dock === "info" ? null : "info")}>Info</button>
            <button type="button" className={dock === "chapters" ? styles.dockOn : ""} onClick={() => setDock(dock === "chapters" ? null : "chapters")}>Chapters</button>
            <button type="button" className={dock === "cast" ? styles.dockOn : ""} onClick={() => setDock(dock === "cast" ? null : "cast")}>Cast & Crew</button>
            {dock === "info" ? (
              <button type="button" className={styles.fromStart} onClick={() => void seekTo(0)}>From Beginning</button>
            ) : null}
          </div>
          {dock === "info" ? (
            <div className={styles.dockPanel}>
              {details?.posterUrl ? <img src={details.posterUrl} alt="" /> : <div className={styles.posterEmpty}>No poster</div>}
              <div>
                <p className={styles.dockMeta}>
                  {[session?.year || "", details?.runtimeMinutes ? `${details.runtimeMinutes} min` : "", details?.rating ? details.rating.toFixed(1) : ""].filter(Boolean).join(" · ")}
                </p>
                <p>{details?.overview || "No description yet."}</p>
              </div>
            </div>
          ) : null}
          {dock === "chapters" ? <p className={styles.dockEmpty}>No chapters in this file.</p> : null}
          {dock === "cast" ? (
            <div className={styles.castRow}>
              {(details?.cast.length ? details.cast : []).slice(0, 12).map((person) => (
                <div key={person.name} className={styles.castCard}>
                  {person.profileUrl ? <img src={person.profileUrl} alt="" /> : <div />}
                  <span>{person.name}</span>
                </div>
              ))}
              {(details?.cast.length ?? 0) === 0 ? <p className={styles.dockEmpty}>Cast is not available yet.</p> : null}
            </div>
          ) : null}
          </div>

          <div className={`${styles.mDock} ${styles.mobileOnly}`}>
            <div className={styles.mCluster}>
              {(session?.episodes.length ?? 0) > 1 ? (
                <button type="button" className={styles.mIcon} aria-label="Previous episode" onClick={() => void retarget({ episodeIndex: Math.max(0, (session?.episodeIndex ?? 0) - 1), startSeconds: 0 })}>
                  <Icon d="M6 6v12M18 6l-8 6 8 6z" filled />
                </button>
              ) : null}
              <button type="button" className={styles.mSkip} aria-label="Rewind 10 seconds" onClick={() => skip(-10)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 2.2-5.9M3 4v5h5" /></svg>
                <span>10</span>
              </button>
              <button type="button" className={`${styles.mPlay} ${playBusy ? styles.mPlayBusy : ""}`} aria-label={playBusy ? "Buffering" : playing ? "Pause" : "Play"} aria-busy={playBusy} onClick={togglePlay}>
                {playBusy ? <PlaySpinner /> : <Icon filled d={playing ? "M7 5h4v14H7zM13 5h4v14h-4z" : "M8 5v14l11-7z"} />}
              </button>
              <button type="button" className={styles.mSkip} aria-label="Forward 10 seconds" onClick={() => skip(10)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.2-5.9M21 4v5h-5" /></svg>
                <span>10</span>
              </button>
              {(session?.episodes.length ?? 0) > 1 ? (
                <button type="button" className={styles.mIcon} aria-label="Next episode" onClick={() => void retarget({ episodeIndex: (session?.episodeIndex ?? 0) + 1, startSeconds: 0 })}>
                  <Icon d="M6 6l8 6-8 6zM18 6v12" filled />
                </button>
              ) : null}
            </div>
            <div className={styles.mSeekRow}>
              <span>{formatTime(shown)}</span>
              <SeekTrack
                teal
                value={shown}
                max={duration}
                onScrub={(seconds) => {
                  reveal();
                  setScrub(seconds);
                }}
                onCommit={commitSeek}
              />
              <span className={styles.mDuration}>{duration > 0 ? formatTime(duration) : "--:--"}</span>
            </div>
          </div>
        </div>
      )}

      {sheet && !locked ? (
        <div className={styles.sheet} role="dialog" aria-label="Player settings">
          {sheet === "settings" ? (
            <>
              <h2>Settings</h2>
              <button type="button" className={styles.choice} onClick={() => setSheet("aspect")}>
                <span>Aspect ratio</span>
                <span>{aspect === "fit" ? "Fit" : aspect === "fill" ? "Fill" : "Stretch"}</span>
              </button>
              <button type="button" className={styles.choice} onClick={() => setSheet("speed")}>
                <span>Playback speed</span>
                <span>{rate === 1 ? "Normal" : `${rate}x`}</span>
              </button>
              <button type="button" className={styles.choice} onClick={() => setSheet("audio")}>
                <span>Audio</span>
                <span>{audioLabel}</span>
              </button>
              <button type="button" className={styles.choice} onClick={() => setSheet("subtitles")}>
                <span>Subtitles</span>
                <span>{subtitleLabel}</span>
              </button>
              {(session?.episodes.length ?? 0) > 1 ? (
                <button type="button" className={styles.choice} onClick={() => setSheet("episodes")}>
                  <span>Episodes</span>
                  <span>{session?.episodeName}</span>
                </button>
              ) : null}
            </>
          ) : null}
          {sheet === "speed"
            ? SPEEDS.map((speed) => (
                <button
                  key={speed}
                  type="button"
                  className={`${styles.choice} ${rate === speed ? styles.selected : ""}`}
                  onClick={() => {
                    const video = videoRef.current;
                    if (video) video.playbackRate = speed;
                    setRate(speed);
                    setSheet(null);
                  }}
                >
                  <span>{speed === 1 ? "Normal" : `${speed}x`}</span>
                </button>
              ))
            : null}
          {sheet === "audio"
            ? (session?.audioTracks.length ? session.audioTracks : [{ index: 0, label: "Default" }]).map((track) => (
                <button
                  key={track.index}
                  type="button"
                  className={`${styles.choice} ${session?.audioIndex === track.index ? styles.selected : ""}`}
                  onClick={() => {
                    setSheet(null);
                    if ((session?.audioTracks.length ?? 0) > 1) {
                      void retarget({ audioIndex: track.index, startSeconds: current }).catch(() => undefined);
                    }
                  }}
                >
                  <span>{track.label}</span>
                </button>
              ))
            : null}
          {sheet === "subtitles" ? (
            <>
              <button
                type="button"
                className={`${styles.choice} ${subtitleIndex == null ? styles.selected : ""}`}
                onClick={() => {
                  setSubtitleIndex(null);
                  setSheet(null);
                }}
              >
                <span>Off</span>
              </button>
              {(session?.subtitles ?? []).map((track) => (
                <button
                  key={track.index}
                  type="button"
                  className={`${styles.choice} ${subtitleIndex === track.index ? styles.selected : ""}`}
                  onClick={() => {
                    setSubtitleIndex(track.index);
                    subtitleRef.current = track.index;
                    setSheet(null);
                  }}
                >
                  <span>{track.label}</span>
                </button>
              ))}
              {(session?.subtitles.length ?? 0) === 0 ? <p className={styles.message}>No text subtitles in this file.</p> : null}
            </>
          ) : null}
          {sheet === "episodes"
            ? session?.episodes.map((episode) => (
                <button
                  key={episode.index}
                  type="button"
                  className={`${styles.choice} ${session.episodeIndex === episode.index ? styles.selected : ""}`}
                  onClick={() => {
                    setSheet(null);
                    void retarget({ episodeIndex: episode.index, startSeconds: 0, audioIndex: 0 }).catch(() => undefined);
                  }}
                >
                  <span>{episode.name}</span>
                </button>
              ))
            : null}
          {sheet === "aspect"
            ? (
                [
                  ["fit", "Fit"],
                  ["fill", "Fill"],
                  ["stretch", "Stretch"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`${styles.choice} ${aspect === id ? styles.selected : ""}`}
                  onClick={() => {
                    setAspect(id);
                    setSheet(null);
                  }}
                >
                  <span>{label}</span>
                </button>
              ))
            : null}
          {sheet !== "settings" ? (
            <button type="button" className={styles.menuFoot} onClick={() => setSheet("settings")}>
              Back
            </button>
          ) : (
            <button type="button" className={styles.menuFoot} onClick={() => setSheet(null)}>
              Done
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
