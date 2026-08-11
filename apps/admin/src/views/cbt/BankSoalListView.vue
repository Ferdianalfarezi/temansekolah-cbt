<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import ScheduleExamModal from "./components/ScheduleExamModal.vue";
import BankSoalFormModal from "./components/BankSoalFormModal.vue";
import type { BankSoalFormData } from "./components/BankSoalFormModal.vue";
import type {
  BankSoalForSchedule,
  KelasOption,
  UserOption,
} from "./components/ScheduleExamModal.vue";
import {
  getBankSoalList,
  createBankSoal,
  deleteBankSoal,
  duplicateBankSoal,
  getErrorMessage,
  type BankSoal as ApiBankSoal,
} from "@/api/bank-soal";
import cbtApi from "@/api/cbt";

// Types for Bank Soal
export type BankSoalStatus = "draft" | "ready" | "archived";

export interface BankSoal {
  id: string;
  nama: string;
  mataPelajaranId: string;
  mataPelajaranNama: string;
  soalCount: number;
  targetKelas: string[];
  targetKelasIds: string[];
  tingkat: number | null;
  durasiMenit: number;
  kkm: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  status: BankSoalStatus;
  createdAt: string;
  createdBy: string;
}

interface MataPelajaran {
  id: string;
  nama: string;
}

