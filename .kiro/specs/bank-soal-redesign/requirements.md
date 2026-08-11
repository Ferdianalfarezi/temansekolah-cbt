# Requirements Document

## Introduction

Redesain arsitektur Bank Soal untuk sistem CBT Teman Sekolah. Saat ini, `cbt_question` adalah tabel flat dimana setiap baris adalah 1 soal individual tanpa kontainer (bank soal). Metadata seperti mata pelajaran, kelas target, dan durasi harus diinput per-soal, bukan per-bank.

Solusi yang benar adalah memisahkan entitas **Bank Soal** sebagai kontainer yang mengelompokkan soal-soal, dengan alur:
1. **Buat Bank Soal** → pilih mata pelajaran, target kelas, pengaturan ujian (durasi, passing grade, opsi acak)
2. **Masuk detail Bank Soal** → tambah soal satu per satu atau bulk import (semua soal mewarisi pengaturan bank)
3. **Paket ke Sesi Ujian** → jadwalkan ujian dengan tanggal/waktu spesifik

Redesain ini menghilangkan duplikasi metadata dan menyederhanakan UX pembuatan soal.

## Glossary

- **Bank_Soal**: Kontainer yang mengelompokkan kumpulan soal untuk satu mata pelajaran dan target kelas tertentu
- **Soal**: Pertanyaan individual dalam Bank Soal, terdiri dari teks soal, opsi jawaban (A-E), dan jawaban benar
- **Mata_Pelajaran**: Subject/pelajaran (matematika, fisika, bahasa indonesia, dll)
- **Kelas**: Kelas siswa spesifik (misal: 10A, 10B)
- **Tingkat**: Jenjang kelas (1-12) untuk tingkat SD-SMA
- **Target_Peserta**: Kelas-kelas yang akan mengikuti ujian dari bank soal ini
- **Pelaksanaan_Ujian**: Periode ujian aktif (misal: UTS Semester 1 2024/2025)
- **Sesi_Ujian**: Instance ujian terjadwal yang menggunakan soal dari Bank Soal
- **Guru**: Pengguna dengan role guru yang membuat dan mengelola bank soal sesuai mata pelajaran yang diajar
- **Proktor**: Pengguna (biasanya guru) yang mengawasi pelaksanaan sesi ujian
- **Durasi**: Lama waktu pengerjaan ujian dalam menit
- **KKM**: Kriteria Ketuntasan Minimal (passing grade)
- **Shuffle_Options**: Pengaturan untuk mengacak urutan opsi jawaban
- **Shuffle_Questions**: Pengaturan untuk mengacak urutan soal

## Requirements

### Requirement 1: Membuat Bank Soal Baru

**User Story:** Sebagai Guru, saya ingin membuat bank soal baru dengan pengaturan mata pelajaran dan target peserta, agar soal-soal dapat dikelompokkan dengan konfigurasi yang konsisten.

#### Acceptance Criteria

1. WHEN Guru memilih menu "Buat Bank Soal", THE System SHALL menampilkan form dengan field: nama bank soal, mata pelajaran, target kelas (multi-select), tingkat (jika tidak memilih kelas spesifik), durasi ujian (menit), KKM (0-100), shuffle questions (boolean), dan shuffle options (boolean)
2. THE System SHALL membatasi pilihan mata pelajaran hanya pada mata pelajaran yang diajar oleh Guru tersebut berdasarkan jadwal_pelajaran
3. THE System SHALL membatasi pilihan target kelas hanya pada kelas yang diajar oleh Guru tersebut berdasarkan jadwal_pelajaran
4. WHEN Guru memilih tingkat tanpa memilih kelas spesifik, THE System SHALL menjadikan bank soal berlaku untuk semua kelas pada tingkat tersebut
5. WHEN Guru memilih kelas spesifik, THE System SHALL mengabaikan field tingkat dan menggunakan kelas yang dipilih sebagai target peserta
6. THE System SHALL memvalidasi durasi ujian berada dalam rentang 5-360 menit
7. THE System SHALL memvalidasi KKM berada dalam rentang 0-100
8. WHEN Guru menyimpan bank soal baru, THE System SHALL membuat record Bank_Soal dengan status "draft" dan pelaksanaan_ujian_id dari pelaksanaan ujian aktif
9. IF tidak ada pelaksanaan ujian aktif untuk tenant, THEN THE System SHALL menampilkan pesan error "Tidak ada pelaksanaan ujian aktif. Hubungi admin."

### Requirement 2: Mengelola Soal dalam Bank Soal

**User Story:** Sebagai Guru, saya ingin menambah, mengedit, dan menghapus soal dalam bank soal, agar saya dapat menyusun kumpulan soal yang lengkap untuk ujian.

#### Acceptance Criteria

