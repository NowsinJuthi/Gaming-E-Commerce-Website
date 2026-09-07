/**
 * WooCommerce → UniQbd product review migration.
 *
 * Reads a WordPress SQL dump, extracts approved product reviews
 * (wp_comments type=review + wp_commentmeta rating + wp_posts product titles),
 * matches them to products in MongoDB by slug/title, and inserts them into the
 * `product_reviews` collection used by the reviews API.
 *
 * Usage:
 *   node scripts/migrate-wp-reviews.mjs --file "C:\path\to\dump.sql"            (dry run)
 *   node scripts/migrate-wp-reviews.mjs --file "C:\path\to\dump.sql" --commit   (write to DB)
 *
 * Idempotent: each imported review is tagged with `legacyWpId` so re-running
 * never duplicates.
 */
import { readFileSync } from "node:fs";
import dns from "node:dns";
import mongoose from "../apps/api/node_modules/mongoose/index.js";

// Local resolver refuses SRV queries — use public DNS for the Atlas lookup.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const args = process.argv.slice(2);
const fileIdx = args.indexOf("--file");
const dumpPath = fileIdx >= 0 ? args[fileIdx + 1] : null;
const commit = args.includes("--commit");

if (!dumpPath) {
  console.error('Usage: node scripts/migrate-wp-reviews.mjs --file "dump.sql" [--commit]');
  process.exit(1);
}

console.log(`Reading dump: ${dumpPath}`);
const sql = readFileSync(dumpPath, "utf8");
console.log(`Dump size: ${(sql.length / 1024 / 1024).toFixed(1)} MB`);

// ── SQL INSERT tuple parser ──────────────────────────────────────────────────

/**
 * Parses every INSERT for a table. Supports both
 * `INSERT INTO \`t\` VALUES (...)` and phpMyAdmin's
 * `INSERT INTO \`t\` (\`col\`, ...) VALUES (...)` and returns rows as objects
 * keyed by column name (or numeric index when no column list exists).
 */
function parseInsertTuples(table) {
  const rows = [];
  const needle = `INSERT INTO \`${table}\` `;
  let from = 0;
  for (;;) {
    const at = sql.indexOf(needle, from);
    if (at === -1) break;
    let i = at + needle.length;

    // Optional column list.
    let columns = null;
    if (sql[i] === "(") {
      const end = sql.indexOf(")", i);
      columns = sql
        .slice(i + 1, end)
        .split(",")
        .map((c) => c.trim().replace(/^`|`$/g, ""));
      i = end + 1;
    }
    const valuesAt = sql.indexOf("VALUES", i);
    if (valuesAt === -1 || valuesAt - i > 10) {
      from = i;
      continue;
    }
    i = valuesAt + "VALUES".length;

    while (i < sql.length && sql[i] !== ";") {
      if (sql[i] !== "(") {
        i += 1;
        continue;
      }
      i += 1; // past '('
      const row = [];
      let value = "";
      let quoted = false;
      let inString = false;
      let done = false;
      while (!done && i < sql.length) {
        const ch = sql[i];
        if (inString) {
          if (ch === "\\") {
            const next = sql[i + 1];
            value +=
              next === "n" ? "\n"
              : next === "r" ? "\r"
              : next === "t" ? "\t"
              : next === "0" ? "\0"
              : next; // \' \" \\ and anything else → literal
            i += 2;
          } else if (ch === "'") {
            if (sql[i + 1] === "'") {
              value += "'";
              i += 2;
            } else {
              inString = false;
              i += 1;
            }
          } else {
            value += ch;
            i += 1;
          }
        } else if (ch === "'") {
          inString = true;
          quoted = true;
          value = ""; // drop whitespace accumulated before the opening quote
          i += 1;
        } else if (ch === "," || ch === ")") {
          row.push(
            quoted ? value : value.trim() === "NULL" ? null : value.trim(),
          );
          value = "";
          quoted = false;
          if (ch === ")") done = true;
          i += 1;
        } else {
          value += ch;
          i += 1;
        }
      }
      if (columns) {
        const obj = {};
        columns.forEach((col, idx) => {
          obj[col] = row[idx] ?? null;
        });
        rows.push(obj);
      } else {
        rows.push(row);
      }
    }
    from = i;
  }
  return rows;
}

/** Reads a field by column name (object rows) or index (positional rows). */
function field(row, name, index) {
  return Array.isArray(row) ? row[index] : row[name];
}

// ── Extract WordPress data ───────────────────────────────────────────────────

