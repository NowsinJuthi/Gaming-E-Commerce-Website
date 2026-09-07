/** Matches API blog image processor output (WebP crop). */
export const BLOG_IMAGE_TARGET_WIDTH = 1600;
export const BLOG_IMAGE_TARGET_HEIGHT = 800;

export const BLOG_IMAGE_TARGET_SIZE_LABEL = `${BLOG_IMAGE_TARGET_WIDTH}×${BLOG_IMAGE_TARGET_HEIGHT}`;

/** CSS aspect-ratio value shared by storefront + admin previews. */
export const BLOG_IMAGE_ASPECT_RATIO = `${BLOG_IMAGE_TARGET_WIDTH} / ${BLOG_IMAGE_TARGET_HEIGHT}` as const;

export const BLOG_IMAGE_UPLOAD_MAX_MB = 10;

/** Formats accepted by the blog image upload endpoint. */
export const BLOG_IMAGE_ACCEPTED_FORMATS = [
  "JPEG / JPG",
  "PNG",
  "WebP",
  "GIF",
  "AVIF",
] as const;

export const BLOG_IMAGE_OUTPUT_FORMAT = "WebP";

export const BLOG_IMAGE_UPLOAD_HINT =
  `আপলোড অটোভাবে WebP-তে রূপান্তরিত হয় এবং ${BLOG_IMAGE_TARGET_SIZE_LABEL} px-এ ক্রপ হয়। / Uploads are auto-converted to WebP and cropped to ${BLOG_IMAGE_TARGET_SIZE_LABEL} px.`;

export const BLOG_IMAGE_UPLOAD_DOCS = {
  title: "Image upload guide",
  titleBn: "ইমেজ আপলোড গাইড",
  summary:
    "You can upload JPG, PNG, WebP, GIF, or AVIF. The system converts every upload into one standard WebP file.",
  summaryBn:
    "আপনি JPG, PNG, WebP, GIF বা AVIF আপলোড করতে পারবেন। সিস্টেম সব ছবিকে একটি স্ট্যান্ডার্ড WebP ফাইলে রূপান্তর করবে।",
  acceptedHeading: "Accepted upload formats",
  acceptedHeadingBn: "আপলোড করা যায়",
  conversionHeading: "Automatic conversion",
  conversionHeadingBn: "অটো কনভার্শন",
  conversionSteps: [
    "Any supported image is uploaded from your device.",
    "The server crops it to a blog hero frame (centre-weighted).",
    "The image is compressed and saved as WebP (.webp).",
    "Only the converted WebP URL is stored on the post.",
  ],
  conversionStepsBn: [
    "সাপোর্টেড যেকোনো ছবি আপনার ডিভাইস থেকে আপলোড হবে।",
    "সার্ভার ছবিটিকে ব্লগ হিরো ফ্রেমে ক্রপ করবে (মাঝখান থেকে)।",
    "ছবি কম্প্রেস হয়ে WebP (.webp) ফরম্যাটে সেভ হবে।",
    "পোস্টে শুধু কনভার্ট হওয়া WebP URL-ই সংরক্ষিত থাকবে।",
  ],
  outputHeading: "Final saved image (always the same)",
  outputHeadingBn: "সেভ হওয়া ফাইনাল ইমেজ (সবসময় একই)",
  outputDetails: [
    `Format: WebP (every upload is saved in one standard format)`,
    `Size: ${BLOG_IMAGE_TARGET_SIZE_LABEL} pixels`,
    `Max upload size: ${BLOG_IMAGE_UPLOAD_MAX_MB} MB per file`,
  ],
  outputDetailsBn: [
    `ফরম্যাট: WebP (সব আপলোড একই স্ট্যান্ডার্ড ফরম্যাটে সেভ হয়)`,
    `সাইজ: ${BLOG_IMAGE_TARGET_SIZE_LABEL} পিক্সেল`,
    `সর্বোচ্চ আপলোড: প্রতি ফাইল ${BLOG_IMAGE_UPLOAD_MAX_MB} MB`,
  ],
  tipsHeading: "Tips",
  tipsHeadingBn: "টিপস",
  tips: [
    "Use a wide landscape photo for best results after cropping.",
    "PNG and JPEG uploads become smaller WebP files automatically.",
    "Pasting an external image URL does not run conversion — use Upload for the standard size.",
  ],
  tipsBn: [
    "ক্রপের পর ভালো ফলাফলের জন্য চওড়া ল্যান্ডস্কেপ ছবি ব্যবহার করুন।",
    "PNG ও JPEG আপলোড অটোভাবে ছোট WebP ফাইলে পরিণত হয়।",
    "বাহিরের URL পেস্ট করলে কনভার্শন হয় না — স্ট্যান্ডার্ড সাইজের জন্য Upload ব্যবহার করুন।",
  ],
} as const;

export function formatBlogImageSavedLabel(options: {
  width?: number;
  height?: number;
  sizeBytes?: number;
}): string {
  const width = options.width ?? BLOG_IMAGE_TARGET_WIDTH;
  const height = options.height ?? BLOG_IMAGE_TARGET_HEIGHT;
  const size =
    options.sizeBytes != null ? formatBytes(options.sizeBytes) : null;
  return size
    ? `Saved as WebP · ${width}×${height} px · ${size}`
    : `Saved as WebP · ${width}×${height} px`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