1. WHEN Guru membuka detail Bank Soal, THE System SHALL menampilkan daftar soal yang sudah ada dengan nomor urut, preview teks soal, dan jawaban benar
2. WHEN Guru menambah soal baru, THE System SHALL menampilkan form dengan field: teks soal, opsi A-E (E opsional), jawaban benar (A-E), dan upload gambar untuk soal/opsi
3. THE System SHALL memvalidasi jawaban benar "E" hanya dapat dipilih jika opsi E diisi
4. THE System SHALL memvalidasi panjang teks soal 1-2000 karakter
5. THE System SHALL memvalidasi panjang setiap opsi 1-500 karakter
6. WHEN Guru menyimpan soal baru, THE System SHALL otomatis mengaitkan soal dengan bank_soal_id dan mewarisi mata_pelajaran_id serta target kelas dari Bank Soal
7. WHEN Guru mengedit soal yang sudah ada, THE System SHALL menyimpan perubahan tanpa mengubah bank_soal_id
8. WHEN Guru menghapus soal, THE System SHALL menghapus soal dari database
9. IF Bank Soal sudah digunakan dalam Sesi_Ujian dengan status "packaged", "active", atau "completed", THEN THE System SHALL menolak semua operasi edit dan hapus soal dengan pesan "Soal tidak dapat diubah karena bank soal sudah digunakan dalam sesi ujian yang terkunci", tanpa memproses validasi field terlebih dahulu
10. IF Bank Soal BELUM digunakan dalam Sesi_Ujian yang terkunci, THEN THE System SHALL menampilkan dialog konfirmasi sebelum mengedit atau menghapus soal, dengan pesan "Apakah Anda yakin ingin mengubah/menghapus soal ini?"

### Requirement 3: Import Soal Secara Bulk

**User Story:** Sebagai Guru, saya ingin mengimpor banyak soal sekaligus dari file Excel, agar proses input soal lebih efisien.

#### Acceptance Criteria

1. WHEN Guru mengupload file Excel, THE System SHALL memparse file dan menampilkan preview soal yang akan diimpor
2. THE System SHALL memvalidasi format kolom Excel: nomor_soal, teks_soal, jawaban_benar, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e
3. IF terdapat baris dengan error (teks_soal kosong, jawaban_benar tidak valid, opsi A-D kosong), THEN THE System SHALL menampilkan daftar error per baris
4. WHEN Guru mengkonfirmasi import, THE System SHALL menyimpan semua soal valid ke database dengan bank_soal_id yang sama
5. THE System SHALL menyediakan template Excel untuk diunduh dengan contoh format yang benar

### Requirement 4: Melihat Daftar Bank Soal

**User Story:** Sebagai Guru, saya ingin melihat daftar bank soal yang telah saya buat, agar saya dapat mengelola dan memilih bank soal untuk dijadikan sesi ujian.

#### Acceptance Criteria

1. WHEN Guru membuka halaman Bank Soal, THE System SHALL menampilkan daftar bank soal dalam pelaksanaan ujian aktif yang dibuat oleh Guru tersebut atau yang mata pelajarannya diajar oleh Guru tersebut
2. THE System SHALL menampilkan informasi: nama bank soal, mata pelajaran, jumlah soal, target kelas, durasi, status, dan tanggal dibuat
3. WHEN Guru menggunakan filter mata pelajaran, THE System SHALL menampilkan hanya bank soal dengan mata pelajaran yang dipilih
4. WHEN Guru menggunakan filter tingkat, THE System SHALL menampilkan hanya bank soal dengan target tingkat yang dipilih
5. WHEN Guru menggunakan pencarian, THE System SHALL mencari berdasarkan nama bank soal

### Requirement 5: Mengubah Pengaturan Bank Soal

**User Story:** Sebagai Guru, saya ingin mengubah pengaturan bank soal seperti durasi dan KKM, agar saya dapat menyesuaikan konfigurasi ujian.

#### Acceptance Criteria

1. WHEN Guru membuka form edit Bank Soal, THE System SHALL menampilkan semua field pengaturan dengan nilai saat ini
2. THE System SHALL memvalidasi perubahan durasi berada dalam rentang 5-360 menit, dan KKM berada dalam rentang 0-100
3. THE System SHALL tidak mengizinkan perubahan mata pelajaran karena akan mempengaruhi scope soal yang sudah ada
4. IF Bank Soal sudah digunakan dalam Sesi_Ujian dengan status "packaged", "active", atau "completed", THEN THE System SHALL menolak perubahan dengan pesan "Bank soal tidak dapat diubah karena sudah digunakan dalam sesi ujian yang terkunci"
5. WHEN perubahan disimpan, THE System SHALL memperbarui updatedAt timestamp

### Requirement 6: Menghapus Bank Soal

**User Story:** Sebagai Guru, saya ingin menghapus bank soal yang tidak terpakai, agar daftar bank soal tetap rapi.

#### Acceptance Criteria

