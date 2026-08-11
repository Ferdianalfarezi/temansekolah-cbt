<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import ImportSoalModal from "./components/ImportSoalModal.vue";
import SoalFormModal, {
  type Soal as SoalFormSoal,
  type SoalFormData,
} from "./components/SoalFormModal.vue";

// Types
export type BankSoalStatus = "draft" | "ready" | "archived";

export interface BankSoalDetail {
  id: string;
  nama: string;
  mataPelajaranId: string;
  mataPelajaranNama: string;
  targetKelas: string[];
  tingkat: number | null;
  durasiMenit: number;
  kkm: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  status: BankSoalStatus;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface Soal {
  id: string;
  nomorUrut: number;
  teksSoal: string;
  jawabanBenar: "A" | "B" | "C" | "D" | "E";
  opsiA: string;
  opsiB: string;
  opsiC: string;
  opsiD: string;
  opsiE: string | null;
  gambarSoalUrl: string | null;
  gambarAUrl: string | null;
  gambarBUrl: string | null;
  gambarCUrl: string | null;
  gambarDUrl: string | null;
  gambarEUrl: string | null;
}

const router = useRouter();
const route = useRoute();

// State
const bankSoal = ref<BankSoalDetail | null>(null);
const soalList = ref<Soal[]>([]);
const loading = ref(false);
const error = ref("");
const actionLoading = ref(false);

// Modal states
const showSoalFormModal = ref(false);
const showImportModal = ref(false);
const editingSoal = ref<Soal | null>(null);

// Confirmation dialog states
const showDeleteSoalConfirm = ref(false);
const deletingSoal = ref<Soal | null>(null);
const showEditConfirm = ref(false);
const confirmEditSoal = ref<Soal | null>(null);

// Get bank soal ID from route
const bankSoalId = computed(() => route.params.id as string);

// Computed: truncated soal text for preview (50-100 chars)
function truncateSoalText(text: string, maxLength = 80): string {
  const cleanText = text.replace(/<[^>]*>/g, "");
  if (cleanText.length <= maxLength) return cleanText;
  return cleanText.substring(0, maxLength) + "...";
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
    hour: "2-digit",
    minute: "2-digit",
  });
}

// API: Fetch bank soal detail with soal list
async function fetchBankSoalDetail() {
  loading.value = true;
  error.value = "";
  try {
    // TODO: Replace with actual API call when bank-soal API client is ready
    // const res = await getBankSoalDetail(bankSoalId.value);
    // bankSoal.value = res.data.bankSoal;
    // soalList.value = res.data.soalList;

    await new Promise((resolve) => setTimeout(resolve, 300));
    bankSoal.value = null;
    soalList.value = [];
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } };
    error.value =
      err.response?.data?.message || "Gagal memuat detail bank soal";
  } finally {
    loading.value = false;
  }
}

// Navigation
function handleBack() {
  router.push("/cbt/bank-soal");
}

// Soal actions
function handleAddSoal() {
  editingSoal.value = null;
  showSoalFormModal.value = true;
}

function handleImportSoal() {
  showImportModal.value = true;
}

function handleEditSoal(soal: Soal) {
  if (bankSoal.value?.isLocked) return;
  confirmEditSoal.value = soal;
  showEditConfirm.value = true;
}

function confirmEdit() {
  if (confirmEditSoal.value) {
    editingSoal.value = confirmEditSoal.value;
    showSoalFormModal.value = true;
  }
  showEditConfirm.value = false;
  confirmEditSoal.value = null;
}

function cancelEdit() {
  showEditConfirm.value = false;
  confirmEditSoal.value = null;
}

function confirmDeleteSoal(soal: Soal) {
  if (bankSoal.value?.isLocked) return;
  deletingSoal.value = soal;
  showDeleteSoalConfirm.value = true;
}

async function handleDeleteSoal() {
  if (!deletingSoal.value || !bankSoal.value) return;
  actionLoading.value = true;
  try {
    // TODO: Replace with actual API call
    // await deleteSoal(bankSoal.value.id, deletingSoal.value.id);
    await new Promise((resolve) => setTimeout(resolve, 500));
    showDeleteSoalConfirm.value = false;
    deletingSoal.value = null;
    await fetchBankSoalDetail();
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } };
    error.value = err.response?.data?.message || "Gagal menghapus soal";
  } finally {
    actionLoading.value = false;
  }
}

