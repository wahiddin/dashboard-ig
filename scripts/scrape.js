// scripts/scrape.js
// Dipanggil oleh GitHub Actions. Baca config.yml, panggil Apify, tulis data/data.json
// dengan skema yang dipakai index.html (profile.followersCount, posts[].likesCount, dst).

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const APIFY_TOKEN = process.env.APIFY_TOKEN;
if (!APIFY_TOKEN) {
  console.error("APIFY_TOKEN belum di-set sebagai GitHub Secret.");
  process.exit(1);
}

const ROOT = path.join(__dirname, "..");
const config = yaml.load(fs.readFileSync(path.join(ROOT, "config.yml"), "utf8"));

const USERNAME = config.instagram_username;
const POSTS_LIMIT = config.posts_limit || 30;
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

// Ubah field mentah Apify jadi tipe konten yang dipahami dashboard: Image / Video / Sidecar
function normalizeType(rawType) {
  const t = (rawType || "").toLowerCase();
  if (t.includes("sidecar") || t.includes("carousel")) return "Sidecar";
  if (t.includes("video") || t.includes("reel")) return "Video";
  return "Image";
}

// Timestamp Apify bisa berupa ISO string atau unix seconds — normalisasi ke 'YYYY-MM-DD'
function toDateString(ts) {
  if (!ts) return new Date().toISOString().slice(0, 10);
  const d = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  return isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

function parseApifyResult(items) {
  // Actor instagram-scraper biasanya mengembalikan 1 object profil
  // dengan field latestPosts di dalamnya. Sesuaikan mapping ini kalau
  // kamu ganti actor Apify-nya.
  const profileRaw = items[0] || {};
  const rawPosts = profileRaw.latestPosts || profileRaw.topPosts || [];

  const posts = rawPosts.slice(0, POSTS_LIMIT).map((p) => ({
    id: p.id || p.shortCode || String(Math.random()).slice(2),
    url: p.url || (p.shortCode ? `https://www.instagram.com/p/${p.shortCode}/` : ""),
    displayUrl: p.displayUrl || p.thumbnailSrc || "",
    caption: p.caption || "",
    likesCount: p.likesCount ?? 0,
    commentsCount: p.commentsCount ?? 0,
    timestamp: toDateString(p.timestamp || p.takenAtTimestamp),
    type: normalizeType(p.type),
    videoViewCount: p.videoViewCount ?? p.videoPlayCount ?? null,
  }));

  return {
    profile: {
      username: profileRaw.username || USERNAME,
      displayName: config.display_name || profileRaw.fullName || USERNAME,
      followersCount: profileRaw.followersCount ?? 0,
      followingCount: profileRaw.followsCount ?? 0,
      postsCount: profileRaw.postsCount ?? posts.length,
      bio: profileRaw.biography || "",
    },
    posts,
  };
}

// Gabungkan snapshot followers hari ini ke histori yang sudah ada,
// supaya grafik pertumbuhan followers punya data dari waktu ke waktu.
function updateHistory(existingHistory, followersCount) {
  const history = Array.isArray(existingHistory) ? existingHistory.slice() : [];
  const today = new Date().toISOString().slice(0, 10);
  const withoutToday = history.filter((h) => h.date !== today);
  withoutToday.push({ date: today, followers: followersCount });
  withoutToday.sort((a, b) => a.date.localeCompare(b.date));
  // Simpan maksimal 180 titik data (~6 bulan harian) biar file tidak membengkak
  return withoutToday.slice(-180);
}

async function main() {
  console.log(`Scraping @${USERNAME} ...`);

  let existingHistory = [];
  if (fs.existsSync(DATA_PATH)) {
    try {
      const existing = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
      existingHistory = existing.history || [];
    } catch (e) {
      console.warn("Tidak bisa baca data.json lama, mulai histori baru.", e.message);
    }
  }

  const items = await runScrape();
  const { profile, posts } = parseApifyResult(items);

  const output = {
    profile,
    posts,
    history: updateHistory(existingHistory, profile.followersCount),
    updatedAt: new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(output, null, 2));
  console.log(`Selesai. Followers: ${profile.followersCount}, Posts tersimpan: ${posts.length}, Titik histori: ${output.history.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