console.log("Parsing wp_posts (products)…");
const wpProducts = new Map(); // postId → { title, slug }
for (const row of parseInsertTuples("wp_posts")) {
  if (field(row, "post_type", 20) === "product") {
    wpProducts.set(String(field(row, "ID", 0)), {
      title: String(field(row, "post_title", 5) ?? "").trim(),
      slug: String(field(row, "post_name", 11) ?? "").trim().toLowerCase(),
    });
  }
}
console.log(`  WooCommerce products found: ${wpProducts.size}`);

console.log("Parsing wp_comments (reviews + replies)…");
const rawComments = parseInsertTuples("wp_comments");
const reviews = [];
const childComments = [];
let unapproved = 0;
for (const row of rawComments) {
  const type = field(row, "comment_type", 12);
  const parent = String(field(row, "comment_parent", 13));
  const approved = String(field(row, "comment_approved", 10));
  const dateGmt = field(row, "comment_date_gmt", 7);
  const dateLocal = field(row, "comment_date", 6);
  const base = {
    wpCommentId: String(field(row, "comment_ID", 0)),
    wpPostId: String(field(row, "comment_post_ID", 1)),
    author: String(field(row, "comment_author", 2) ?? "").trim(),
    email: String(field(row, "comment_author_email", 3) ?? "")
      .trim()
      .toLowerCase(),
    date: String(
      dateGmt && dateGmt !== "0000-00-00 00:00:00" ? dateGmt : dateLocal,
    ),
    content: String(field(row, "comment_content", 8) ?? "").trim(),
  };

  if (parent !== "0") {
    // Child comment — candidate admin/vendor reply. Only keep approved ones
    // ('1'); 'spam', 'trash', and '0' (unapproved) are ignored.
    if (approved === "1" && base.content) {
      childComments.push({ ...base, parent });
    }
    continue;
  }

  if (type !== "review") continue;
  if (approved !== "1") {
    unapproved += 1;
    continue;
  }
  reviews.push(base);
}
console.log(`  Approved reviews: ${reviews.length} (skipped ${unapproved} unapproved)`);

// Attach the earliest approved child comment to each review as the store reply.
const reviewIds = new Set(reviews.map((r) => r.wpCommentId));
const replyByReviewId = new Map();
childComments.sort((a, b) => a.date.localeCompare(b.date));
let orphanReplies = 0;
for (const child of childComments) {
  if (!reviewIds.has(child.parent)) {
    orphanReplies += 1; // reply to an order note / blog comment / removed review
    continue;
  }
  if (!replyByReviewId.has(child.parent)) {
    const when = new Date(child.date.replace(" ", "T") + "Z");
    replyByReviewId.set(child.parent, {
      author: child.author || "Store",
      message: child.content.slice(0, 2000),
      date: Number.isNaN(when.getTime()) ? null : when,
    });
  }
}
console.log(
  `  Admin replies matched to reviews: ${replyByReviewId.size} (ignored ${orphanReplies} non-review child comments)`,
);

console.log("Parsing wp_commentmeta (ratings)…");
const ratings = new Map();
for (const row of parseInsertTuples("wp_commentmeta")) {
  if (field(row, "meta_key", 2) === "rating") {
    const value = Number(field(row, "meta_value", 3));
    if (Number.isFinite(value)) {
      ratings.set(String(field(row, "comment_id", 1)), value);
    }
  }
}
console.log(`  Ratings found: ${ratings.size}`);

// ── Build candidate review docs ──────────────────────────────────────────────

const normalize = (s) =>
  s
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");

const candidates = [];
let noRating = 0;
let noProduct = 0;
let emptyBody = 0;
for (const review of reviews) {
  const product = wpProducts.get(review.wpPostId);
  if (!product) {
    noProduct += 1;
    continue;
  }
  const rating = ratings.get(review.wpCommentId);
  if (!rating || rating < 1 || rating > 5) {
    noRating += 1;
    continue;
  }
  if (!review.content) {
    emptyBody += 1;
    continue;
  }
  candidates.push({ ...review, rating: Math.round(rating), product });
}
console.log(
  `Candidates: ${candidates.length} (skipped — no product: ${noProduct}, no rating: ${noRating}, empty text: ${emptyBody})`,
);

// ── Match against MongoDB products & insert ──────────────────────────────────

const uri =
  process.env.MONGODB_URI ||
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .match(/^MONGODB_URI=(.*)$/m)[1]
    .trim();

await mongoose.connect(uri);
const db = mongoose.connection;
const productsCol = db.collection("products");
const reviewsCol = db.collection("product_reviews");

const mongoProducts = await productsCol
  .find({}, { projection: { title: 1, slug: 1 } })
  .toArray();
console.log(`MongoDB products: ${mongoProducts.length}`);

