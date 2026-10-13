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
