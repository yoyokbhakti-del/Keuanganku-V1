# KeuanganKu — Personal Finance & Debt Tracker (PWA)

Vanilla JS + Tailwind (compiled ke `styles.css`), data di IndexedDB, offline 100%.

## Deploy ke Vercel
1. `git init && git add . && git commit -m "init"` lalu push ke GitHub.
2. Vercel → Add New Project → import repo. Framework: **Other**. Tanpa build command (sudah diatur di `vercel.json`).
3. Buka URL di Safari iPhone → Bagikan → Tambah ke Layar Utama.

## Mengubah tampilan
Edit class Tailwind di `app.js` / `index.html`, lalu `npm install` (sekali) dan `npm run build:css`, commit `styles.css`.

## Setiap deploy perubahan
Naikkan `VERSION` di `sw.js` supaya cache lama diganti (pengguna akan melihat toast "Versi baru tersedia").

## Sinkronisasi cloud (Supabase)
Tabel `kf_snapshots` (RLS per pengguna) sudah dibuat di project Supabase `keuanganku`.
Aplikasi: Lainnya → Sinkronisasi Cloud → Daftar / Masuk. Konfigurasi ada di konstanta `SB` pada `app.js`.