const bySlug = new Map();
const byTitle = new Map();
for (const p of mongoProducts) {
  if (p.slug) bySlug.set(String(p.slug).toLowerCase(), p);
  if (p.title) byTitle.set(normalize(String(p.title)), p);
}

const existingByLegacyId = new Map(
  (
    await reviewsCol
      .find(
        { legacyWpId: { $exists: true } },
        { projection: { legacyWpId: 1, adminReply: 1 } },
      )
      .toArray()
  ).map((d) => [d.legacyWpId, d]),
);

const toInsert = [];
const toUpdate = []; // already-imported reviews that now get a reply attached
const unmatched = new Map(); // wp product title → count
let duplicates = 0;
let repliesOnNew = 0;

for (const c of candidates) {
  const target =
    bySlug.get(c.product.slug) ?? byTitle.get(normalize(c.product.title));
  if (!target) {
    unmatched.set(c.product.title, (unmatched.get(c.product.title) ?? 0) + 1);
    continue;
  }
  const reply = replyByReviewId.get(c.wpCommentId);

  const existing = existingByLegacyId.get(c.wpCommentId);
  if (existing) {
    duplicates += 1;
    // Attach the migrated reply, but never overwrite a reply written on the
    // new site.
    if (reply && !String(existing.adminReply ?? "").trim()) {
      toUpdate.push({
        _id: existing._id,
        legacyWpId: c.wpCommentId,
        customer: c.author,
        reply,
      });
    }
    continue;
  }

  const when = new Date(c.date.replace(" ", "T") + "Z");
  if (reply) repliesOnNew += 1;
  toInsert.push({
    productId: target._id,
    productTitle: target.title,
    productSlug: target.slug,
    customerName: c.author || "Customer",
    customerEmail: c.email || undefined,
    rating: c.rating,
    body: c.content.slice(0, 4000),
    status: "published",
    legacyWpId: c.wpCommentId,
    ...(reply
      ? {
          adminReply: reply.message,
          adminReplyAuthor: reply.author,
          ...(reply.date ? { adminReplyAt: reply.date } : {}),
        }
      : {}),
    createdAt: Number.isNaN(when.getTime()) ? new Date() : when,
    updatedAt: Number.isNaN(when.getTime()) ? new Date() : when,
  });
}

console.log("");
console.log(`New reviews to import: ${toInsert.length} (${repliesOnNew} with admin reply)`);
console.log(`Already imported: ${duplicates} — of these, ${toUpdate.length} will get a reply attached`);
if (toUpdate.length > 0) {
  console.log("Replies to attach to existing reviews:");
  for (const u of toUpdate.slice(0, 15)) {
    console.log(
      `  - review by ${u.customer} ← "${u.reply.message.slice(0, 60)}" (${u.reply.author})`,
    );
  }
  if (toUpdate.length > 15) {
    console.log(`  … and ${toUpdate.length - 15} more`);
  }
}
if (unmatched.size > 0) {
  console.log(`Unmatched WooCommerce products (${unmatched.size}):`);
  for (const [title, count] of unmatched) {
    console.log(`  - ${title} (${count} review${count === 1 ? "" : "s"})`);
  }
}

if (!commit) {
  console.log("\nDry run only — re-run with --commit to write these changes.");
  await mongoose.disconnect();
  process.exit(0);
}

if (toUpdate.length > 0) {
  for (const u of toUpdate) {
    await reviewsCol.updateOne(
      { _id: u._id },
      {
        $set: {
          adminReply: u.reply.message,
          adminReplyAuthor: u.reply.author,
          ...(u.reply.date ? { adminReplyAt: u.reply.date } : {}),
        },
      },
    );
  }
  console.log(`\nAttached replies to ${toUpdate.length} existing reviews.`);
}

if (toInsert.length > 0) {
  await reviewsCol.insertMany(toInsert);
  console.log(`\nInserted ${toInsert.length} reviews.`);

  // Recompute each affected product's ratings summary (published reviews only).
  const affected = [...new Set(toInsert.map((d) => String(d.productId)))];
  for (const id of affected) {
    const productId = new mongoose.Types.ObjectId(id);
    const published = await reviewsCol
      .find({ productId, status: "published" }, { projection: { rating: 1 } })
      .toArray();
    const count = published.length;
    const avg =
      count > 0 ? published.reduce((s, r) => s + r.rating, 0) / count : 0;
    await productsCol.updateOne(
      { _id: productId },
      { $set: { ratings: { avg: Math.round(avg * 10) / 10, count } } },
    );
  }
  console.log(`Updated ratings summary for ${affected.length} products.`);
} else {
  console.log("\nNothing new to insert.");
}

await mongoose.disconnect();
console.log("Done.");
