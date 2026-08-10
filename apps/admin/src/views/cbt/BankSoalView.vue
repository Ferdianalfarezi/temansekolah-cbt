<script setup lang="ts">
import { ref, onMounted } from "vue";
import {
  getQuestions,
  createQuestion,
  deleteQuestion,
  importQuestionsPreview,
  confirmImportQuestions,
  type Question,
} from "@/api/cbt";

const questions = ref<Question[]>([]);
const loading = ref(false);
const error = ref("");
const showCreateForm = ref(false);
const importPreview = ref<Partial<Question>[] | null>(null);

const form = ref({
  pelaksanaanUjianId: "",
  mataPelajaranId: "",
  tingkat: null as number | null,
  kelasId: null as string | null,
  teksSoal: "",
  opsiA: "",
  opsiB: "",
  opsiC: "",
  opsiD: "",
  opsiE: "",
  jawabanBenar: "A",
});

const jawabanOptions = ["A", "B", "C", "D", "E"];

async function fetchQuestions() {
  loading.value = true;
  error.value = "";
  try {
    const res = await getQuestions();
    // API returns { data: Question[], meta: {...} }
    questions.value = res.data.data;
  } catch (e: any) {
    error.value = e.response?.data?.message || "Gagal memuat soal";
  } finally {
    loading.value = false;
  }
}

async function handleCreate() {
  try {
    await createQuestion({
      ...form.value,
      opsiE: form.value.opsiE || undefined,
    });
    showCreateForm.value = false;
    resetForm();
    await fetchQuestions();
  } catch (e: any) {
    error.value = e.response?.data?.message || "Gagal membuat soal";
  }
}

function resetForm() {
  form.value = {
    pelaksanaanUjianId: "",
    mataPelajaranId: "",
    tingkat: null,
    kelasId: null,
    teksSoal: "",
    opsiA: "",
    opsiB: "",
    opsiC: "",
    opsiD: "",
    opsiE: "",
    jawabanBenar: "A",
  };
}

async function handleDelete(id: string) {
  if (!confirm("Hapus soal ini?")) return;
  try {
    await deleteQuestion(id);
    await fetchQuestions();
  } catch (e: any) {
    error.value = e.response?.data?.message || "Gagal menghapus soal";
  }
}

async function handleImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const res = await importQuestionsPreview(file);
    importPreview.value = res.data.questions;
    if (res.data.errors.length) {
      error.value = `Import warnings: ${res.data.errors.join(", ")}`;
    }
  } catch (e: any) {
    error.value = e.response?.data?.message || "Gagal import file";
  }
}

async function handleConfirmImport() {
  if (!importPreview.value) return;
  try {
    await confirmImportQuestions(importPreview.value);
    importPreview.value = null;
    await fetchQuestions();
  } catch (e: any) {
    error.value = e.response?.data?.message || "Gagal menyimpan import";
  }
}

onMounted(fetchQuestions);
</script>

