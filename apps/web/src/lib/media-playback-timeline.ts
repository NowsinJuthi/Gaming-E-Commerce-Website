/** Movie timeline position from packaged HLS local time (Movie Server model). */
export function displayTimelineSeconds(
  localSeconds: number,
  originSeconds: number,
  maxSeconds = 0,
): number {
  const value = Math.max(0, originSeconds + localSeconds);
  if (maxSeconds > 0) return Math.min(value, maxSeconds);
  return value;
}

/** Movie timeline position → local time inside the current transcode pack. */
export function localTimelineSeconds(displaySeconds: number, originSeconds: number): number {
  return Math.max(0, displaySeconds - originSeconds);
}

export function isLocalTimeBuffered(
  video: HTMLVideoElement,
  localSeconds: number,
  slack = 0.35,
): boolean {
  const ranges = video.buffered;
  if (ranges.length === 0) return false;
  for (let i = 0; i < ranges.length; i += 1) {
    const start = ranges.start(i);
    const end = ranges.end(i);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (localSeconds >= start - slack && localSeconds <= end + slack) return true;
  }
  return false;
}

/**
 * True when this pack can represent the local time (buffered, or already in the
 * EVENT playlist). Finite seekable only — live Infinity ranges are ignored.
 */
export function isLocalTimeInPack(
  video: HTMLVideoElement,
  localSeconds: number,
  slack = 0.5,
): boolean {
  if (isLocalTimeBuffered(video, localSeconds, slack)) return true;
  if (!Number.isFinite(localSeconds) || localSeconds < -slack) return false;
  const ranges = video.seekable;
  if (ranges.length === 0) return false;
  for (let i = 0; i < ranges.length; i += 1) {
    const start = ranges.start(i);
    const end = ranges.end(i);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (localSeconds >= start - slack && localSeconds <= end + slack) return true;
  }
  return false;
}

/** Seek with HLS seekable-range clamping — iOS native HLS ignores out-of-range seeks. */
export function seekVideoTo(
  video: HTMLVideoElement,
  localSeconds: number,
  packDurationSeconds = 0,
): void {
  let target = Math.max(0, localSeconds);
  if (packDurationSeconds > 0) target = Math.min(target, packDurationSeconds);

  if (video.seekable.length > 0) {
    for (let i = 0; i < video.seekable.length; i += 1) {
      const start = video.seekable.start(i);
      const end = video.seekable.end(i);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      if (target >= start && target <= end) {
        applyVideoSeek(video, target);
        return;
      }
      if (target <= end) {
        applyVideoSeek(video, Math.max(start, target));
        return;
      }
    }
  }

  applyVideoSeek(video, target);
}

function isAppleMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

/** Precise seek — Safari fastSeek snaps to sync samples (~1–2s) and causes visible jumps. */
export function applyVideoSeek(video: HTMLVideoElement, target: number): void {
  if (!isAppleMobileDevice() && typeof video.fastSeek === "function") {
    try {
      video.fastSeek(target);
      return;
    } catch {
      /* fall through */
    }
  }
  video.currentTime = target;
}

/** While ffmpeg is still packaging (EVENT HLS), only seek inside buffered data. */
export function canSeekWithinCurrentPack(
  video: HTMLVideoElement,
  localSeconds: number,
  packComplete: boolean,
  slack = 0.5,
): boolean {
  if (isLocalTimeBuffered(video, localSeconds, slack)) return true;
  if (!packComplete) return false;
  return isLocalTimeInPack(video, localSeconds, slack);
}
