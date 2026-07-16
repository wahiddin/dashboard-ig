// scripts/scrape.js
// Dipanggil oleh GitHub Actions. Baca config.yml, panggil Apify, tulis data/data.json.

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const APIFY_TOKEN = process.env.APIFY_TOKEN;
if (!APIFY_TOKEN) {
  console.error("apify_api_vXDCvwCARp33Q4GX0lOs47AoRslgDj2jll5b");
  process.exit(1);
}

const ROOT = path.join(__dirname, "..");
const config = yaml.load(fs.readFileSync(path.join(ROOT, "config.yml"), "utf8"));

const USERNAME = config.instagram_username;
const POSTS_LIMIT = config.posts_limit || 24;
const DATA_PATH = path.join(ROOT, "data", "data.json");

// Actor Apify yang dipakai: apify/instagram-scraper
// (bisa diganti actor lain selama bentuk outputnya disesuaikan di parseApifyResult)
const ACTOR = "apify~instagram-scraper";
const APIFY_URL = `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;

async function runScrape() {
  const res = await fetch(APIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      directUrls: [`https://www.instagram.com/${USERNAME}/`],
      resultsType: "details",
      resultsLimit: POSTS_LIMIT,
      searchType: "user",
    }),
  });

  if (!res.ok) {
    throw new Error(`Apify request gagal: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

function parseApifyResult(items) {
  // Actor instagram-scraper biasanya mengembalikan 1 object profil
  // dengan field latestPosts di dalamnya. Sesuaikan mapping ini kalau
  // kamu ganti actor Apify-nya.
  const profile = items[0] || {};
  const rawPosts = profile.latestPosts || profile.topPosts || [];

  const posts = rawPosts.slice(0, POSTS_LIMIT).map((p) => ({
    id: p.id || p.shortCode,
    url: p.url || `https://www.instagram.com/p/${p.shortCode}/`,
    thumbnail: p.displayUrl || p.thumbnailSrc || "",
    caption: (p.caption || "").slice(0, 140),
    likes: p.likesCount ?? 0,
    comments: p.commentsCount ?? 0,
    timestamp: p.timestamp || p.takenAtTimestamp || null,
    type: p.type || "Image",
  }));

  return {
    username: profile.username || USERNAME,
    display_name: config.display_name || profile.fullName || USERNAME,
    profile_pic: profile.profilePicUrlHD || profile.profilePicUrl || "",
    bio: profile.biography || "",
    followers: profile.followersCount ?? 0,
    following: profile.followsCount ?? 0,
    posts_count: profile.postsCount ?? posts.length,
    posts,
  };
}

function updateHistory(existing, snapshot) {
  const history = existing?.history || [];
  const today = new Date().toISOString().slice(0, 10);

  const withoutToday = history.filter((h) => h.date !== today);
  withoutToday.push({
    date: today,
    followers: snapshot.followers,
    posts_count: snapshot.posts_count,
  });

  // Simpan maksimal 180 titik data (~6 bulan harian) biar file tidak membengkak
  return withoutToday.slice(-180);
}

async function main() {
  console.log(`Scraping @${dinwahidd} ...`);

  let existing = null;
  if (fs.existsSync(DATA_PATH)) {
    existing = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  }

  const items = await runScrape();
  const snapshot = parseApifyResult(items);

  const output = {
    ...snapshot,
    last_updated: new Date().toISOString(),
    history: updateHistory(existing, snapshot),
  };

  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(output, null, 2));
  console.log(`Selesai. Followers: ${output.followers}, Posts: ${output.posts.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
