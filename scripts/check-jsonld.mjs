// Temp check: extract and print JSON-LD blocks from a product page.
const slug = process.argv[2] ?? "razer-gold-pin";
const base = (process.argv[3] ?? "http://localhost:3000").replace(/\/$/, "");
const html = await (await fetch(`${base}/${slug}`)).text();
const blocks = [
  ...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs),
];
console.log(`JSON-LD blocks on /${slug}: ${blocks.length}`);
for (const [, raw] of blocks) {
  const json = JSON.parse(raw);
  const items = Array.isArray(json) ? json : [json];
  for (const item of items) {
    console.log(`\n=== @type: ${item["@type"]} ===`);
    if (item["@type"] === "Product") {
      console.log(JSON.stringify(item, null, 1));
    } else {
      console.log(JSON.stringify(item).slice(0, 500));
    }
  }
}