function cancelDeleteSoal() {
  showDeleteSoalConfirm.value = false;
  deletingSoal.value = null;
}

function closeSoalFormModal() {
  showSoalFormModal.value = false;
  editingSoal.value = null;
}

function closeImportModal() {
  showImportModal.value = false;
}

// Computed: convert Soal to SoalFormSoal format for modal (with gambar URLs)
const editingSoalWithGambar = computed((): SoalFormSoal | null => {
  if (!editingSoal.value) return null;
  return {
    id: editingSoal.value.id,
    teksSoal: editingSoal.value.teksSoal,
    opsiA: editingSoal.value.opsiA,
    opsiB: editingSoal.value.opsiB,
    opsiC: editingSoal.value.opsiC,
    opsiD: editingSoal.value.opsiD,
    opsiE: editingSoal.value.opsiE,
    jawabanBenar: editingSoal.value.jawabanBenar,
    gambarSoalUrl: editingSoal.value.gambarSoalUrl ?? null,
    gambarAUrl: editingSoal.value.gambarAUrl ?? null,
    gambarBUrl: editingSoal.value.gambarBUrl ?? null,
    gambarCUrl: editingSoal.value.gambarCUrl ?? null,
    gambarDUrl: editingSoal.value.gambarDUrl ?? null,
    gambarEUrl: editingSoal.value.gambarEUrl ?? null,
  };
});

// Handle soal form submit (add/edit)
async function handleSoalFormSubmit(data: SoalFormData) {
  if (!bankSoal.value) return;

  actionLoading.value = true;
  try {
    if (editingSoal.value) {
      // TODO: Replace with actual API call
      // await updateSoal(bankSoal.value.id, editingSoal.value.id, data);
      console.log("Update soal:", editingSoal.value.id, data);
    } else {
      // TODO: Replace with actual API call
      // await addSoal(bankSoal.value.id, data);
      console.log("Add soal:", data);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
    closeSoalFormModal();
    await fetchBankSoalDetail();
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } };
    error.value = err.response?.data?.message || "Gagal menyimpan soal";
  } finally {
    actionLoading.value = false;
  }
}

// Handle successful import
async function handleImportSuccess(count: number) {
  closeImportModal();
  // Refresh the soal list after successful import
  await fetchBankSoalDetail();
}

// Watch route param changes
watch(
  () => route.params.id,
  (newId: string | string[]) => {
    if (newId) {
      fetchBankSoalDetail();
    }
  },
);

// Lifecycle
onMounted(() => {
  fetchBankSoalDetail();
});
</script>

