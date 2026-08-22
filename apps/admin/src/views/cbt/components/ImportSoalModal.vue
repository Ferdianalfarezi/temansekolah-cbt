<script setup lang="ts">
import { ref, computed, watch } from "vue";
import {
  downloadTemplate as downloadTemplateApi,
  importSoalPreview,
  importSoal,
  getErrorMessage,
} from "@/api/bank-soal";

// Types
export interface ParsedSoal {
  nomorSoal: number;
  teksSoal: string;
  jawabanBenar: string;
  opsiA: string;
  opsiB: string;
  opsiC: string;
  opsiD: string;
  opsiE: string | null;
}

export interface ImportError {
  row: number;
  message: string;
}

export interface ImportPreviewResult {
  validRows: ParsedSoal[];
  errors: ImportError[];
}

interface Props {
  show: boolean;
  bankSoalId: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  imported: [count: number];
}>();

// State
const currentStep = ref<1 | 2>(1);
const selectedFile = ref<File | null>(null);
const isDragging = ref(false);
const parsing = ref(false);
const importing = ref(false);
const parseError = ref("");

// Preview data
const validRows = ref<ParsedSoal[]>([]);
const errors = ref<ImportError[]>([]);

// Computed: has valid rows to import
const hasValidRows = computed(() => validRows.value.length > 0);

// Computed: summary text
const summaryText = computed(() => {
  const valid = validRows.value.length;
  const invalid = errors.value.length;
  if (valid === 0 && invalid === 0) return "";
  return `${valid} soal valid, ${invalid} soal dengan error`;
});

// Truncate text for preview
function truncateText(text: string, maxLength = 60): string {
  if (!text) return "-";
  const clean = text.replace(/<[^>]*>/g, "").trim();
  if (clean.length <= maxLength) return clean;
  return clean.substring(0, maxLength) + "...";
}

// Handle file selection
function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    validateAndSetFile(file);
  }
}

// Handle drag and drop
function handleDragOver(event: DragEvent) {
  event.preventDefault();
  isDragging.value = true;
}

function handleDragLeave() {
  isDragging.value = false;
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;
  const file = event.dataTransfer?.files[0];
  if (file) {
    validateAndSetFile(file);
  }
}

// Validate file type and set
function validateAndSetFile(file: File) {
  parseError.value = "";
  const validTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ];
  const validExtensions = [".xlsx", ".xls"];
  const hasValidExtension = validExtensions.some((ext) =>
    file.name.toLowerCase().endsWith(ext),
  );

  if (!validTypes.includes(file.type) && !hasValidExtension) {
    parseError.value = "File harus berformat Excel (.xlsx atau .xls)";
    return;
  }

  selectedFile.value = file;
  parseExcelFile(file);
}

// Parse Excel file via backend API (server-side parsing)
async function parseExcelFile(file: File) {
  parsing.value = true;
  parseError.value = "";
  validRows.value = [];
  errors.value = [];

  try {
    const response = await importSoalPreview(props.bankSoalId, file);
    validRows.value = response.data.validRows;
    errors.value = response.data.errors;
    currentStep.value = 2;
  } catch (e: unknown) {
    parseError.value = getErrorMessage(e);
  } finally {
    parsing.value = false;
  }
}

// Download Excel template
async function downloadTemplate() {
  parseError.value = "";
  try {
    await downloadTemplateApi();
  } catch (e) {
    parseError.value = getErrorMessage(e);
  }
}

// Confirm import
async function confirmImport() {
  if (!selectedFile.value || !hasValidRows.value) return;

  importing.value = true;
  try {
    const response = await importSoal(props.bankSoalId, selectedFile.value);
    emit("imported", response.data.imported);
    handleClose();
  } catch (e: unknown) {
    parseError.value = getErrorMessage(e);
  } finally {
    importing.value = false;
  }
}

// Reset state
function resetState() {
  currentStep.value = 1;
  selectedFile.value = null;
  isDragging.value = false;
  parsing.value = false;
  importing.value = false;
  parseError.value = "";
  validRows.value = [];
  errors.value = [];
}

// Go back to step 1
function goBackToUpload() {
  currentStep.value = 1;
  selectedFile.value = null;
  validRows.value = [];
  errors.value = [];
  parseError.value = "";
}

// Handle close
function handleClose() {
  resetState();
  emit("close");
}

