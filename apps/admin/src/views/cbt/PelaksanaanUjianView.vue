<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import ActionButton from "@/components/ui/ActionButton.vue";
import {
  getPelaksanaanUjianList,
  createPelaksanaanUjian,
  deactivatePelaksanaanUjian,
  getExamSessions,
  exportPelaksanaanUjianResults,
  getTahunAjaranAktif,
  type PelaksanaanUjian,
  type TahunAjaran,
} from "@/api/cbt";

const items = ref<PelaksanaanUjian[]>([]);
const loading = ref(false);
const error = ref("");
const showCreateForm = ref(false);

// Active tahun ajaran from LMS
const tahunAjaranAktif = ref<TahunAjaran | null>(null);
const loadingTahunAjaran = ref(false);

// Track completed session counts per Pelaksanaan Ujian
const completedSessionCounts = ref<Record<string, number>>({});

// Export state
const exportMenuOpenId = ref<string | null>(null);
const exportingId = ref<string | null>(null);
const exportError = ref("");

// Filter state
const filterPeriode = ref<string>("");
const filterStatus = ref<string>("");

// Create form state - simplified
const form = ref({
  periodeRapor: "",
});

const periodeOptions = [
  { value: "uts_semester_1", label: "UTS Semester 1" },
  { value: "semester_1", label: "Semester 1" },
  { value: "uts_semester_2", label: "UTS Semester 2" },
  { value: "semester_2", label: "Semester 2" },
];

const statusOptions = [
  { value: "", label: "Semua Status" },
  { value: "true", label: "Aktif" },
  { value: "false", label: "Nonaktif" },
];

async function fetchTahunAjaranAktif() {
  loadingTahunAjaran.value = true;
  try {
    const res = await getTahunAjaranAktif();
    tahunAjaranAktif.value = res.data;
  } catch (e: any) {
    console.error("Gagal memuat tahun ajaran aktif:", e);
    tahunAjaranAktif.value = null;
  } finally {
    loadingTahunAjaran.value = false;
  }
}

async function fetchData() {
  loading.value = true;
  error.value = "";
  try {
    const params: Record<string, string> = {};
    if (filterPeriode.value) params.periodeRapor = filterPeriode.value;
    if (filterStatus.value) params.isActive = filterStatus.value;

    const res = await getPelaksanaanUjianList(
      Object.keys(params).length > 0 ? params : undefined,
    );
    items.value = res.data;

    // Fetch completed session counts for each Pelaksanaan Ujian
    await fetchCompletedSessionCounts();
  } catch (e: any) {
    error.value = e.response?.data?.message || "Gagal memuat data";
  } finally {
    loading.value = false;
  }
}

async function fetchCompletedSessionCounts() {
  const counts: Record<string, number> = {};

  // Fetch completed sessions for each Pelaksanaan Ujian
  await Promise.all(
    items.value.map(async (item) => {
      try {
        const res = await getExamSessions({
          pelaksanaanUjianId: item.id,
          status: "completed",
        });
        counts[item.id] = res.data.data.length;
      } catch {
        counts[item.id] = 0;
      }
    }),
  );

  completedSessionCounts.value = counts;
}

function hasCompletedSessions(puId: string): boolean {
  return (completedSessionCounts.value[puId] || 0) > 0;
}

// Export menu handlers
function toggleExportMenu(puId: string) {
  if (exportMenuOpenId.value === puId) {
    exportMenuOpenId.value = null;
  } else {
    exportMenuOpenId.value = puId;
  }
}

function closeExportMenu() {
  exportMenuOpenId.value = null;
}

async function handleExport(puId: string, detail: boolean) {
  exportMenuOpenId.value = null;
  exportingId.value = puId;
  exportError.value = "";
  try {
    await exportPelaksanaanUjianResults(puId, detail);
  } catch (e: any) {
    exportError.value =
      e.response?.data?.message || "Gagal mengekspor hasil ujian";
  } finally {
    exportingId.value = null;
  }
}

function openCreateForm() {
  form.value.periodeRapor = "";
  showCreateForm.value = true;
}

async function handleCreate() {
  if (!form.value.periodeRapor) {
    error.value = "Pilih periode rapor";
    return;
  }
  try {
    await createPelaksanaanUjian({
      periodeRapor: form.value.periodeRapor,
    });
    showCreateForm.value = false;
    form.value.periodeRapor = "";
    await fetchData();
  } catch (e: any) {
    error.value =
      e.response?.data?.message || "Gagal membuat pelaksanaan ujian";
  }
}

async function handleDeactivate(id: string) {
  if (!confirm("Yakin ingin menonaktifkan pelaksanaan ujian ini?")) return;
  try {
    await deactivatePelaksanaanUjian(id);
    await fetchData();
  } catch (e: any) {
    error.value = e.response?.data?.message || "Gagal menonaktifkan";
  }
}

onMounted(() => {
  fetchTahunAjaranAktif();
  fetchData();
});

// Watch filters
watch([filterPeriode, filterStatus], () => {
  fetchData();
});

// Close export menu when clicking outside
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement;
  // Check if click is outside any export menu container
  if (exportMenuOpenId.value && !target.closest("[data-export-menu]")) {
    exportMenuOpenId.value = null;
  }
}

onMounted(() => {
  document.addEventListener("click", handleClickOutside, true);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside, true);
});

// Helper to get periode label
function getPeriodeLabel(value: string): string {
  const option = periodeOptions.find((o) => o.value === value);
  return option?.label || value;
}
</script>

