/**
 * Diagnostic script — dumps raw price HTML from Canyon outlet tiles.
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/debug-canyon-prices.ts
 */

import * as cheerio from "cheerio";

async function main() {
  const res = await fetch("https://www.canyon.com/en-no/outlet-bikes/", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-NO,en;q=0.9,nb;q=0.8",
    },
    signal: AbortSignal.timeout(15_000),
  });

  const html = await res.text();
  const $ = cheerio.load(html);

  const links = $("a.productTileDefault__imageLink");
  console.log(`\nFound ${links.length} image links\n`);

  // Show first 3 tiles in full
  links.slice(0, 3).each((i, el) => {
    const ariaLabel = $(el).attr("aria-label") ?? "(none)";
    console.log(`\n--- Tile ${i + 1} ---`);
    console.log(`aria-label: ${ariaLabel}`);

    // Walk UP from the link and show outer HTML of each ancestor (class names only)
    let node = $(el).parent();
    let depth = 0;
    while (depth < 6 && node.length) {
      const cls = node.attr("class") ?? "";
      console.log(`  ancestor[${depth}] class="${cls.slice(0, 120)}"`);
      node = node.parent();
      depth++;
    }

    // Try the current selectors
    const tileEl = $(el).closest(".productTile, [class*='productTile']");
    console.log(`  closest(.productTile) found: ${tileEl.length > 0 ? tileEl.attr("class")?.slice(0, 80) : "NOTHING"}`);

    const sTag1 = tileEl.find("s.productTile__priceOriginal").first();
    console.log(`  s.productTile__priceOriginal: "${sTag1.text().trim() || "NOT FOUND"}"`);

    const sTag2 = tileEl.find("s[class*='priceOriginal']").first();
    console.log(`  s[class*='priceOriginal']: "${sTag2.text().trim() || "NOT FOUND"}"`);

    const sTagAny = tileEl.find("s").first();
    console.log(`  any <s> in tile: "${sTagAny.text().trim() || "NOT FOUND"}" class="${sTagAny.attr("class") ?? ""}"`);

    const parentS = $(el).parent().find("s").first();
    console.log(`  <s> in direct parent: "${parentS.text().trim() || "NOT FOUND"}"`);

    // Show all <s> tags anywhere in tile
    const allS = tileEl.find("s");
    allS.each((j, s) => {
      console.log(`  <s>[${j}] class="${$(s).attr("class") ?? ""}" text="${$(s).text().trim()}"`);
    });

    // Show all elements with "price" in class name
    tileEl.find("[class*='price'], [class*='Price']").each((j, priceEl) => {
      const cls2 = $(priceEl).attr("class") ?? "";
      console.log(`  price-element[${j}] <${priceEl.tagName}> class="${cls2}" text="${$(priceEl).text().trim().slice(0, 60)}"`);
    });
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
