export type LiveVisitorRow = {
  visitorKey: string;
  path: string;
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
