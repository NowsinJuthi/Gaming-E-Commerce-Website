export type BlogPageFeatures = {
  reactionsEnabled: boolean;
  reviewsEnabled: boolean;
  viewsEnabled: boolean;
  authorProfileEnabled: boolean;
  shareButtonsEnabled: boolean;
  readingTimeEnabled: boolean;
  relatedPostsEnabled: boolean;
};

export type BlogPageSettings = {
  features: BlogPageFeatures;
  updatedAt?: string;
};

export const DEFAULT_BLOG_PAGE_FEATURES: BlogPageFeatures = {
  reactionsEnabled: true,
  reviewsEnabled: true,
  viewsEnabled: true,
  authorProfileEnabled: true,
  shareButtonsEnabled: true,
  readingTimeEnabled: true,
  relatedPostsEnabled: true,
};

export const DEFAULT_BLOG_PAGE_SETTINGS: BlogPageSettings = {
  features: DEFAULT_BLOG_PAGE_FEATURES,
};

export function normalizeBlogPageSettings(
  input?: Partial<BlogPageSettings> | null,
): BlogPageSettings {
  const features: Partial<BlogPageFeatures> = input?.features ?? {};
  return {
    updatedAt: input?.updatedAt,
    features: {
      reactionsEnabled: features.reactionsEnabled !== false,
      reviewsEnabled: features.reviewsEnabled !== false,
      viewsEnabled: features.viewsEnabled !== false,
      authorProfileEnabled: features.authorProfileEnabled !== false,
      shareButtonsEnabled: features.shareButtonsEnabled !== false,
      readingTimeEnabled: features.readingTimeEnabled !== false,
      relatedPostsEnabled: features.relatedPostsEnabled !== false,
    },
  };
}

export type BlogFeatureToggleKey = keyof BlogPageFeatures;

export const BLOG_FEATURE_TOGGLES: Array<{
  key: BlogFeatureToggleKey;
  title: string;
  titleBn: string;
  description: string;
  descriptionBn: string;
}> = [
  {
    key: "reactionsEnabled",
    title: "Likes & dislikes",
    titleBn: "লাইক ও ডিসলাইক",
    description: "Let readers react to articles with like and dislike buttons.",
    descriptionBn: "পাঠকরা আর্টিকেলে লাইক ও ডিসলাইক বাটন ব্যবহার করতে পারবে।",
  },
  {
    key: "reviewsEnabled",
    title: "Reader reviews",
    titleBn: "রিভিউ",
    description: "Show review summary, recent reviews, and the write-a-review form.",
    descriptionBn: "রিভিউ সারাংশ, সাম্প্রতিক রিভিউ ও রিভিউ লেখার ফর্ম দেখাবে।",
  },
  {
    key: "viewsEnabled",
    title: "View count",
    titleBn: "ভিউ কাউন্ট",
    description: "Display article views and count each visit on the article page.",
    descriptionBn: "আর্টিকেল ভিউ দেখাবে এবং প্রতিটি ভিজিট গণনা করবে।",
  },
  {
    key: "authorProfileEnabled",
    title: "Author profile",
    titleBn: "লেখকের প্রোফাইল",
    description: "Show the writer name and profile photo (or default icon) on articles.",
    descriptionBn: "আর্টিকেলে লেখকের নাম ও প্রোফাইল ছবি (না থাকলে ডিফল্ট আইকন) দেখাবে।",
  },
  {
    key: "shareButtonsEnabled",
    title: "Share buttons",
    titleBn: "শেয়ার বাটন",
    description: "Show social share actions below the article.",
    descriptionBn: "আর্টিকেলের নিচে শেয়ার বাটন দেখাবে।",
  },
  {
    key: "readingTimeEnabled",
    title: "Reading time",
    titleBn: "পড়ার সময়",
    description: "Estimate and display how long the article takes to read.",
    descriptionBn: "আর্টিকেল পড়তে কত সময় লাগবে তা দেখাবে।",
  },
  {
    key: "relatedPostsEnabled",
    title: "Related posts",
    titleBn: "সম্পর্কিত পোস্ট",
    description: "Show related articles and previous/next navigation at the bottom.",
    descriptionBn: "নিচে সম্পর্কিত আর্টিকেল ও আগের/পরের নেভিগেশন দেখাবে।",
  },
];
