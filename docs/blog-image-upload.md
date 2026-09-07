# Blog post image upload

How featured images and OG images are handled when authors create or edit blog posts on UniQbd.

## Accepted upload formats

Authors can upload common image formats:

| Format | Extensions | MIME type |
|--------|------------|-----------|
| JPEG | `.jpg`, `.jpeg` | `image/jpeg` |
| PNG | `.png` | `image/png` |
| WebP | `.webp` | `image/webp` |
| GIF | `.gif` | `image/gif` |
| AVIF | `.avif` | `image/avif` |

**Max file size:** 10 MB per upload.

Other file types (PDF, SVG, BMP, HEIC, etc.) are rejected by the API.

## Automatic conversion (one standard output)

Every successful **Upload** goes through the same pipeline:

1. The original file is read in memory (JPG, PNG, WebP, GIF, or AVIF).
2. EXIF orientation is applied (`rotate()`).
3. The image is **centre-cropped** to the blog hero frame.
4. The result is encoded as **WebP** and written to `uploads/blog/`.
5. The post stores only the converted URL (e.g. `/api/uploads/blog/blog-1739….webp`).

So regardless of what the author uploads, **one standard output** is always produced.

## Final saved image (always the same)

| Property | Value |
|----------|-------|
| Format | **WebP** (`.webp`) |
| Dimensions | **1600 × 600** pixels |
| Crop | Centre-weighted `cover` |
| Quality | WebP quality 84 |

Authors see this under the upload field as **Output size: 1600×600 px · WebP**.

## URL paste vs upload

- **Upload button** — runs conversion; output is always WebP at 1600×600.
- **Paste external URL** — stored as-is; no server-side conversion. Use Upload when you want the standard blog hero size and WebP compression.

## Where this is implemented

| Layer | Path |
|-------|------|
| Constants | `apps/api/src/shared/uploads/blog-image-upload.constants.ts` |
| Processor | `apps/api/src/shared/uploads/blog-image.processor.ts` |
| API endpoint | `POST /api/admin/blogs/image-upload` |
| Web client | `apps/web/src/lib/api.ts` → `uploadBlogImage()` |
| UI picker | `apps/web/src/components/admin/blog-image-picker.tsx` |
| In-form guide | `apps/web/src/components/admin/BlogImageUploadGuide.tsx` |
| Shared copy | `apps/web/src/lib/blog-image-spec.ts` |

## Author-facing UI

On **Create post** / **Edit post**, the **Media & taxonomy** section includes:

- Collapsible **ইমেজ আপলোড গাইড** (image upload guide)
- Per-field hint and output size badge under Featured image / OG image

## Production note

Image conversion runs on the **API**. After changing processor settings, rebuild and restart the API (`apps/api`), not only the Next.js web app.
