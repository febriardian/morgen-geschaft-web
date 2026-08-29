# Kebijakan Keamanan

Keamanan pelanggan, transaksi, dan integrasi provider merupakan bagian penting
dari Morgen Geschäft.

## Versi yang didukung

Perbaikan keamanan diterapkan pada branch `main` dan rilis stabil terbaru.

## Melaporkan kerentanan

Laporkan kerentanan secara privat melalui fitur **Security Advisories** pada
repository GitHub. Jangan membuat issue publik yang berisi langkah eksploitasi,
credential, token, data pelanggan, atau informasi transaksi.

Sertakan informasi berikut agar laporan dapat diverifikasi:

- komponen atau endpoint yang terdampak;
- versi atau commit yang diuji;
- dampak yang dapat diamati;
- langkah reproduksi yang aman;
- bukti teknis yang sudah disamarkan;
- saran perbaikan jika tersedia.

Laporan akan ditinjau berdasarkan dampak, keterulangan, dan jangkauan komponen.
Status penanganan disampaikan melalui percakapan privat pada advisory terkait.

## Ruang lingkup

Ruang lingkup mencakup frontend, backend API, autentikasi, otorisasi admin,
checkout, webhook, pengiriman, upload, Firestore rules, dan konfigurasi publik
yang berada dalam repository ini. Gangguan pada layanan pihak ketiga dilaporkan
langsung kepada penyedia layanan tersebut.

## Penanganan data

Gunakan data uji dan akun milik sendiri ketika melakukan verifikasi. Jangan
mengakses, mengubah, mengunduh, atau menyebarkan data pelanggan dan transaksi
yang bukan milik penguji.