<template>
  <div>
    <!-- Page header with back button -->
    <div class="border-b border-gray-200 bg-white px-6 py-4">
      <div class="flex items-center gap-4 mb-3">
        <button
          class="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors"
          @click="handleBack"
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
          <span class="text-sm font-medium">Kembali</span>
        </button>
      </div>

      <!-- Loading state for header -->
      <div v-if="loading" class="animate-pulse">
        <div class="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
        <div class="h-4 bg-gray-100 rounded w-1/2"></div>
      </div>

      <!-- Bank Soal Header Info -->
      <div v-else-if="bankSoal" class="flex items-start justify-between">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-lg font-semibold text-gray-900">
              {{ bankSoal.nama }}
            </h1>
            <span
              :class="[
                'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                statusBadgeClass(bankSoal.status),
              ]"
            >
              {{ statusLabel(bankSoal.status) }}
            </span>
            <span
              v-if="bankSoal.isLocked"
              class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700"
              title="Bank soal terkunci karena sudah digunakan dalam sesi ujian"
            >
              <svg
                class="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              Terkunci
            </span>
          </div>
          <p class="text-sm text-gray-500 mt-1">
            {{ bankSoal.mataPelajaranNama }}
          </p>
        </div>

        <!-- Action buttons -->
        <div class="flex items-center gap-2">
          <button
            class="inline-flex items-center gap-2 border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
            @click="handleImportSoal"
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
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            Import dari Excel
          </button>
          <button
            class="inline-flex items-center gap-2 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors"
            @click="handleAddSoal"
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
            Tambah Soal
          </button>
        </div>
      </div>
    </div>

    <div class="px-6 py-6">
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

      <!-- Bank Soal not found -->
      <div v-else-if="!bankSoal" class="text-center py-12">
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
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p class="mt-2 text-sm text-gray-500">Bank soal tidak ditemukan.</p>
        <button
          class="mt-4 text-sm text-indigo-600 hover:text-indigo-800"
          @click="handleBack"
        >
          Kembali ke daftar
        </button>
      </div>

      <!-- Bank Soal Content -->
      <template v-else>
        <!-- Info Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <div class="bg-white rounded-lg border border-gray-200 p-4">
            <p
              class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1"
            >
              Durasi
            </p>
            <p class="text-lg font-semibold text-gray-900">
              {{ bankSoal.durasiMenit }} menit
            </p>
          </div>
          <div class="bg-white rounded-lg border border-gray-200 p-4">
            <p
              class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1"
            >
              KKM
            </p>
            <p class="text-lg font-semibold text-gray-900">
              {{ bankSoal.kkm }}
            </p>
          </div>
          <div
            class="bg-white rounded-lg border border-gray-200 p-4 col-span-2"
          >
            <p
              class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1"
            >
              Target Kelas
            </p>
            <div
              v-if="bankSoal.targetKelas.length > 0"
              class="flex flex-wrap gap-1"
            >
              <span
                v-for="kelas in bankSoal.targetKelas"
                :key="kelas"
                class="inline-flex rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                >{{ kelas }}</span
              >
            </div>
            <p v-else-if="bankSoal.tingkat" class="text-sm text-gray-900">
              Tingkat {{ bankSoal.tingkat }}
            </p>
            <p v-else class="text-sm text-gray-400">-</p>
          </div>
          <div class="bg-white rounded-lg border border-gray-200 p-4">
            <p
              class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1"
            >
              Acak Soal
            </p>
            <p
              class="text-sm font-medium"
              :class="
                bankSoal.shuffleQuestions ? 'text-emerald-600' : 'text-gray-500'
              "
            >
              {{ bankSoal.shuffleQuestions ? "Ya" : "Tidak" }}
            </p>
          </div>
          <div class="bg-white rounded-lg border border-gray-200 p-4">
            <p
              class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1"
            >
              Acak Opsi
            </p>
            <p
              class="text-sm font-medium"
              :class="
                bankSoal.shuffleOptions ? 'text-emerald-600' : 'text-gray-500'
              "
            >
              {{ bankSoal.shuffleOptions ? "Ya" : "Tidak" }}
            </p>
          </div>
        </div>

        <!-- Locked Warning Banner -->
        <div
          v-if="bankSoal.isLocked"
          class="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 flex items-center gap-2"
        >
          <svg
            class="h-5 w-5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span
            >Bank soal ini sudah digunakan dalam sesi ujian yang terkunci. Edit
            dan hapus soal tidak diizinkan.</span
          >
        </div>

        <!-- Soal List Table -->
        <div class="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div
            class="border-b border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between"
          >
            <h2 class="text-sm font-semibold text-gray-900">
              Daftar Soal ({{ soalList.length }})
            </h2>
          </div>
          <table class="min-w-full">
            <thead class="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  class="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500 w-16"
                >
                  No
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Teks Soal
                </th>
                <th
                  class="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500 w-24"
                >
                  Jawaban
                </th>
                <th
                  class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500 w-28"
                >
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr
                v-for="soal in soalList"
                :key="soal.id"
                class="hover:bg-gray-50/60 transition-colors"
              >
                <td class="px-4 py-3 text-center">
                  <span
                    class="inline-flex items-center justify-center rounded-full bg-gray-100 h-7 w-7 text-xs font-medium text-gray-700"
                    >{{ soal.nomorUrut }}</span
                  >
                </td>
                <td class="px-4 py-3">
                  <span class="text-sm text-gray-700">{{
                    truncateSoalText(soal.teksSoal)
                  }}</span>
                </td>
                <td class="px-4 py-3 text-center">
                  <span
                    class="inline-flex items-center justify-center rounded bg-indigo-100 h-7 w-7 text-xs font-bold text-indigo-700"
                    >{{ soal.jawabanBenar }}</span
                  >
                </td>

                <td class="px-4 py-3 text-right">
                  <div class="flex items-center justify-end gap-1">
                    <button
                      :disabled="bankSoal.isLocked"
                      :title="
                        bankSoal.isLocked
                          ? 'Tidak dapat diedit karena bank soal terkunci'
                          : 'Edit'
                      "
                      :class="[
                        'rounded-md p-1.5 transition-colors',
                        bankSoal.isLocked
                          ? 'text-gray-300 cursor-not-allowed'
                          : 'text-gray-400 hover:bg-indigo-50 hover:text-indigo-600',
                      ]"
                      @click="handleEditSoal(soal)"
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
                    <button
                      :disabled="bankSoal.isLocked"
                      :title="
                        bankSoal.isLocked
                          ? 'Tidak dapat dihapus karena bank soal terkunci'
                          : 'Hapus'
                      "
                      :class="[
                        'rounded-md p-1.5 transition-colors',
                        bankSoal.isLocked
                          ? 'text-gray-300 cursor-not-allowed'
                          : 'text-gray-400 hover:bg-red-50 hover:text-red-600',
                      ]"
                      @click="confirmDeleteSoal(soal)"
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
              <tr v-if="soalList.length === 0">
                <td colspan="4" class="py-12 text-center">
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
                    Belum ada soal. Klik "Tambah Soal" atau "Import dari Excel"
                    untuk memulai.
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-4 text-xs text-gray-400">
          <p>Dibuat: {{ formatDate(bankSoal.createdAt) }}</p>
          <p>Terakhir diubah: {{ formatDate(bankSoal.updatedAt) }}</p>
        </div>
      </template>
    </div>

    <!-- Edit Confirmation Modal -->
    <Teleport to="body">
      <div
        v-if="showEditConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="cancelEdit"
      >
        <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100"
            >
              <svg
                class="h-5 w-5 text-indigo-600"
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
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900">Edit Soal</h3>
              <p class="text-sm text-gray-500">Konfirmasi perubahan</p>
            </div>
          </div>
          <div v-if="confirmEditSoal" class="mt-4">
            <p class="text-sm text-gray-700">
              Apakah Anda yakin ingin mengubah soal nomor
              <strong>{{ confirmEditSoal.nomorUrut }}</strong
              >?
            </p>
          </div>
          <div class="mt-6 flex justify-end gap-3">
            <button
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              @click="cancelEdit"
            >
              Batal
            </button>
            <button
              class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              @click="confirmEdit"
            >
              Ya, Edit
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Delete Soal Confirmation Modal -->
    <Teleport to="body">
      <div
        v-if="showDeleteSoalConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="cancelDeleteSoal"
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
              <h3 class="text-lg font-semibold text-gray-900">Hapus Soal</h3>
              <p class="text-sm text-gray-500">
                Tindakan ini tidak dapat dibatalkan
              </p>
            </div>
          </div>
          <div v-if="deletingSoal" class="mt-4">
            <p class="text-sm text-gray-700">
              Apakah Anda yakin ingin menghapus soal nomor
              <strong>{{ deletingSoal.nomorUrut }}</strong
              >?
            </p>
            <p class="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2">
              {{ truncateSoalText(deletingSoal.teksSoal, 150) }}
            </p>
          </div>
          <div class="mt-6 flex justify-end gap-3">
            <button
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              :disabled="actionLoading"
              @click="cancelDeleteSoal"
            >
              Batal
            </button>
            <button
              class="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              :disabled="actionLoading"
              @click="handleDeleteSoal"
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

    <!-- Soal Form Modal -->
    <SoalFormModal
      :show="showSoalFormModal"
      :is-edit="!!editingSoal"
      :soal="editingSoalWithGambar"
      @close="closeSoalFormModal"
      @submit="handleSoalFormSubmit"
    />

    <!-- Import Soal Modal -->
    <ImportSoalModal
      :show="showImportModal"
      :bank-soal-id="bankSoalId"
      @close="closeImportModal"
      @imported="handleImportSuccess"
    />
  </div>
</template>