// Watch for modal visibility
watch(
  () => props.show,
  (newVal: boolean) => {
    if (!newVal) {
      resetState();
    }
  },
);
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-in-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200 ease-in-out"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 backdrop-blur-[2px]"
          style="background: rgba(28, 25, 23, 0.4)"
          @click="handleClose"
        />

        <!-- Modal panel -->
        <div
          class="relative bg-white rounded-[16px] shadow-lg w-full max-w-3xl overflow-hidden"
          style="box-shadow: var(--shadow-lg)"
        >
          <!-- Header -->
          <div
            class="flex items-center justify-between px-6 py-4"
            style="border-bottom: 2px solid var(--color-border)"
          >
            <div class="flex items-center gap-3">
              <h2
                class="text-[18px] font-bold"
                style="color: var(--color-text-primary)"
              >
                Import Soal dari Excel
              </h2>
              <!-- Step indicator -->
              <div class="flex items-center gap-1.5 ml-2">
                <span
                  :class="[
                    'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium',
                    currentStep === 1
                      ? 'bg-indigo-600 text-white'
                      : 'bg-indigo-100 text-indigo-700',
                  ]"
                  >1</span
                >
                <span class="w-4 h-0.5 bg-gray-200"></span>
                <span
                  :class="[
                    'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium',
                    currentStep === 2
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-400',
                  ]"
                  >2</span
                >
              </div>
            </div>
            <button
              class="p-2 rounded-lg transition-colors hover:bg-gray-100"
              style="color: var(--color-text-tertiary)"
              @click="handleClose"
            >
              <svg
                class="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="px-6 py-5 max-h-[70vh] overflow-y-auto">
            <!-- Error Banner -->
            <div
              v-if="parseError"
              class="mb-4 rounded-xl p-3 text-sm flex items-center justify-between bg-red-50 border border-red-200 text-red-700"
            >
              <div class="flex items-center gap-2">
                <svg
                  class="w-5 h-5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{{ parseError }}</span>
              </div>
              <button
                class="p-1 rounded hover:bg-red-100 transition-colors"
                @click="parseError = ''"
              >
                <svg
                  class="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <!-- Step 1: Upload -->
            <div v-if="currentStep === 1">
              <!-- Download Template Link -->
              <div class="mb-5">
                <button
                  type="button"
                  class="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                  @click="downloadTemplate"
                >
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Download Template Excel
                </button>
                <p class="mt-1 text-xs text-gray-500">
                  Gunakan template yang disediakan untuk memastikan format data
                  benar
                </p>
              </div>

              <!-- File Upload Area -->
              <div
                :class="[
                  'relative border-2 border-dashed rounded-xl p-8 text-center transition-colors',
                  isDragging
                    ? 'border-indigo-400 bg-indigo-50'
                    : 'border-gray-300 hover:border-gray-400',
                  parsing ? 'pointer-events-none opacity-60' : '',
                ]"
                @dragover="handleDragOver"
                @dragleave="handleDragLeave"
                @drop="handleDrop"
              >
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  :disabled="parsing"
                  @change="handleFileSelect"
                />

                <div v-if="parsing" class="flex flex-col items-center">
                  <div
                    class="h-10 w-10 animate-spin rounded-full border-[3px] border-indigo-600 border-t-transparent"
                  ></div>
                  <p class="mt-3 text-sm font-medium text-gray-600">
                    Memparse file...
                  </p>
                </div>

                <div v-else class="flex flex-col items-center">
                  <div
                    class="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3"
                  >
                    <svg
                      class="w-7 h-7 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="1.5"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <p class="text-sm font-medium text-gray-700 mb-1">
                    Drag & drop file Excel atau
                    <span class="text-indigo-600">pilih file</span>
                  </p>
                  <p class="text-xs text-gray-500">Format: .xlsx atau .xls</p>
                </div>
              </div>

              <!-- Template format info -->
              <div
                class="mt-5 p-4 rounded-xl bg-gray-50 border border-gray-200"
              >
                <h4 class="text-xs font-semibold text-gray-700 mb-2">
                  Format Kolom Template:
                </h4>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div class="px-2 py-1 rounded bg-gray-100">
                    <span class="text-gray-600">nomor_soal</span>
                    <span class="ml-1 text-[10px] text-red-500">*</span>
                  </div>
                  <div class="px-2 py-1 rounded bg-gray-100">
                    <span class="text-gray-600">teks_soal</span>
                    <span class="ml-1 text-[10px] text-red-500">*</span>
                  </div>
                  <div class="px-2 py-1 rounded bg-gray-100">
                    <span class="text-gray-600">jawaban_benar</span>
                    <span class="ml-1 text-[10px] text-red-500">*</span>
                  </div>
                  <div class="px-2 py-1 rounded bg-gray-100">
                    <span class="text-gray-600">opsi_a</span>
                    <span class="ml-1 text-[10px] text-red-500">*</span>
                  </div>
                  <div class="px-2 py-1 rounded bg-gray-100">
                    <span class="text-gray-600">opsi_b</span>
                    <span class="ml-1 text-[10px] text-red-500">*</span>
                  </div>
                  <div class="px-2 py-1 rounded bg-gray-100">
                    <span class="text-gray-600">opsi_c</span>
                    <span class="ml-1 text-[10px] text-red-500">*</span>
                  </div>
                  <div class="px-2 py-1 rounded bg-gray-100">
                    <span class="text-gray-600">opsi_d</span>
                    <span class="ml-1 text-[10px] text-red-500">*</span>
                  </div>
                  <div class="px-2 py-1 rounded bg-gray-100">
                    <span class="text-gray-600">opsi_e</span>
                    <span class="ml-1 text-[10px] text-gray-400"
                      >(opsional)</span
                    >
                  </div>
                </div>
                <p class="mt-2 text-[11px] text-gray-500">* = wajib diisi</p>
              </div>
            </div>

            <!-- Step 2: Preview -->
            <div v-if="currentStep === 2">
              <!-- File info and back button -->
              <div
                class="mb-4 flex items-center justify-between p-3 rounded-lg bg-gray-50"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center"
                  >
                    <svg
                      class="w-5 h-5 text-emerald-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p class="text-sm font-medium text-gray-900">
                      {{ selectedFile?.name }}
                    </p>
                    <p class="text-xs text-gray-500">{{ summaryText }}</p>
                  </div>
                </div>
                <button
                  type="button"
                  class="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                  @click="goBackToUpload"
                >
                  Ganti File
                </button>
              </div>

              <!-- Error List -->
              <div
                v-if="errors.length > 0"
                class="mb-4 rounded-xl overflow-hidden border border-red-200"
              >
                <div
                  class="px-4 py-2.5 flex items-center gap-2 bg-red-50 border-b border-red-200"
                >
                  <svg
                    class="w-4 h-4 text-red-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span class="text-xs font-semibold text-red-700"
                    >{{ errors.length }} Baris Bermasalah</span
                  >
                </div>
                <div class="max-h-32 overflow-y-auto bg-red-50">
                  <div
                    v-for="err in errors"
                    :key="err.row"
                    class="px-4 py-2 text-xs flex items-start gap-2 text-red-700 border-b border-red-100 last:border-0"
                  >
                    <span
                      class="shrink-0 inline-flex items-center justify-center rounded bg-red-200 px-1.5 py-0.5 text-[10px] font-medium"
                    >
                      Baris {{ err.row }}
                    </span>
                    <span>{{ err.message }}</span>
                  </div>
                </div>
              </div>

              <!-- Valid Rows Preview Table -->
              <div
                v-if="validRows.length > 0"
                class="rounded-xl overflow-hidden border border-gray-200"
              >
                <div
                  class="px-4 py-2.5 flex items-center gap-2 bg-emerald-50 border-b border-gray-200"
                >
                  <svg
                    class="w-4 h-4 text-emerald-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span class="text-xs font-semibold text-emerald-700"
                    >{{ validRows.length }} Soal Siap Diimpor</span
                  >
                </div>
                <div class="max-h-64 overflow-auto">
                  <table class="min-w-full">
                    <thead class="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th
                          class="px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wide text-gray-500 w-14"
                        >
                          No
                        </th>
                        <th
                          class="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                        >
                          Teks Soal
                        </th>
                        <th
                          class="px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wide text-gray-500 w-20"
                        >
                          Jawaban
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="row in validRows"
                        :key="row.nomorSoal"
                        class="border-b border-gray-100 last:border-0"
                      >
                        <td class="px-4 py-2.5 text-center">
                          <span
                            class="inline-flex items-center justify-center rounded-full h-6 w-6 text-xs font-medium bg-gray-100 text-gray-600"
                          >
                            {{ row.nomorSoal }}
                          </span>
                        </td>
                        <td class="px-4 py-2.5">
                          <span class="text-xs text-gray-700">{{
                            truncateText(row.teksSoal)
                          }}</span>
                        </td>
                        <td class="px-4 py-2.5 text-center">
                          <span
                            class="inline-flex items-center justify-center rounded h-6 w-6 text-xs font-bold bg-indigo-100 text-indigo-700"
                          >
                            {{ row.jawabanBenar }}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Empty state when no valid rows and no errors -->
              <div
                v-if="validRows.length === 0 && errors.length === 0"
                class="py-12 text-center"
              >
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
                  File tidak memiliki data soal yang valid
                </p>
                <button
                  type="button"
                  class="mt-3 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                  @click="goBackToUpload"
                >
                  Upload file lain
                </button>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div
            class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200"
          >
            <button
              type="button"
              class="px-4 py-2.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              :disabled="importing"
              @click="handleClose"
            >
              Batal
            </button>
            <button
              v-if="currentStep === 2"
              type="button"
              class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
              :class="[
                hasValidRows
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed',
              ]"
              :disabled="!hasValidRows || importing"
              @click="confirmImport"
            >
              <svg
                v-if="importing"
                class="w-4 h-4 animate-spin"
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
              <span>{{
                importing ? "Mengimpor..." : `Import ${validRows.length} Soal`
              }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
