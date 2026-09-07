// Temp check: JSON-LD block counts + meta basics for a set of pages.
const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const pages = ["/", "/pubg-mobile-uc", "/category/games-top-up", "/products"];
for (const path of pages) {
  const html = await (await fetch(`${base}${path}`)).text();
  const blocks = [
    ...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs),
  ];
  const types = [];
  for (const [, raw] of blocks) {
    const json = JSON.parse(raw);
    for (const item of Array.isArray(json) ? json : [json]) {
      types.push(item["@type"]);
    }
  }
  const title = html.match(/<title>(.*?)<\/title>/s)?.[1] ?? "(none)";
  const canonical =
    html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? "(none)";
  const dupes = types.filter((t, i) => types.indexOf(t) !== i);
  console.log(`\n${path}`);
  console.log(`  title: ${title.slice(0, 80)}`);
  console.log(`  canonical: ${canonical}`);
  console.log(`  JSON-LD: ${types.join(", ")}`);
  console.log(`  duplicate schema types: ${dupes.length ? dupes.join(", ") : "none"}`);
}