interface Kelas {
  id: string;
  nama: string;
  tingkat: number;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const router = useRouter();

// State
const bankSoalList = ref<BankSoal[]>([]);
const mataPelajaranOptions = ref<MataPelajaran[]>([]);
const kelasOptions = ref<Kelas[]>([]);
const hasActivePelaksanaan = ref(true);
const loading = ref(false);
const error = ref("");

// Filters
const searchQuery = ref("");
const mataPelajaranFilter = ref<string>("");
const tingkatFilter = ref<number | "">("");

// Pagination
const pagination = ref<PaginationMeta>({
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
});

// Confirmation modals
const showDeleteConfirm = ref(false);
const deletingBankSoal = ref<BankSoal | null>(null);
const actionLoading = ref(false);

// Create/Edit Modal
const showFormModal = ref(false);

// Schedule Exam Modal
const showScheduleModal = ref(false);
const schedulingBankSoal = ref<BankSoalForSchedule | null>(null);
const userOptions = ref<UserOption[]>([]);

// Tingkat options (1-12)
const tingkatOptions = Array.from({ length: 12 }, (_, i) => i + 1);

// Computed: filtered page info
const paginationInfo = computed(() => {
  const start = (pagination.value.page - 1) * pagination.value.limit + 1;
  const end = Math.min(
    pagination.value.page * pagination.value.limit,
    pagination.value.total,
  );
  return { start, end, total: pagination.value.total };
});

// API: Fetch bank soal list
async function fetchBankSoalList() {
  loading.value = true;
  error.value = "";
  try {
    const params = {
      page: pagination.value.page,
      limit: pagination.value.limit,
      search: searchQuery.value || undefined,
      mataPelajaranId: mataPelajaranFilter.value || undefined,
      tingkat: tingkatFilter.value || undefined,
    };
    const res = await getBankSoalList(params);

    // Map API response to local type
    bankSoalList.value = res.data.data.map((item: ApiBankSoal) => ({
      ...item,
      targetKelas: item.targetKelas || [],
      targetKelasIds: item.targetKelasIds || [],
    }));

    pagination.value = {
      page: res.data.meta.page,
      limit: res.data.meta.limit,
      total: res.data.meta.total,
      totalPages:
        res.data.meta.totalPages ||
        Math.ceil(res.data.meta.total / res.data.meta.limit),
    };

    // If list is empty on first load, it might mean no active pelaksanaan
    hasActivePelaksanaan.value = true;
  } catch (e: any) {
    const message = getErrorMessage(e);
    error.value = message;

    // Check if the error is about no active pelaksanaan
    if (message.includes("pelaksanaan ujian aktif")) {
      hasActivePelaksanaan.value = false;
    }
  } finally {
    loading.value = false;
  }
}

// API: Fetch mata pelajaran options (from user's scope)
async function fetchMataPelajaranOptions() {
  try {
    // Use the bank-soal scope endpoint
    const res = await cbtApi.get("/bank-soal/scope");
    mataPelajaranOptions.value = res.data.mataPelajaran || [];
    kelasOptions.value = res.data.kelas || [];
  } catch (e: any) {
    console.error("Gagal memuat mata pelajaran:", e);
    mataPelajaranOptions.value = [];
    kelasOptions.value = [];
  }
}

// Navigation
function handleCreate() {
  showFormModal.value = true;
}

function closeFormModal() {
  showFormModal.value = false;
}

async function handleFormSubmit(data: BankSoalFormData) {
  actionLoading.value = true;
  try {
    await createBankSoal({
      nama: data.nama,
      mataPelajaranId: data.mataPelajaranId,
      tingkat: data.tingkat || undefined,
      targetKelasIds:
        data.targetKelasIds.length > 0 ? data.targetKelasIds : undefined,
      durasiMenit: data.durasiMenit,
      kkm: data.kkm,
      shuffleQuestions: data.shuffleQuestions,
      shuffleOptions: data.shuffleOptions,
    });
    showFormModal.value = false;
    await fetchBankSoalList();
  } catch (e: any) {
    error.value = getErrorMessage(e);
  } finally {
    actionLoading.value = false;
  }
}

function handleEdit(bankSoal: BankSoal) {
  router.push(`/cbt/bank-soal/${bankSoal.id}`);
}

function handleViewDetail(bankSoal: BankSoal) {
  router.push(`/cbt/bank-soal/${bankSoal.id}`);
}

// Actions
async function handleDuplicate(bankSoal: BankSoal) {
  if (!confirm(`Duplikasi bank soal "${bankSoal.nama}"?`)) return;
  actionLoading.value = true;
  try {
    await duplicateBankSoal(bankSoal.id);
    await fetchBankSoalList();
  } catch (e: any) {
    error.value = getErrorMessage(e);
  } finally {
    actionLoading.value = false;
  }
}

function handleScheduleExam(bankSoal: BankSoal) {
  // Convert target kelas strings to KelasOption format
  // In real implementation, this would come from API with proper IDs
  const targetKelasOptions: KelasOption[] = bankSoal.targetKelas.map(
    (kelas, idx) => ({
      value: `kelas-${idx}`, // TODO: Use actual kelas IDs from API
      label: kelas,
    }),
  );

  schedulingBankSoal.value = {
    id: bankSoal.id,
    nama: bankSoal.nama,
    targetKelas: targetKelasOptions,
    tingkat: bankSoal.tingkat,
    durasiMenit: bankSoal.durasiMenit,
    shuffleQuestions: bankSoal.shuffleQuestions,
    shuffleOptions: bankSoal.shuffleOptions,
    soalCount: bankSoal.soalCount,
  };
  showScheduleModal.value = true;
}

function closeScheduleModal() {
  showScheduleModal.value = false;
  schedulingBankSoal.value = null;
}

function handleScheduled(sessionId: string) {
  showScheduleModal.value = false;
  schedulingBankSoal.value = null;
  // Navigate to exam session detail
  router.push(`/cbt/exam-session/${sessionId}`);
}

// API: Fetch user options for proktor dropdown
async function fetchUserOptions() {
  try {
    const res = await cbtApi.get("/bank-soal/proctor-options");
    userOptions.value = res.data.map((u: { id: string; nama: string }) => ({
      value: u.id,
      label: u.nama,
    }));
  } catch (e: unknown) {
    console.error("Gagal memuat daftar proktor:", e);
    userOptions.value = [];
  }
}

function confirmDelete(bankSoal: BankSoal) {
  deletingBankSoal.value = bankSoal;
  showDeleteConfirm.value = true;
}

async function handleDelete() {
  if (!deletingBankSoal.value) return;
  actionLoading.value = true;
  try {
    await deleteBankSoal(deletingBankSoal.value.id);
    showDeleteConfirm.value = false;
    deletingBankSoal.value = null;
    await fetchBankSoalList();
  } catch (e: any) {
    error.value = getErrorMessage(e);
  } finally {
    actionLoading.value = false;
  }
}

function cancelDelete() {
  showDeleteConfirm.value = false;
  deletingBankSoal.value = null;
}

// Pagination
function goToPage(page: number) {
  if (page < 1 || page > pagination.value.totalPages) return;
  pagination.value.page = page;
  fetchBankSoalList();
}

// Status badge class helper
function statusBadgeClass(status: BankSoalStatus) {
  const map: Record<BankSoalStatus, string> = {
    draft: "bg-gray-100 text-gray-600",
    ready: "bg-emerald-100 text-emerald-700",
    archived: "bg-amber-100 text-amber-700",
  };
  return map[status] || "bg-gray-100 text-gray-600";
}

function statusLabel(status: BankSoalStatus) {
  const map: Record<BankSoalStatus, string> = {
    draft: "Draft",
    ready: "Siap",
    archived: "Diarsipkan",
  };
  return map[status] || status;
}

// Format date
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Watchers for filters (debounced search)
let searchTimeout: ReturnType<typeof setTimeout>;
watch(searchQuery, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    pagination.value.page = 1;
    fetchBankSoalList();
  }, 300);
});

