export type LiveVisitorRow = {
  visitorKey: string;
  path: string;
  /** Human-readable page label (e.g. movie title on /media/watch/…). */
  pathLabel: string | null;
  label: string;
  userId: string | null;
  lastSeen: number;
};

export type LiveMediaRow = {
  visitorKey: string;
  label: string;
  userId: string | null;
  titleId: string;
  titleName: string;
  episodeName: string | null;
  lastSeen: number;
};

export type LiveAnalyticsSnapshot = {
  updatedAt: number;
  visitorCount: number;
  visitors: LiveVisitorRow[];
  mediaSessions: LiveMediaRow[];
};
