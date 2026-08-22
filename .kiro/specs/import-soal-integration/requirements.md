# Requirements Document

## Introduction
Integrasi komponen `ImportSoalModal.vue` dengan backend API yang sudah ada untuk fitur import soal dari file Excel ke Bank Soal. Backend dan API client sudah lengkap, hanya perlu wiring di komponen Vue.

## Requirements

### Requirement 1: Download Template Excel
**User Story:** Sebagai guru/admin, saya ingin mengunduh template Excel agar saya dapat menyiapkan soal dengan format yang benar.

#### Acceptance Criteria
- Klik tombol "Download Template Excel" memicu API call ke `GET /api/bank-soal/template`
- File `template_soal.xlsx` terdownload ke browser
- Jika API error, tampilkan pesan error di banner

### Requirement 2: Upload dan Preview File Excel
**User Story:** Sebagai guru/admin, saya ingin melihat preview hasil parsing file Excel sebelum import agar saya dapat memverifikasi data yang akan dimasukkan.

#### Acceptance Criteria
- File dapat diupload via drag-drop atau file picker
- Hanya file .xlsx dan .xls yang diterima (validasi client-side)
- File dikirim ke backend untuk parsing via `POST /api/bank-soal/:id/soal/import?preview=true`
- Hasil preview menampilkan jumlah soal valid yang siap diimport
- Hasil preview menampilkan daftar soal valid dengan nomor, teks soal (truncated), dan jawaban benar
- Hasil preview menampilkan daftar error per baris jika ada (nomor baris + pesan error)
- Loading spinner ditampilkan selama parsing dengan teks "Memparse file..."

### Requirement 3: Commit Import Soal
**User Story:** Sebagai guru/admin, saya ingin mengkonfirmasi import soal yang valid ke database agar soal tersimpan di Bank Soal.

#### Acceptance Criteria
- Tombol "Import X Soal" hanya aktif jika ada validRows > 0
- Klik tombol memicu API call ke `POST /api/bank-soal/:id/soal/import`
- Setelah sukses, modal tertutup dan event `imported` di-emit dengan jumlah soal yang berhasil diimport
- Loading spinner ditampilkan di tombol import dengan teks "Mengimpor..."
- Jika gagal, tampilkan pesan error di banner

### Requirement 4: Partial Import Behavior
**User Story:** Sebagai guru/admin, saya ingin soal yang valid tetap diimport meskipun ada beberapa soal yang error agar saya tidak perlu memperbaiki semua error terlebih dahulu.

#### Acceptance Criteria
- Import tidak bersifat all-or-nothing
- Soal dengan error di-skip, soal valid dimasukkan ke database
- User diberi informasi berapa yang berhasil dan berapa yang gagal

### Requirement 5: Error Handling
**User Story:** Sebagai guru/admin, saya ingin melihat pesan error yang jelas saat terjadi kesalahan agar saya tahu cara memperbaikinya.

#### Acceptance Criteria
- File bukan Excel menampilkan: "File harus berformat Excel (.xlsx atau .xls)"
- File terlalu besar atau kolom tidak lengkap menampilkan pesan dari backend
- Bank soal locked menampilkan: "Bank soal tidak dapat diubah karena sudah digunakan dalam sesi ujian yang terkunci"
- Network error menampilkan: "Terjadi kesalahan. Silakan coba lagi."

### Requirement 6: State Management
**User Story:** Sebagai guru/admin, saya ingin modal dalam keadaan bersih setiap kali dibuka agar tidak ada data dari session sebelumnya.

#### Acceptance Criteria
- Saat modal ditutup (via tombol close, backdrop click, atau setelah sukses), semua state direset
- State yang direset: currentStep ke 1, selectedFile di-clear, validRows dan errors dikosongkan, parseError dikosongkan
- Saat modal dibuka ulang, state bersih dari session sebelumnya

## Out of Scope
- Perubahan backend API (sudah lengkap)
- Perubahan API client di `bank-soal.ts` (sudah lengkap)
- Import gambar dari Excel (tidak didukung, gambar harus diupload manual via SoalFormModal)
- Tipe soal selain pilihan ganda (essay, dll)

## Dependencies
- Backend endpoint: `GET /api/bank-soal/template`, `POST /api/bank-soal/:id/soal/import`
- Frontend API client: `apps/admin/src/api/bank-soal.ts`
- Target component: `apps/admin/src/views/cbt/components/ImportSoalModal.vue`
