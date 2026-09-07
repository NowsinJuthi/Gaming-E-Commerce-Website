export const BLOG_CANONICAL_URL_DOCS = {
  title: "Canonical URL guide",
  titleBn: "ক্যানোনিক্যাল URL গাইড",
  summary:
    "Optional. Tells search engines the preferred URL for this article. Leave empty to use the default blog URL.",
  summaryBn:
    "ঐচ্ছিক। সার্চ ইঞ্জিনকে এই আর্টিকেলের মূল URL জানায়। খালি রাখলে ডিফল্ট ব্লগ URL ব্যবহার হবে।",
  defaultHeading: "When you leave it empty",
  defaultHeadingBn: "খালি রাখলে",
  whenHeading: "When to set a custom URL",
  whenHeadingBn: "কখন কাস্টম URL দেবেন",
  formatHeading: "Correct format",
  formatHeadingBn: "সঠিক ফরম্যাট",
  avoidHeading: "Avoid",
  avoidHeadingBn: "যা করবেন না",
  defaultPointsBn: [
    "সিস্টেম অটোভাবে /blog/slug URL ক্যানোনিক্যাল হিসেবে ব্যবহার করে।",
    "বেশিরভাগ পোস্টে খালি রাখাই যথেষ্ট।",
  ],
  defaultPoints: [
    "The system uses /blog/slug as the canonical URL automatically.",
    "Leaving this empty is correct for most posts.",
  ],
  whenPointsBn: [
    "একই আর্টিকেল অন্য জায়গায় আগে প্রকাশিত হয়েছে।",
    "সিন্ডিকেটেড বা রিপাবলিশ কন্টেন্টের মূল সোর্স URL দিতে হবে।",
    "একাধিক URL-এ একই কন্টেন্ট দেখা যায় এমন ক্ষেত্রে।",
  ],
  whenPoints: [
    "The article was published elsewhere first.",
    "Syndicated or republished content needs the original source URL.",
    "The same content is reachable from multiple URLs.",
  ],
  formatPointsBn: [
    "পুরো absolute URL ব্যবহার করুন: https://uniqbd.com/blog/your-slug",
    "https:// দিয়ে শুরু করুন।",
    "ট্রেইলিং স্ল্যাশ (/) এড়িয়ে চলুন।",
  ],
  formatPoints: [
    "Use a full absolute URL: https://uniqbd.com/blog/your-slug",
    "Start with https://",
    "Avoid a trailing slash unless your site uses it everywhere.",
  ],
  avoidPointsBn: [
    "শুধু এই সাইটে একবার প্রকাশিত পোস্টে অপ্রয়োজনীয় override দেবেন না।",
    "ভুল বা অন্য সাইটের URL দিলে SEO ক্ষতিগ্রস্ত হতে পারে।",
    "খসড়া বা অপ্রকাশিত পেজের লিংক দেবেন না।",
  ],
  avoidPoints: [
    "Do not override when the post only exists once on this site.",
    "A wrong or external URL can hurt SEO.",
    "Do not point to draft or unpublished pages.",
  ],
} as const;

export function blogCanonicalDefaultPath(slug: string): string {
  const clean = slug.trim() || "your-slug";
  return `/blog/${clean}`;
}

export function blogCanonicalDefaultUrl(slug: string, siteOrigin = "https://uniqbd.com"): string {
  return `${siteOrigin.replace(/\/$/, "")}${blogCanonicalDefaultPath(slug)}`;
}