<template>
  <div>
    <!-- Page header -->
    <div
      class="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between"
    >
      <div>
        <h1 class="text-lg font-semibold text-gray-900">Pelaksanaan Ujian</h1>
        <p class="text-sm text-gray-500 mt-0.5">
          Kelola periode pelaksanaan ujian CBT
        </p>
      </div>
      <ActionButton variant="primary" @click="openCreateForm">
        + Buat Baru
      </ActionButton>
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

      <!-- Export error banner -->
      <div
        v-if="exportError"
        class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center justify-between"
      >
        <span>{{ exportError }}</span>
        <button
          class="text-red-500 hover:text-red-700"
          @click="exportError = ''"
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <!-- Create Form Modal -->
      <Teleport to="body">
        <div
          v-if="showCreateForm"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          @click.self="showCreateForm = false"
        >
          <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">
              Buat Pelaksanaan Ujian Baru
            </h2>

            <!-- Tahun Ajaran Info -->
            <div
              class="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3"
            >
              <p class="text-xs font-medium text-indigo-600 uppercase mb-1">
                Tahun Ajaran Aktif
              </p>
              <p
                v-if="loadingTahunAjaran"
                class="text-sm text-indigo-700 animate-pulse"
              >
                Memuat...
              </p>
              <p
                v-else-if="tahunAjaranAktif"
                class="text-base font-semibold text-indigo-900"
              >
                {{ tahunAjaranAktif.nama }}
              </p>
              <p v-else class="text-sm text-red-600">
                Tidak ada tahun ajaran aktif. Aktifkan tahun ajaran di LMS
                terlebih dahulu.
              </p>
            </div>

            <form @submit.prevent="handleCreate">
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1"
                  >Periode Rapor</label
                >
                <select
                  v-model="form.periodeRapor"
                  class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  required
                >
                  <option value="" disabled>Pilih Periode</option>
                  <option
                    v-for="opt in periodeOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </option>
                </select>
              </div>

              <div class="flex gap-2 justify-end pt-2">
                <ActionButton
                  variant="neutral"
                  type="button"
                  @click="showCreateForm = false"
                >
                  Batal
                </ActionButton>
                <ActionButton
                  variant="primary"
                  type="submit"
                  :disabled="!tahunAjaranAktif || !form.periodeRapor"
                >
                  Simpan
                </ActionButton>
              </div>
            </form>
          </div>
        </div>
      </Teleport>

      <!-- Filters -->
      <div class="mb-5 flex flex-wrap items-center gap-3">
        <select
          v-model="filterPeriode"
          class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
        >
          <option value="">Semua Periode</option>
          <option
            v-for="opt in periodeOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>

        <select
          v-model="filterStatus"
          class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
        >
          <option
            v-for="opt in statusOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div
          class="h-7 w-7 animate-spin rounded-full border-[3px] border-indigo-600 border-t-transparent"
        ></div>
      </div>

      <!-- Table -->
      <div
        v-else
        class="overflow-visible rounded-xl border border-gray-200 bg-white"
      >
        <div class="overflow-x-auto">
          <table class="min-w-full">
            <thead class="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Nama
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  Periode
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
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
                v-for="item in items"
                :key="item.id"
                class="hover:bg-gray-50/60 transition-colors"
              >
                <td class="px-4 py-3 text-sm text-gray-900 font-medium">
                  {{ item.nama }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-600">
                  {{ getPeriodeLabel(item.periodeRapor) }}
                </td>
                <td class="px-4 py-3">
                  <span
                    :class="[
                      'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                      item.isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-500',
                    ]"
                  >
                    {{ item.isActive ? "Aktif" : "Nonaktif" }}
                  </span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600">
                  {{ new Date(item.createdAt).toLocaleDateString("id-ID") }}
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <!-- Export button - only show when completed sessions exist -->
                    <div
                      v-if="hasCompletedSessions(item.id)"
                      class="relative"
                      data-export-menu
                    >
                      <!-- Export loading indicator -->
                      <div
                        v-if="exportingId === item.id"
                        class="flex items-center gap-2 text-sm text-gray-500"
                      >
                        <div
                          class="h-4 w-4 animate-spin rounded-full border-2 border-green-600 border-t-transparent"
                        ></div>
                        <span>Mengekspor...</span>
                      </div>

                      <!-- Export dropdown button -->
                      <template v-else>
                        <ActionButton
                          variant="success"
                          icon="download"
                          @click="toggleExportMenu(item.id)"
                        >
                          Export Semua
                        </ActionButton>
                      </template>

                      <!-- Export dropdown menu -->
                      <div
                        v-if="exportMenuOpenId === item.id"
                        class="absolute right-0 z-50 mt-1 w-56 origin-top-right rounded-lg border border-gray-200 bg-white shadow-lg"
                      >
                        <div class="py-1">
                          <button
                            class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                            @click="handleExport(item.id, false)"
                          >
                            <svg
                              class="h-4 w-4 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            Export Ringkasan
                          </button>
                          <button
                            class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                            @click="handleExport(item.id, true)"
                          >
                            <svg
                              class="h-4 w-4 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                              />
                            </svg>
                            Export dengan Detail Jawaban
                          </button>
                        </div>
                      </div>
                    </div>

                    <!-- Deactivate button -->
                    <ActionButton
                      v-if="item.isActive"
                      variant="danger"
                      icon="x"
                      @click="handleDeactivate(item.id)"
                    >
                      Nonaktifkan
                    </ActionButton>
                  </div>
                </td>
              </tr>
              <tr v-if="items.length === 0">
                <td colspan="5" class="py-10 text-center text-sm text-gray-400">
                  Belum ada pelaksanaan ujian.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