<template>
  <div class="p-8">
    <!-- Page Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1
          class="text-[22px] font-bold"
          style="color: var(--color-text-primary)"
        >
          Bank Soal
        </h1>
        <p class="text-[14px] mt-1" style="color: var(--color-text-secondary)">
          Kelola soal ujian CBT
        </p>
      </div>
      <div class="flex items-center gap-3">
        <label
          class="cursor-pointer px-[18px] py-[10px] text-[14px] font-semibold rounded-[8px] transition-all duration-200"
          style="
            color: var(--color-text-secondary);
            background: var(--color-surface-0);
            border: 2px solid var(--color-border);
          "
        >
          Import Excel
          <input
            type="file"
            accept=".xlsx,.xls"
            class="hidden"
            @change="handleImport"
          />
        </label>
        <button
          class="px-[18px] py-[10px] text-[14px] font-semibold text-white rounded-[8px] transition-all duration-200"
          style="
            background: var(--color-primary-600);
            box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
          "
          @click="showCreateForm = !showCreateForm"
        >
          + Tambah Soal
        </button>
      </div>
    </div>

    <!-- Error Alert -->
    <div
      v-if="error"
      class="mb-4 rounded-[12px] p-4 text-[14px]"
      style="
        background: var(--color-danger-50);
        border: 1px solid var(--color-danger-500);
        color: var(--color-danger-700);
      "
    >
      {{ error }}
    </div>

    <!-- Import Preview -->
    <div
      v-if="importPreview"
      class="mb-6 rounded-[12px] p-5"
      style="
        background: var(--color-warning-50);
        border: 2px solid var(--color-warning-500);
      "
    >
      <p
        class="text-[14px] font-semibold"
        style="color: var(--color-warning-700)"
      >
        Preview: {{ importPreview.length }} soal siap diimpor
      </p>
      <div class="mt-4 flex gap-3">
        <button
          class="px-4 py-2 text-[14px] font-semibold text-white rounded-[8px] transition-colors"
          style="background: var(--color-success-600)"
          @click="handleConfirmImport"
        >
          Konfirmasi Import
        </button>
        <button
          class="px-4 py-2 text-[14px] font-semibold rounded-[8px] transition-colors"
          style="
            background: var(--color-surface-0);
            border: 2px solid var(--color-border);
            color: var(--color-text-secondary);
          "
          @click="importPreview = null"
        >
          Batal
        </button>
      </div>
    </div>

    <!-- Create Form -->
    <div
      v-if="showCreateForm"
      class="mb-6 rounded-[16px] p-6"
      style="
        background: var(--color-surface-0);
        border: 2px solid var(--color-border);
        box-shadow: var(--shadow-sm);
      "
    >
      <h2
        class="mb-5 text-[16px] font-bold"
        style="color: var(--color-text-primary)"
      >
        Buat Soal Baru
      </h2>
      <form class="space-y-5" @submit.prevent="handleCreate">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label
              class="block text-[13px] font-medium mb-1.5"
              style="color: var(--color-text-secondary)"
              >Pelaksanaan Ujian ID</label
            >
            <input
              v-model="form.pelaksanaanUjianId"
              type="text"
              required
              class="block w-full px-3 py-2.5 text-[14px] rounded-[8px] outline-none transition-colors"
              style="
                border: 2px solid var(--color-border);
                color: var(--color-text-primary);
              "
            />
          </div>
          <div>
            <label
              class="block text-[13px] font-medium mb-1.5"
              style="color: var(--color-text-secondary)"
              >Mata Pelajaran ID</label
            >
            <input
              v-model="form.mataPelajaranId"
              type="text"
              required
              class="block w-full px-3 py-2.5 text-[14px] rounded-[8px] outline-none transition-colors"
              style="
                border: 2px solid var(--color-border);
                color: var(--color-text-primary);
              "
            />
          </div>
          <div>
            <label
              class="block text-[13px] font-medium mb-1.5"
              style="color: var(--color-text-secondary)"
              >Tingkat</label
            >
            <input
              v-model.number="form.tingkat"
              type="number"
              min="1"
              max="12"
              class="block w-full px-3 py-2.5 text-[14px] rounded-[8px] outline-none transition-colors"
              style="
                border: 2px solid var(--color-border);
                color: var(--color-text-primary);
              "
            />
          </div>
        </div>

        <div>
          <label
            class="block text-[13px] font-medium mb-1.5"
            style="color: var(--color-text-secondary)"
            >Teks Soal</label
          >
          <textarea
            v-model="form.teksSoal"
            rows="3"
            required
            class="block w-full px-3 py-2.5 text-[14px] rounded-[8px] outline-none transition-colors resize-none"
            style="
              border: 2px solid var(--color-border);
              color: var(--color-text-primary);
            "
          ></textarea>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div v-for="opt in ['A', 'B', 'C', 'D', 'E']" :key="opt">
            <label
              class="block text-[13px] font-medium mb-1.5"
              style="color: var(--color-text-secondary)"
              >Opsi {{ opt }}</label
            >
            <input
              v-model="(form as any)[`opsi${opt}`]"
              type="text"
              :required="opt !== 'E'"
              class="block w-full px-3 py-2.5 text-[14px] rounded-[8px] outline-none transition-colors"
              style="
                border: 2px solid var(--color-border);
                color: var(--color-text-primary);
              "
            />
          </div>
        </div>

        <div>
          <label
            class="block text-[13px] font-medium mb-1.5"
            style="color: var(--color-text-secondary)"
            >Jawaban Benar</label
          >
          <select
            v-model="form.jawabanBenar"
            required
            class="px-3 py-2.5 text-[14px] rounded-[8px] outline-none transition-colors"
            style="
              border: 2px solid var(--color-border);
              color: var(--color-text-primary);
            "
          >
            <option v-for="j in jawabanOptions" :key="j" :value="j">
              {{ j }}
            </option>
          </select>
        </div>

        <div class="flex gap-3 pt-2">
          <button
            type="submit"
            class="px-[18px] py-[10px] text-[14px] font-semibold text-white rounded-[8px] transition-all duration-200"
            style="
              background: var(--color-primary-600);
              box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
            "
          >
            Simpan
          </button>
          <button
            type="button"
            class="px-[18px] py-[10px] text-[14px] font-semibold rounded-[8px] transition-colors"
            style="
              background: var(--color-surface-0);
              border: 2px solid var(--color-border);
              color: var(--color-text-secondary);
            "
            @click="showCreateForm = false"
          >
            Batal
          </button>
        </div>
      </form>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div
        class="h-8 w-8 animate-spin rounded-full border-[3px] border-t-transparent"
        style="
          border-color: var(--color-primary-600);
          border-top-color: transparent;
        "
      ></div>
    </div>

    <!-- Question Cards Container -->
    <div
      v-else
      class="rounded-[16px] overflow-hidden"
      style="
        background: var(--color-surface-0);
        border: 2px solid var(--color-border);
        box-shadow: var(--shadow-xs);
      "
    >
      <!-- Section Header -->
      <div
        class="flex items-center justify-between px-6 py-5"
        style="
          background: var(--color-primary-50);
          border-bottom: 2px solid var(--color-primary-200);
        "
      >
        <h3
          class="text-[16px] font-bold"
          style="color: var(--color-primary-800)"
        >
          Daftar Soal
        </h3>
        <span
          class="text-[13px] font-semibold"
          style="color: var(--color-text-secondary)"
        >
          {{ questions.length }} soal
        </span>
      </div>

      <!-- Empty State -->
      <div v-if="questions.length === 0" class="py-16 text-center">
        <svg
          class="w-12 h-12 mx-auto mb-4"
          style="color: var(--color-surface-300)"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p class="text-[15px]" style="color: var(--color-text-tertiary)">
          Belum ada soal. Klik "Tambah Soal" untuk membuat soal baru.
        </p>
      </div>

      <!-- Question List -->
      <div v-else class="divide-y" style="border-color: var(--color-border)">
        <div
          v-for="(q, idx) in questions"
          :key="q.id"
          class="flex items-start justify-between gap-4 px-6 py-4 transition-colors duration-200"
          style="border-color: var(--color-border)"
          @mouseover="
            ($event.currentTarget as HTMLElement).style.background =
              'var(--color-primary-50)'
          "
          @mouseleave="
            ($event.currentTarget as HTMLElement).style.background =
              'transparent'
          "
        >
          <!-- Left: number + text -->
          <div class="flex items-start gap-4 min-w-0">
            <span
              class="shrink-0 flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold"
              style="
                background: var(--color-primary-100);
                color: var(--color-primary-700);
                border: 1px solid var(--color-primary-200);
              "
            >
              {{ idx + 1 }}
            </span>
            <p
              class="text-[15px] leading-relaxed line-clamp-2"
              style="color: var(--color-text-primary)"
            >
              {{ q.teksSoal }}
            </p>
          </div>
          <!-- Right: answer + level + actions -->
          <div class="flex shrink-0 items-center gap-4">
            <span
              class="rounded-[6px] px-3 py-1.5 text-[13px] font-bold"
              style="
                background: var(--color-success-50);
                border: 1px solid var(--color-success-500);
                color: var(--color-success-700);
              "
            >
              {{ q.jawabanBenar }}
            </span>
            <span class="text-[13px]" style="color: var(--color-text-tertiary)">
              Tk. {{ q.tingkat ?? "-" }}
            </span>
            <button
              class="rounded-[6px] p-2 transition-colors"
              style="color: var(--color-text-tertiary)"
              title="Hapus soal"
              @click="handleDelete(q.id)"
              @mouseover="
                ($event.currentTarget as HTMLElement).style.background =
                  'var(--color-danger-50)';
                ($event.currentTarget as HTMLElement).style.color =
                  'var(--color-danger-600)';
              "
              @mouseleave="
                ($event.currentTarget as HTMLElement).style.background =
                  'transparent';
                ($event.currentTarget as HTMLElement).style.color =
                  'var(--color-text-tertiary)';
              "
            >
              <svg
                class="h-5 w-5"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
