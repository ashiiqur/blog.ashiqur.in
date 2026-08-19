/**
 * generate-og-images.js
 *
 * Renders og-preview.html once per link/page and saves each result as a
 * static 1200x630 PNG. Real social crawlers (Facebook, X, Discord, Slack,
 * iMessage, LinkedIn...) fetch whatever URL is in <meta property="og:image">
 * directly - they do NOT run JavaScript - so the dynamic HTML template
 * can't be the thing you link to. This script is what turns "dynamic
 * template + params" into "one static file per page" so og:image has
 * something real to point at.
 *
 * Setup (once):
 *   npm i -D playwright
 *   npx playwright install chromium
 *
 * Run:
 *   node generate-og-images.js
 *
 * Output:
 *   assets/og/<file>.png  - one per entry in TARGETS below
 */

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

// One entry per link that needs its own card.
// `page` pulls a preset baked into og-preview.html (home/blog/about/contact/404).
// eyebrow/title/desc, if given, override that preset - handy for one-off
// pages like individual blog posts that don't have a preset of their own.
const TARGETS = [
  { file: "home" },
  { file: "blog", page: "blog" },
  { file: "about", page: "about" },
  { file: "contact", page: "contact" },
  { file: "404", page: "404" },

  // individual posts - one entry per folder inside blog/O
  { file: "blog-a-note-on-books", eyebrow: "ENTRIES", title: "A Note on Books", desc: "A Note on something called book.", link: "blog.ashiqur.in/blog/a-note-on-books" },
  { file: "blog-finding-focus-through-sound", eyebrow: "ENTRIES", title: "Finding Focus Through Sound", desc: "Making a sound Nostalgic.", link: "blog.ashiqur.in/blog/finding-focus-through-sound" },
  { file: "blog-on-the-discipline-of-doing-less", eyebrow: "ENTRIES", title: "On the Discipline of Doing Less", desc: "Doing less doesn't mean doing nothing.", link: "blog.ashiqur.in/blog/on-the-discipline-of-doing-less" },

  // two more folders were visible in your screenshot but covered/illegible -
  // send me those slugs and I'll add matching entries the same way.
];

const TEMPLATE_URL = "file://" + path.resolve(__dirname, "og-preview.html");
const OUT_DIR = path.resolve(__dirname, "assets/og");

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

  for (const t of TARGETS) {
    const params = new URLSearchParams();
    if (t.page) params.set("page", t.page);
    if (t.eyebrow) params.set("eyebrow", t.eyebrow);
    if (t.title) params.set("title", t.title);
    if (t.desc) params.set("desc", t.desc);
    if (t.link) params.set("link", t.link);
    if (t.theme) params.set("theme", t.theme);

    await page.goto(`${TEMPLATE_URL}?${params.toString()}`);
    await page.evaluate(() => document.fonts.ready); // wait for webfonts before capturing

    const outPath = path.join(OUT_DIR, `${t.file}.png`);
    await page.screenshot({ path: outPath });
    console.log("wrote", path.relative(process.cwd(), outPath));
  }

  await browser.close();
})();