watch([mataPelajaranFilter, tingkatFilter], () => {
  pagination.value.page = 1;
  fetchBankSoalList();
});

// Lifecycle
onMounted(() => {
  fetchBankSoalList();
  fetchMataPelajaranOptions();
  fetchUserOptions();
});
</script>

<template>
  <div>
    <!-- Page header -->
    <div
      class="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between"
    >
      <div>
        <h1 class="text-lg font-semibold text-gray-900">Bank Soal</h1>
        <p class="text-sm text-gray-500 mt-0.5">
          Kelola kumpulan soal ujian CBT
        </p>
      </div>
      <button
        class="inline-flex items-center gap-2 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors"
        @click="handleCreate"
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
            d="M12 4v16m8-8H4"
          />
        </svg>
        Buat Bank Soal
      </button>
    </div>

    <div class="px-6 py-6">
      <!-- Filters -->
      <div class="mb-6 flex flex-wrap items-center gap-3">
        <!-- Search -->
        <div class="relative">
          <svg
            class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari nama bank soal..."
            class="w-64 rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>

        <!-- Mata Pelajaran Filter -->
        <select
          v-model="mataPelajaranFilter"
          class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
        >
          <option value="">Semua Mata Pelajaran</option>
          <option
            v-for="mapel in mataPelajaranOptions"
            :key="mapel.id"
            :value="mapel.id"
          >
            {{ mapel.nama }}
          </option>
        </select>

        <!-- Tingkat Filter -->
        <select
          v-model="tingkatFilter"
          class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
        >
          <option value="">Semua Tingkat</option>
          <option v-for="t in tingkatOptions" :key="t" :value="t">
            Tingkat {{ t }}
          </option>
        </select>
      </div>

      <!-- Error banner -->
      <div
        v-if="error"
        class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center justify-between"
      >
        <span>{{ error }}</span>
        <button class="text-red-500 hover:text-red-700" @click="error = ''">
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div
          class="h-7 w-7 animate-spin rounded-full border-[3px] border-indigo-600 border-t-transparent"
        ></div>
      </div>

      <!-- Data Table -->
      <div
        v-else
        class="overflow-hidden rounded-xl border border-gray-200 bg-white"
      >
        <table class="min-w-full">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                Nama Bank Soal
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                Mata Pelajaran
              </th>
              <th
                class="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                Jumlah Soal
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                Target Kelas
              </th>
              <th
                class="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                Durasi
              </th>
              <th
                class="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                Status
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                Dibuat
              </th>
              <th
                class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                Aksi
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="bankSoal in bankSoalList"
              :key="bankSoal.id"
              class="hover:bg-gray-50/60 transition-colors cursor-pointer"
              @click="handleViewDetail(bankSoal)"
            >
              <td class="px-4 py-3">
                <span class="text-sm font-medium text-gray-900">{{
                  bankSoal.nama
                }}</span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">
                {{ bankSoal.mataPelajaranNama }}
              </td>
              <td class="px-4 py-3 text-center">
                <span
                  class="inline-flex items-center justify-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
                >
                  {{ bankSoal.soalCount }} soal
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">
                <div
                  v-if="bankSoal.targetKelas.length > 0"
                  class="flex flex-wrap gap-1"
                >
                  <span
                    v-for="kelas in bankSoal.targetKelas.slice(0, 3)"
                    :key="kelas"
                    class="inline-flex rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                  >
                    {{ kelas }}
                  </span>
                  <span
                    v-if="bankSoal.targetKelas.length > 3"
                    class="inline-flex rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
                  >
                    +{{ bankSoal.targetKelas.length - 3 }} lainnya
                  </span>
                </div>
                <span v-else-if="bankSoal.tingkat" class="text-gray-500"
                  >Tingkat {{ bankSoal.tingkat }}</span
                >
                <span v-else class="text-gray-400">-</span>
              </td>
              <td class="px-4 py-3 text-center text-sm text-gray-600">
                {{ bankSoal.durasiMenit }} menit
              </td>
              <td class="px-4 py-3 text-center">
                <span
                  :class="[
                    'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                    statusBadgeClass(bankSoal.status),
                  ]"
                >
                  {{ statusLabel(bankSoal.status) }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">
                {{ formatDate(bankSoal.createdAt) }}
              </td>
              <td class="px-4 py-3 text-right" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <!-- Edit -->
                  <button
                    title="Edit"
                    class="rounded-md p-1.5 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                    @click="handleEdit(bankSoal)"
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
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <!-- Duplicate -->
                  <button
                    title="Duplikasi"
                    class="rounded-md p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    @click="handleDuplicate(bankSoal)"
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
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                  <!-- Schedule Exam -->
                  <button
                    title="Jadwalkan Ujian"
                    class="rounded-md p-1.5 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                    @click="handleScheduleExam(bankSoal)"
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
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                  <!-- Delete -->
                  <button
                    title="Hapus"
                    class="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    @click="confirmDelete(bankSoal)"
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
              </td>
            </tr>

            <!-- Empty state -->
            <tr v-if="bankSoalList.length === 0">
              <td colspan="8" class="py-12 text-center">
                <svg
                  class="mx-auto h-12 w-12 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p class="mt-2 text-sm text-gray-500">
                  Belum ada bank soal. Klik "Buat Bank Soal" untuk memulai.
                </p>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <div
          v-if="pagination.total > 0"
          class="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3"
        >
          <div class="text-sm text-gray-500">
            Menampilkan {{ paginationInfo.start }}-{{ paginationInfo.end }} dari
            {{ paginationInfo.total }} bank soal
          </div>
          <div class="flex items-center gap-1">
            <button
              class="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              :disabled="pagination.page <= 1"
              @click="goToPage(pagination.page - 1)"
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <span class="px-3 text-sm text-gray-700"
              >{{ pagination.page }} / {{ pagination.totalPages }}</span
            >
            <button
              class="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              :disabled="pagination.page >= pagination.totalPages"
              @click="goToPage(pagination.page + 1)"
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
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <div
        v-if="showDeleteConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="cancelDelete"
      >
        <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-full bg-red-100"
            >
              <svg
                class="h-5 w-5 text-red-600"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900">
                Hapus Bank Soal
              </h3>
              <p class="text-sm text-gray-500">
                Tindakan ini tidak dapat dibatalkan
              </p>
            </div>
          </div>

          <div v-if="deletingBankSoal" class="mt-4">
            <p class="text-sm text-gray-700">
              Anda akan menghapus bank soal
              <strong>"{{ deletingBankSoal.nama }}"</strong> beserta
              <strong>{{ deletingBankSoal.soalCount }} soal</strong> di
              dalamnya.
            </p>
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              :disabled="actionLoading"
              @click="cancelDelete"
            >
              Batal
            </button>
            <button
              class="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              :disabled="actionLoading"
              @click="handleDelete"
            >
              <svg
                v-if="actionLoading"
                class="h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Hapus
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Schedule Exam Modal -->
    <ScheduleExamModal
      :show="showScheduleModal"
      :bank-soal="schedulingBankSoal"
      :user-options="userOptions"
      @close="closeScheduleModal"
      @scheduled="handleScheduled"
    />

    <!-- Create Bank Soal Modal -->
    <BankSoalFormModal
      :show="showFormModal"
      :is-edit="false"
      :mata-pelajaran-options="
        mataPelajaranOptions.map((m) => ({ value: m.id, label: m.nama }))
      "
      :kelas-options="
        kelasOptions.map((k) => ({
          value: k.id,
          label: k.nama,
          tingkat: k.tingkat,
        }))
      "
      :has-active-pelaksanaan="hasActivePelaksanaan"
      @close="closeFormModal"
      @submit="handleFormSubmit"
    />
  </div>
</template>
