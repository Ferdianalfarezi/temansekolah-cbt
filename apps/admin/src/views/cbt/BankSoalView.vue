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
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Bank Soal</h1>
      <div class="flex gap-2">
        <label
          class="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          @click="showCreateForm = !showCreateForm"
        >
          + Buat Soal
        </button>
      </div>
    </div>

    <div
      v-if="error"
      class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
    >
      {{ error }}
    </div>

    <!-- Import preview -->
    <div
      v-if="importPreview"
      class="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4"
    >
      <p class="font-medium text-yellow-800">
        Preview: {{ importPreview.length }} soal siap diimpor
      </p>
      <div class="mt-2 flex gap-2">
        <button
          class="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          @click="handleConfirmImport"
        >
          Konfirmasi Import
        </button>
        <button
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          @click="importPreview = null"
        >
          Batal
        </button>
      </div>
    </div>

    <!-- Create form -->
    <div
      v-if="showCreateForm"
      class="mb-6 rounded-lg border border-gray-200 bg-white p-4"
    >
      <h2 class="mb-4 text-lg font-semibold text-gray-800">Buat Soal Baru</h2>
      <form class="space-y-4" @submit.prevent="handleCreate">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label class="block text-sm font-medium text-gray-700"
              >Pelaksanaan Ujian ID</label
            >
            <input
              v-model="form.pelaksanaanUjianId"
              type="text"
              required
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700"
              >Mata Pelajaran ID</label
            >
            <input
              v-model="form.mataPelajaranId"
              type="text"
              required
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700"
              >Tingkat</label
            >
            <input
              v-model.number="form.tingkat"
              type="number"
              min="1"
              max="12"
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700"
            >Teks Soal</label
          >
          <textarea
            v-model="form.teksSoal"
            rows="3"
            required
            class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          ></textarea>
        </div>

        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div v-for="opt in ['A', 'B', 'C', 'D', 'E']" :key="opt">
            <label class="block text-sm font-medium text-gray-700"
              >Opsi {{ opt }}</label
            >
            <input
              v-model="(form as any)[`opsi${opt}`]"
              type="text"
              :required="opt !== 'E'"
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700"
            >Jawaban Benar</label
          >
          <select
            v-model="form.jawabanBenar"
            required
            class="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option v-for="j in jawabanOptions" :key="j" :value="j">
              {{ j }}
            </option>
          </select>
        </div>

        <div class="flex gap-2">
          <button
            type="submit"
            class="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            Simpan
          </button>
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
        class="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
      ></div>
    </div>

    <!-- Questions table -->
    <div
      v-else
      class="overflow-hidden rounded-lg border border-gray-200 bg-white"
    >
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th
              class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"
            >
              No
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"
            >
              Soal
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"
            >
              Jawaban
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"
            >
              Tingkat
            </th>
            <th
              class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500"
            >
              Aksi
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr
            v-for="(q, idx) in questions"
            :key="q.id"
            class="hover:bg-gray-50"
          >
            <td class="px-4 py-3 text-sm text-gray-600">{{ idx + 1 }}</td>
            <td class="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
              {{ q.teksSoal }}
            </td>
            <td class="px-4 py-3 text-sm font-medium text-gray-900">
              {{ q.jawabanBenar }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-600">
              {{ q.tingkat ?? "-" }}
            </td>
            <td class="px-4 py-3 text-right">
              <button
                class="text-sm text-red-600 hover:text-red-800"
                @click="handleDelete(q.id)"
              >
                Hapus
              </button>
            </td>
          </tr>
          <tr v-if="questions.length === 0">
            <td colspan="5" class="px-4 py-8 text-center text-sm text-gray-500">
              Belum ada soal.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
