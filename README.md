# Bantu Beres Guru AI — GroqCloud Netlify migration

Dua versi aplikasi asli dipertahankan secara terpisah:

- `sites/guru-ai-utama/` untuk `https://cosmic-douhua-efc8e2.netlify.app/` (HTML tunggal asli)
- `sites/guru-ai-v2/` untuk `https://bantuberes-guru-ai-v2.netlify.app/`

## Perubahan 8 November 2026

Gemini diganti menjadi GroqCloud dengan **API key pribadi** (`gsk_...`) melalui menu Workspace. Tutorial menjadi GroqCloud Console (https://console.groq.com/keys), dengan pemilihan model otomatis dari API models dan fallback model cadangan. Setiap aplikasi menampilkan pemberitahuan update.

**Tidak ada data pengguna yang dihapus.** Key localStorage lama tetap `bbe_projects`, `bbe_outputs`, `bbe_versions`, `bbe_chat`, `bbe_active_project`, dan `bbe_credential` untuk versi utama serta `bantuberes-guru-ai-v2` untuk V2. API key Gemini lama tidak dipakai untuk permintaan Groq. Pengguna mengganti key pada Workspace.

GroqCloud tidak mengizinkan pemanggilan langsung dari browser lintas origin pada beberapa lingkungan. Aplikasi memakai fungsi `netlify/functions/groq-api.mjs` sebagai proxy sesama origin. Kunci pribadi disimpan lokal pada browser dan dikirim per permintaan ke Netlify Function, lalu diteruskan ke GroqCloud melalui TLS. **Key tidak disimpan oleh Netlify Function**, tetapi perangkat bersama masih berisiko karena penyimpanan lokal.

## Penerbitan pada proyek Netlify yang sudah ada

Kedua situs Netlify ditemukan berstatus deploy upload manual, **tidak terhubung ke Git**. Mengubah repo GitHub ini belum mengubah situs Netlify secara otomatis.

Untuk memperbarui setiap situs yang sudah ada dengan Netlify Function, hubungkan repo ini melalui Netlify Git continuous deployment dan atur Base directory ke folder masing-masing di atas. Netlify membaca `netlify.toml` sehingga publish directory adalah `public` dan function directory `netlify/functions`. Alternatif Netlify CLI dari folder proyek: `netlify deploy --prod --dir public --functions netlify/functions` setelah mengaitkan project yang tepat. Jangan mengirim folder `public` saja melalui drag-and-drop, karena fungsi server akan hilang.

Uji sebelum menganggap deployment selesai: status function selain 404, validasi key Groq, model auto, generator, chat, tutorial, banner pembaruan, dan localStorage lama.

PENTING: source ini direkonstruksi dari halaman publik yang berjalan. Kedua situs Netlify tidak memiliki repositori Git terhubung sehingga repository ini bukan jaminan bahwa Netlify sudah menggunakan kode terbaru.

## Video tutorial resmi pengguna (9 November 2026)

Video cara membuat, menyalin dan memasukkan API key GroqCloud telah disematkan pada menu **Workspace** di kedua versi Guru AI: https://youtu.be/WBX9Yvk4eKs. Key pengguna harus diawali `gsk_`, dan model dipilih otomatis dari model yang tersedia pada akun GroqCloud. Masa berlaku key tidak sama dengan kuota penggunaan AI.

GitHub Actions sekarang menyiapkan paket build untuk kedua situs Netlify. Setelah pengujian lulus pada branch `main`, workflow juga mencoba deploy langsung ke **dua site ID asli** melalui Netlify CLI jika tersedia secret repository `NETLIFY_AUTH_TOKEN`. Tanpa kredensial tersebut, deploy produksi tidak dilakukan meskipun QA berhasil; hubungkan masing-masing proyek Netlify ke foldernya atau konfigurasi satu secret itu untuk mengaktifkan deployment otomatis.
