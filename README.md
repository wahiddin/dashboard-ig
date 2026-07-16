# Instagram Analytics Kit

Dashboard analitik Instagram yang auto-update. Ganti 1 nama akun, dapet dashboard jalan sendiri.

## Cara pakai (buat pembeli, 5 menit)

### 1. Dapatkan Apify API Token
- Daftar di [apify.com](https://apify.com) (ada free tier).
- Buka **Settings → Integrations**, copy **API token** kamu.

### 2. Simpan token sebagai GitHub Secret
- Di repo ini: **Settings → Secrets and variables → Actions → New repository secret**
- Name: `APIFY_TOKEN`
- Value: token dari langkah 1

### 3. Edit `config.yml`
Ganti `instagram_username` dengan akun yang mau dipantau. Simpan (commit).

### 4. Jalankan scrape pertama kali
- Buka tab **Actions** di repo ini
- Pilih workflow **Scrape Instagram Data** → **Run workflow**
- Tunggu ±1 menit, `data/data.json` akan otomatis ter-update

### 5. Deploy ke Vercel
- Import repo ini di [vercel.com/new](https://vercel.com/new)
- Framework preset: **Other** (ini static HTML, tidak perlu build command)
- Deploy

Setelah ini, dashboard update sendiri sesuai jadwal di `.github/workflows/scrape.yml` (default: tiap hari), dan Vercel otomatis redeploy tiap kali `data.json` berubah.

## Struktur file

```
config.yml                  ← satu-satunya file yang perlu diedit pembeli
index.html                  ← tampilan dashboard
data/data.json               ← data hasil scrape (auto-generated)
scripts/scrape.js            ← logic pemanggilan Apify
.github/workflows/scrape.yml ← jadwal otomatis (cron)
```

## Kustomisasi lanjutan
- **Ganti frekuensi scrape:** edit baris `cron:` di `.github/workflows/scrape.yml` (format cron, UTC).
- **Ganti actor Apify:** ganti konstanta `ACTOR` di `scripts/scrape.js`, sesuaikan `parseApifyResult()` dengan bentuk output actor tersebut.
- **Ganti tampilan/warna:** semua di dalam `<style>` pada `index.html`, pakai CSS variable di `:root`.

## Catatan penting (baca sebelum jual ulang)
- Tiap pembeli butuh **token Apify miliknya sendiri** — jangan share token kamu. Biaya scraping jadi tanggungan masing-masing pembeli via akun Apify mereka (ada free tier bulanan).
- Scraping data publik Instagram lewat pihak ketiga berpotensi melanggar Terms of Service Instagram. Ini risiko yang ditanggung pengguna akun Apify yang menjalankan scraping — sampaikan ini secara transparan ke pembeli kit, jangan disembunyikan.
- Repo GitHub harus **public** kalau kamu pakai GitHub Actions gratis di akun free tier untuk private repo dengan batas menit terbatas — cek kembali limit Actions di paket GitHub pembeli.
