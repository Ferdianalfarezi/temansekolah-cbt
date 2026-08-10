<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import {
  getPelaksanaanUjianList,
  createPelaksanaanUjian,
  deactivatePelaksanaanUjian,
  getExamSessions,
  exportPelaksanaanUjianResults,
  type PelaksanaanUjian,
} from "@/api/cbt";

const items = ref<PelaksanaanUjian[]>([]);
const loading = ref(false);
const error = ref("");
const showCreateForm = ref(false);

// Track completed session counts per Pelaksanaan Ujian
const completedSessionCounts = ref<Record<string, number>>({});

// Export state
const exportMenuOpenId = ref<string | null>(null);
const exportingId = ref<string | null>(null);
const exportError = ref("");

// Create form state
const form = ref({
  tahunAjaranId: "",
  periodeRapor: "",
  komponenPenilaianId: "",
});

const periodeOptions = [
  { value: "uts_semester_1", label: "UTS Semester 1" },
  { value: "semester_1", label: "Semester 1" },
  { value: "uts_semester_2", label: "UTS Semester 2" },
  { value: "semester_2", label: "Semester 2" },
];

async function fetchData() {
  loading.value = true;
  error.value = "";
  try {
    const res = await getPelaksanaanUjianList();
    // Handle both array response and { data: [], meta: {} } response
    items.value = Array.isArray(res.data) ? res.data : (res.data.data ?? []);

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
        // Handle both array response and { data: [], meta: {} } response
        const sessions = Array.isArray(res.data)
          ? res.data
          : (res.data.data ?? []);
        counts[item.id] = sessions.length;
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

async function handleCreate() {
  try {
    await createPelaksanaanUjian(form.value);
    showCreateForm.value = false;
    form.value = {
      tahunAjaranId: "",
      periodeRapor: "",
      komponenPenilaianId: "",
    };
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

onMounted(fetchData);

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
      <button
        class="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors"
        @click="showCreateForm = !showCreateForm"
      >
        + Buat Baru
      </button>
    </div>

    <div class="px-6 py-6">
      <!-- Error banner -->
      <div
        v-if="error"
        class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
      >
        {{ error }}
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

      <!-- Create Form -->
      <div
        v-if="showCreateForm"
        class="mb-6 rounded-xl border border-gray-200 bg-white p-5"
      >
        <h2 class="mb-4 text-sm font-semibold text-gray-700">
          Buat Pelaksanaan Ujian Baru
        </h2>
        <form
          class="grid grid-cols-1 gap-4 md:grid-cols-3"
          @submit.prevent="handleCreate"
        >
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1"
              >Tahun Ajaran ID</label
            >
            <input
              v-model="form.tahunAjaranId"
              type="text"
              class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              placeholder="UUID tahun ajaran"
              required
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1"
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
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1"
              >Komponen Penilaian ID</label
            >
            <input
              v-model="form.komponenPenilaianId"
              type="text"
              class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              placeholder="UUID komponen"
              required
            />
          </div>
          <div class="md:col-span-3 flex gap-2 pt-1">
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

      <!-- Table -->
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
                {{ item.periodeRapor }}
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
                    <button
                      v-else
                      class="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors"
                      title="Export semua hasil"
                      @click="toggleExportMenu(item.id)"
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
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      Export Semua Hasil
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
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    <!-- Export dropdown menu -->
                    <div
                      v-if="exportMenuOpenId === item.id"
                      class="absolute right-0 z-10 mt-1 w-56 origin-top-right rounded-lg border border-gray-200 bg-white shadow-lg"
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
                  <button
                    v-if="item.isActive"
                    class="text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
                    @click="handleDeactivate(item.id)"
                  >
                    Nonaktifkan
                  </button>
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
</template>