1. WHEN Guru memilih hapus bank soal, THE System SHALL menampilkan konfirmasi dengan jumlah soal yang akan ikut terhapus
2. IF Bank Soal belum digunakan dalam Sesi_Ujian manapun, THEN THE System SHALL menghapus bank soal beserta semua soal di dalamnya
3. IF Bank Soal sudah digunakan dalam Sesi_Ujian (apapun statusnya termasuk "draft"), THEN THE System SHALL menolak penghapusan dengan pesan "Bank soal tidak dapat dihapus karena sudah pernah digunakan dalam sesi ujian"
4. WHEN bank soal berhasil dihapus, THE System SHALL mencatat audit log dengan informasi bank soal dan jumlah soal yang dihapus

### Requirement 7: Membuat Sesi Ujian dari Bank Soal

**User Story:** Sebagai Guru/Proktor, saya ingin membuat sesi ujian terjadwal menggunakan soal dari bank soal, agar siswa dapat mengerjakan ujian pada waktu yang ditentukan.

#### Acceptance Criteria

1. WHEN Guru memilih "Jadwalkan Ujian" dari Bank Soal, THE System SHALL menampilkan form dengan field: tanggal dan waktu mulai, kelas peserta (dari target kelas bank soal), proktor (default: Guru yang membuat)
2. THE System SHALL menggunakan durasi, shuffle questions, dan shuffle options dari pengaturan Bank Soal
3. WHEN sesi ujian dibuat, THE System SHALL menyalin soal dari Bank Soal ke cbt_exam_session_question dengan nomor urut
4. THE System SHALL membuat record cbt_exam_session dengan status "draft" dan mata_pelajaran_id dari Bank Soal
5. IF Bank Soal memiliki 0 soal, THEN THE System SHALL menolak pembuatan sesi ujian dengan pesan "Bank soal belum memiliki soal"; jika gagal karena alasan lain (misal: validasi tanggal, kelas tidak valid), THE System SHALL menampilkan pesan error spesifik sesuai penyebab kegagalan

### Requirement 8: Migrasi Data Soal Existing

**User Story:** Sebagai Admin, saya ingin data soal yang sudah ada di sistem lama tetap dapat diakses, agar tidak ada kehilangan data saat migrasi ke struktur baru.

#### Acceptance Criteria

1. THE Migration_Script SHALL membuat satu Bank_Soal per kombinasi unik (pelaksanaan_ujian_id, mata_pelajaran_id, tingkat atau kelas_id) dari soal existing; requirement ini hanya terpenuhi ketika script benar-benar membuat record Bank_Soal baru, bukan ketika record sudah ada dari sumber lain
2. THE Migration_Script SHALL memperbarui semua soal existing dengan bank_soal_id yang sesuai
3. THE Migration_Script SHALL menggunakan nama default "Bank Soal {Nama Mata Pelajaran} - Tingkat {X}" atau "Bank Soal {Nama Mata Pelajaran} - {Nama Kelas}"
4. THE Migration_Script SHALL menetapkan durasi default 60 menit dan KKM default 70 untuk bank soal hasil migrasi
5. THE Migration_Script SHALL mencatat log migrasi dengan jumlah bank soal dan soal yang dimigrasi

### Requirement 9: Validasi Scope Guru

**User Story:** Sebagai System, saya ingin memastikan Guru hanya dapat mengakses bank soal sesuai mata pelajaran dan kelas yang diajar, agar keamanan data terjaga.

#### Acceptance Criteria

1. THE System SHALL menggunakan jadwal_pelajaran untuk menentukan mata_pelajaran_id dan kelas_id yang dapat diakses oleh Guru
2. WHEN Guru mencoba membuat bank soal untuk mata pelajaran yang tidak diajar, THE System SHALL menolak dengan pesan "Anda tidak memiliki akses ke mata pelajaran ini"
3. WHEN Guru mencoba membuat bank soal untuk kelas yang tidak diajar, THE System SHALL menolak dengan pesan "Anda tidak memiliki akses ke kelas ini"
4. THE System SHALL menampilkan hanya bank soal yang dapat diakses oleh Guru pada daftar bank soal
5. WHEN Guru mencoba mengakses detail bank soal di luar scope, THE System SHALL mengembalikan error 403 Forbidden

### Requirement 10: Duplikasi Bank Soal

**User Story:** Sebagai Guru, saya ingin menduplikasi bank soal yang sudah ada, agar saya dapat membuat variasi ujian dengan soal yang mirip tanpa input ulang.

#### Acceptance Criteria

1. WHEN Guru memilih "Duplikasi" pada bank soal, THE System SHALL membuat bank soal baru dengan nama "{Nama Asli} (Copy)"
2. THE System SHALL menyalin semua pengaturan (mata pelajaran, target kelas, durasi, KKM, shuffle options) ke bank soal duplikat
3. THE System SHALL menyalin semua soal dari bank soal asli ke bank soal duplikat dengan bank_soal_id baru
4. THE System SHALL menetapkan status "draft" untuk bank soal duplikat
5. WHEN proses duplikasi dimulai, THE System SHALL segera menampilkan pesan sukses dengan link ke bank soal duplikat, dan proses penyalinan soal dapat berlangsung di background
