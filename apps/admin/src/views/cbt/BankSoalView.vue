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
    questions.value = res.data;
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
  <div>
    <!-- Page header -->
    <div
      class="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between"
    >
      <div>
        <h1 class="text-lg font-semibold text-gray-900">Bank Soal</h1>
        <p class="text-sm text-gray-500 mt-0.5">Kelola soal ujian CBT</p>
      </div>
      <div class="flex items-center gap-2">
        <label
          class="cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
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
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          @click="showCreateForm = !showCreateForm"
        >
          + Tambah Soal
        </button>
      </div>
    </div>

    <div class="px-6 py-6">
      <div
        v-if="error"
        class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
      >
        {{ error }}
      </div>

      <!-- Import preview -->
      <div
        v-if="importPreview"
        class="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4"
      >
        <p class="text-sm font-medium text-amber-800">
          Preview: {{ importPreview.length }} soal siap diimpor
        </p>
        <div class="mt-3 flex gap-2">
          <button
            class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
            @click="handleConfirmImport"
          >
            Konfirmasi Import
          </button>
          <button
            class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            @click="importPreview = null"
          >
            Batal
          </button>
        </div>
      </div>

      <!-- Create form -->
      <div
        v-if="showCreateForm"
        class="mb-6 rounded-xl border border-gray-200 bg-white p-5"
      >
        <h2 class="mb-4 text-sm font-semibold text-gray-700">Buat Soal Baru</h2>
        <form class="space-y-4" @submit.prevent="handleCreate">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1"
                >Pelaksanaan Ujian ID</label
              >
              <input
                v-model="form.pelaksanaanUjianId"
                type="text"
                required
                class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1"
                >Mata Pelajaran ID</label
              >
              <input
                v-model="form.mataPelajaranId"
                type="text"
                required
                class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1"
                >Tingkat</label
              >
              <input
                v-model.number="form.tingkat"
                type="number"
                min="1"
                max="12"
                class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1"
              >Teks Soal</label
            >
            <textarea
              v-model="form.teksSoal"
              rows="3"
              required
              class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            ></textarea>
          </div>

          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div v-for="opt in ['A', 'B', 'C', 'D', 'E']" :key="opt">
              <label class="block text-xs font-medium text-gray-600 mb-1"
                >Opsi {{ opt }}</label
              >
              <input
                v-model="(form as any)[`opsi${opt}`]"
                type="text"
                :required="opt !== 'E'"
                class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1"
              >Jawaban Benar</label
            >
            <select
              v-model="form.jawabanBenar"
              required
              class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            >
              <option v-for="j in jawabanOptions" :key="j" :value="j">
                {{ j }}
              </option>
            </select>
          </div>

          <div class="flex gap-2 pt-1">
            <button
              type="submit"
              class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              Simpan
            </button>
            <button
              type="button"
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              @click="showCreateForm = false"
            >
              Batal
            </button>
          </div>
        </form>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div
          class="h-7 w-7 animate-spin rounded-full border-[3px] border-indigo-600 border-t-transparent"
        ></div>
      </div>

      <!-- Question cards -->
      <div v-else class="space-y-3">
        <div
          v-if="questions.length === 0"
          class="rounded-xl border border-gray-200 bg-white py-10 text-center text-sm text-gray-400"
        >
          Belum ada soal.
        </div>

        <div
          v-for="(q, idx) in questions"
          :key="q.id"
          class="flex items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 hover:border-indigo-200 transition-colors"
        >
          <!-- Left: number + text -->
          <div class="flex items-start gap-3 min-w-0">
            <span
              class="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600 border border-indigo-100"
            >
              {{ idx + 1 }}
            </span>
            <p class="text-sm text-gray-800 line-clamp-2 leading-relaxed">
              {{ q.teksSoal }}
            </p>
          </div>
          <!-- Right: answer + actions -->
          <div class="flex shrink-0 items-center gap-3">
            <span
              class="rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-700"
            >
              {{ q.jawabanBenar }}
            </span>
            <span class="text-xs text-gray-400"
              >Tk. {{ q.tingkat ?? "-" }}</span
            >
            <button
              class="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
              title="Hapus soal"
              @click="handleDelete(q.id)"
            >
              <svg
                class="h-4 w-4"
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
