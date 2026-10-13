"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
import { API_BASE } from "@/lib/api";
import styles from "./media-player.module.css";

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

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function MediaPlayer({ titleId }: { titleId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const sessionRef = useRef<PlaybackSession | null>(null);
  const hideTimer = useRef<number | null>(null);
  const lastTap = useRef<{ zone: string; at: number } | null>(null);
  const [session, setSession] = useState<PlaybackSession | null>(null);
  const [bootId, setBootId] = useState(0);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [chrome, setChrome] = useState(true);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [aspect, setAspect] = useState<Aspect>("fit");
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [subtitleIndex, setSubtitleIndex] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [statsOn, setStatsOn] = useState(false);
  const [notice, setNotice] = useState("");
  const [skipFlash, setSkipFlash] = useState<"back" | "forward" | null>(null);
  const [mobile, setMobile] = useState(false);
  const [pipOn, setPipOn] = useState(false);
  const [volumeLocked, setVolumeLocked] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const repeatRef = useRef(repeat);
  const subtitleRef = useRef(subtitleIndex);
  repeatRef.current = repeat;
  subtitleRef.current = subtitleIndex;
  sessionRef.current = session;

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
      if (seconds > 8) localStorage.setItem(`uniqbd-watch:${titleId}`, String(Math.floor(seconds)));
    },
    [titleId],
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

  const retarget = useCallback(
    async (patch: Record<string, unknown>) => {
      const currentSession = sessionRef.current;
      if (!currentSession) return;
      setError("");
      setBuffering(true);
      const next = await post(`${API_BASE}/media/playback/sessions/${currentSession.sessionId}`, {
        startSeconds: patch.startSeconds ?? currentSession.startSeconds,
        episodeIndex: patch.episodeIndex ?? currentSession.episodeIndex,
        audioIndex: patch.audioIndex ?? currentSession.audioIndex,
        quality: patch.quality ?? currentSession.quality,
      });
      setSession(next);
      setBootId((value) => value + 1);
    },
    [post],
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px), (hover: none) and (pointer: coarse)");
    const sync = () => setMobile(media.matches);
    sync();
    setVolumeLocked(volumeReadOnly());
    media.addEventListener("change", sync);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      media.removeEventListener("change", sync);
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    let stop = false;
    const saved = Number(localStorage.getItem(`uniqbd-watch:${titleId}`) || 0);
    void post(`${API_BASE}/media/playback/${titleId}`, {
      startSeconds: saved > 15 ? saved : 0,
    })
      .then((next) => {
        if (!stop) setSession(next);
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
            if (!previous || previous.sessionId !== data.sessionId) return data;
            if (previous.status === "ready" && data.status === "ready" && previous.startSeconds === data.startSeconds) {
              const sameSubtitles = JSON.stringify(previous.subtitles) === JSON.stringify(data.subtitles);
              if (sameSubtitles && previous.complete === data.complete && previous.message === data.message) return previous;
              return { ...previous, subtitles: data.subtitles, complete: data.complete, message: data.message };
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
    const video = videoRef.current;
    if (!video || !session || session.status !== "ready") return;
    let destroyed = false;
    let hls: Hls | null = null;
    const playlist = session.playlistUrl;
    const startAt = session.startSeconds;

    const showGesture = () => {
      if (!destroyed) setNeedsGesture(true);
    };
    const begin = () => {
      video.playbackRate = rate;
      void video.play().then(() => setNeedsGesture(false)).catch(showGesture);
    };

    void (async () => {
      if (nativeHls(video)) {
        video.src = playlist;
        video.addEventListener("loadedmetadata", begin, { once: true });
        return;
      }
      const mod = await import("hls.js");
      if (destroyed) return;
      if (!mod.default.isSupported()) {
        video.src = playlist;
        video.addEventListener("loadedmetadata", begin, { once: true });
        return;
      }
      hls = new mod.default({
        enableWorker: true,
        startPosition: 0,
        maxBufferLength: 30,
        backBufferLength: 30,
      });
      hlsRef.current = hls;
      hls.attachMedia(video);
      hls.loadSource(playlist);
      hls.on(mod.default.Events.MANIFEST_PARSED, () => {
        if (destroyed) return;
        begin();
      });
      hls.on(mod.default.Events.ERROR, (_event, data) => {
        if (!data.fatal || destroyed) return;
        if (data.type === mod.default.ErrorTypes.NETWORK_ERROR) hls?.startLoad();
        else if (data.type === mod.default.ErrorTypes.MEDIA_ERROR) hls?.recoverMediaError();
        else setError("Playback stopped. Try again.");
      });
    })();

    return () => {
      destroyed = true;
      hls?.destroy();
      if (hlsRef.current === hls) hlsRef.current = null;
      video.removeAttribute("src");
      video.load();
      setCurrent(startAt);
    };
    // Reload only when the server starts a new playlist.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootId, session?.status, session?.playlistUrl, session?.startSeconds]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => {
      const start = sessionRef.current?.startSeconds ?? 0;
      const mediaTime = start + video.currentTime;
      setCurrent(mediaTime);
      const known = sessionRef.current?.durationSeconds ?? 0;
      setDuration(known > 0 ? known : start + (Number.isFinite(video.duration) ? video.duration : 0));
    };
    const onPlay = () => {
      setPlaying(true);
      setBuffering(false);
      reveal();
    };
    const onPause = () => setPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
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
    if (session?.durationSeconds) setDuration(session.durationSeconds);
  }, [session?.durationSeconds]);

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
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
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
    if (video.paused) void video.play().then(() => setNeedsGesture(false)).catch(() => setNeedsGesture(true));
    else video.pause();
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
    const target = Math.max(0, (currentSession.startSeconds + video.currentTime) + delta);
    setSkipFlash(delta < 0 ? "back" : "forward");
    window.setTimeout(() => setSkipFlash(null), 600);
    void seekTo(target);
    reveal();
  }

  async function seekTo(target: number) {
    const video = videoRef.current;
    const currentSession = sessionRef.current;
    if (!video || !currentSession) return;
    const start = currentSession.startSeconds;
    const end = video.seekable.length > 0 ? video.seekable.end(video.seekable.length - 1) : video.currentTime;
    if (target >= start && target <= start + end + 1.5) {
      video.currentTime = Math.max(0, target - start);
      setCurrent(target);
      return;
    }
    remember(target);
    try {
      await retarget({ startSeconds: target });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not seek.");
    }
  }

  async function toggleFullscreen() {
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    const shell = video?.parentElement;
    if (!video || !shell) return;
    if (appleMobile() && video.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
      return;
    }
    if (document.fullscreenElement) await document.exitFullscreen();
    else {
      await shell.requestFullscreen();
      if (mobile) {
        const orientation = screen.orientation as ScreenOrientation & {
          lock?: (mode: string) => Promise<void>;
        };
        await orientation.lock?.("landscape").catch(() => undefined);
      }
    }
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
    if (previous && previous.zone === zone && now - previous.at < 320) {
      if (zone === "left") skip(-10);
      else if (zone === "right") skip(10);
      else togglePlay();
      return;
    }
    if (zone === "middle") {
      if (needsGesture) togglePlay();
      else setChrome((value) => !value);
    }
  }

  const shown = scrub ?? current;
  const pipSupported = typeof document !== "undefined" && (document.pictureInPictureEnabled || appleMobile());
  const preparing = !error && session?.status !== "ready";
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
      className={styles.shell}
      tabIndex={-1}
      onMouseMove={() => {
        if (!locked) reveal();
      }}
    >
      <video
        ref={videoRef}
        className={`${styles.video} ${aspect === "fill" ? styles.videoFill : ""} ${aspect === "stretch" ? styles.videoStretch : ""}`}
        playsInline
        preload="auto"
        controlsList="nodownload"
        {...({ "webkit-playsinline": "true", "x-webkit-airplay": "allow" } as Record<string, string>)}
      />

      {mobile && !locked ? (
        <div className={styles.tapZones}>
          <button type="button" className={styles.side} aria-label="Rewind 10 seconds" onClick={() => onZone("left")} />
          <button type="button" className={styles.middle} aria-label="Show controls" onClick={() => onZone("middle")} />
          <button type="button" className={styles.side} aria-label="Forward 10 seconds" onClick={() => onZone("right")} />
        </div>
      ) : null}

      {skipFlash ? <div className={`${styles.skipFlash} ${skipFlash === "back" ? styles.skipLeft : styles.skipRight}`}>{skipFlash === "back" ? "-10s" : "+10s"}</div> : null}

      {preparing ? (
        <div className={styles.busy}>
          <div>
            <div className={styles.spinner} />
            <p className={styles.message}>{session?.message || "Opening the video…"}</p>
          </div>
        </div>
      ) : null}
      {buffering && !preparing && !error ? (
        <div className={styles.busy}>
          <div className={styles.spinner} />
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
        <div className={`${styles.chrome} ${chrome ? "" : styles.hiddenChrome}`}>
          <div className={styles.shade} />
          <div className={styles.top}>
            <div className={styles.titleBlock}>
              <Link href="/media" className={`${styles.icon} ${styles.backLink}`} aria-label="Back">
                <Icon d="M15 18l-6-6 6-6" />
              </Link>
              <div>
                <p className={styles.kicker}>{session?.year || ""}</p>
                <h1 className={styles.title}>{session?.title || "Video"}</h1>
              </div>
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
                    <Icon d={muted ? "M11 5L6 9H3v6h3l5 4V5zM16 9l5 6M21 9l-5 6" : "M11 5L6 9H3v6h3l5 4V5zM16 9a5 5 0 0 1 0 6M19 7a8 8 0 0 1 0 10"} />
                  </button>
                </div>
              )}
              <button type="button" className={styles.icon} aria-label="Cast" onClick={cast}>
                <Icon d="M3 7h18v10H3zM7 17v2h10v-2" />
              </button>
              {pipSupported ? (
                <button type="button" className={styles.icon} aria-label="Picture in picture" aria-pressed={pipOn} onClick={() => void togglePip()}>
                  <Icon d="M4 6h16v12H4zM12 11h6v4h-6z" />
                </button>
              ) : null}
              {mobile ? (
                <button type="button" className={styles.icon} aria-label="Lock controls" onClick={() => setLocked(true)}>
                  <Icon d="M8 11V8a4 4 0 0 1 8 0v3M6 11h12v10H6z" />
                </button>
              ) : null}
              <button type="button" className={styles.icon} aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={() => void toggleFullscreen()}>
                <Icon d={fullscreen ? "M9 9H5V5M15 9h4V5M9 15H5v4M15 15h4v4" : "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"} />
              </button>
            </div>
          </div>

          <div className={styles.center}>
            {needsGesture || !playing ? (
              <button type="button" className={styles.bigPlay} aria-label="Play" onClick={togglePlay}>
                <Icon d="M8 5v14l12-7z" />
              </button>
            ) : (
              <button type="button" className={styles.bigPlay} aria-label="Pause" onClick={togglePlay}>
                <Icon d="M7 5h4v14H7zM13 5h4v14h-4z" />
              </button>
            )}
          </div>

          <div className={styles.bottom}>
            <div className={styles.bottomMain}>
              <div className={styles.meta}>
                <h1>{session?.episodeName || session?.title}</h1>
              </div>
              <div className={styles.times}>
                <span>{formatTime(shown)}</span>
                <span>{formatTime(duration)}</span>
              </div>
              <div className={styles.seek}>
                <input
                  aria-label="Seek"
                  type="range"
                  min={0}
                  max={Math.max(duration, 1)}
                  step={1}
                  value={Math.min(shown, Math.max(duration, 1))}
                  onPointerDown={() => setScrub(current)}
                  onChange={(event) => setScrub(Number(event.target.value))}
                  onPointerUp={(event) => {
                    const target = Number((event.target as HTMLInputElement).value);
                    setScrub(null);
                    void seekTo(target);
                  }}
                />
              </div>
              <div className={styles.transport}>
                <button type="button" aria-label="Rewind 10 seconds" onClick={() => skip(-10)}>
                  -10
                </button>
                <button type="button" aria-label={playing ? "Pause" : "Play"} onClick={togglePlay}>
                  {playing ? "Pause" : "Play"}
                </button>
                <button type="button" aria-label="Forward 10 seconds" onClick={() => skip(10)}>
                  +10
                </button>
                {(session?.episodes.length ?? 0) > 1 ? (
                  <>
                    <button type="button" aria-label="Previous episode" onClick={() => void retarget({ episodeIndex: Math.max(0, (session?.episodeIndex ?? 0) - 1), startSeconds: 0 })}>
                      Prev
                    </button>
                    <button type="button" aria-label="Next episode" onClick={() => void retarget({ episodeIndex: (session?.episodeIndex ?? 0) + 1, startSeconds: 0 })}>
                      Next
                    </button>
                  </>
                ) : null}
                <button type="button" aria-label="Subtitles" onClick={() => setSheet(sheet === "subtitles" ? null : "subtitles")}>
                  CC
                </button>
                <button type="button" aria-label="Playback speed" onClick={() => setSheet(sheet === "speed" ? null : "speed")}>
                  {rate === 1 ? "1x" : `${rate}x`}
                </button>
                <button type="button" aria-label="Settings" onClick={() => setSheet(sheet === "settings" ? null : "settings")}>
                  Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {sheet && !locked ? (
        <div className={styles.sheet} role="dialog" aria-label="Player settings">
          {sheet === "settings" ? (
            <>
              <h2>Settings</h2>
              <button type="button" className={styles.choice} onClick={() => setSheet("quality")}>
                <span>Quality</span>
                <span>{qualityLabel}</span>
              </button>
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
              <button type="button" className={styles.choice} onClick={() => setSheet("repeat")}>
                <span>Repeat</span>
                <span>{repeat === "off" ? "Off" : repeat === "one" ? "One" : "All"}</span>
              </button>
              <button
                type="button"
                className={styles.choice}
                onClick={() => {
                  setStatsOn((value) => !value);
                  setSheet(null);
                }}
              >
                <span>Stats for nerds</span>
                <span>{statsOn ? "On" : "Off"}</span>
              </button>
            </>
          ) : null}
          {sheet === "quality"
            ? QUALITIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.choice} ${session?.quality === item.id ? styles.selected : ""}`}
                  onClick={() => {
                    setSheet(null);
                    void retarget({ quality: item.id, startSeconds: current }).catch((reason) =>
                      setError(reason instanceof Error ? reason.message : "Could not change quality."),
                    );
                  }}
                >
                  <span>{item.label}</span>
                </button>
              ))
            : null}
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
          {sheet === "repeat"
            ? (
                [
                  ["off", "Off"],
                  ["one", "Repeat one"],
                  ["all", "Repeat all"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`${styles.choice} ${repeat === id ? styles.selected : ""}`}
                  onClick={() => {
                    setRepeat(id);
                    setSheet(null);
                  }}
                >
                  <span>{label}</span>
                </button>
              ))
            : null}
          {sheet !== "settings" ? (
            <button type="button" className={styles.choice} onClick={() => setSheet("settings")}>
              <span>Back</span>
            </button>
          ) : (
            <button type="button" className={styles.choice} onClick={() => setSheet(null)}>
              <span>Done</span>
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
