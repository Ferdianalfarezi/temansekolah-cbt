<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import ActionButton from "@/components/ui/ActionButton.vue";
import {
  getExamSessions,
  packageSession,
  cancelSession,
  releaseResults,
  exportSessionResults,
  type ExamSession,
  type ExamSessionStatus,
} from "@/api/cbt";

const sessions = ref<ExamSession[]>([]);
const loading = ref(false);
const error = ref("");
const statusFilter = ref<ExamSessionStatus | "">("");

// Export menu state
const exportMenuOpenId = ref<string | null>(null);
const exportingId = ref<string | null>(null);

// Close dropdown when clicking outside
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest("[data-export-menu]")) {
    exportMenuOpenId.value = null;
  }
}

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});

const statusOptions: { value: ExamSessionStatus | ""; label: string }[] = [
  { value: "", label: "Semua Status" },
  { value: "draft", label: "Draft" },
  { value: "packaged", label: "Packaged" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

async function fetchSessions() {
  loading.value = true;
  error.value = "";
  try {
    const params = statusFilter.value
      ? { status: statusFilter.value }
      : undefined;
    const res = await getExamSessions(params);
    sessions.value = res.data.data;
  } catch (e: any) {
    error.value = e.response?.data?.message || "Gagal memuat sesi ujian";
  } finally {
    loading.value = false;
  }
}

async function handlePackage(id: string) {
  try {
    await packageSession(id);
    await fetchSessions();
  } catch (e: any) {
    error.value = e.response?.data?.message || "Gagal package sesi";
  }
}

async function handleCancel(id: string) {
  const reason = prompt("Alasan pembatalan:");
  if (!reason) return;
  try {
    await cancelSession(id, reason);
    await fetchSessions();
  } catch (e: any) {
    error.value = e.response?.data?.message || "Gagal membatalkan sesi";
  }
}

async function handleRelease(id: string) {
  if (!confirm("Rilis hasil ujian? Nilai akan di-push ke rapor.")) return;
  try {
    await releaseResults(id);
    await fetchSessions();
  } catch (e: any) {
    error.value = e.response?.data?.message || "Gagal merilis hasil";
  }
}

function statusBadgeClass(status: ExamSessionStatus) {
  const map: Record<ExamSessionStatus, string> = {
    draft: "bg-gray-100 text-gray-700",
    packaged: "bg-yellow-100 text-yellow-800",
    active: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-700",
  };
  return map[status] || "bg-gray-100 text-gray-700";
}

// Export menu handlers
function toggleExportMenu(sessionId: string) {
  if (exportMenuOpenId.value === sessionId) {
    exportMenuOpenId.value = null;
  } else {
    exportMenuOpenId.value = sessionId;
  }
}

async function handleExport(sessionId: string, detail: boolean) {
  exportMenuOpenId.value = null;
  exportingId.value = sessionId;
  error.value = "";
  try {
    await exportSessionResults(sessionId, detail);
  } catch (e: any) {
    error.value = e.response?.data?.message || "Gagal mengekspor hasil ujian";
  } finally {
    exportingId.value = null;
  }
}

watch(statusFilter, fetchSessions);
onMounted(fetchSessions);
</script>

<template>
  <div>
    <!-- Page header -->
    <div
      class="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between"
    >
      <div>
        <h1 class="text-lg font-semibold text-gray-900">Sesi Ujian</h1>
        <p class="text-sm text-gray-500 mt-0.5">Daftar sesi ujian CBT</p>
      </div>
      <!-- Filter bar -->
      <div class="flex items-center gap-2">
        <select
          v-model="statusFilter"
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
    </div>

    <div class="px-6 py-6">
      <div
        v-if="error"
        class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
      >
        {{ error }}
      </div>

      <div v-if="loading" class="flex items-center justify-center py-12">
        <div
          class="h-7 w-7 animate-spin rounded-full border-[3px] border-indigo-600 border-t-transparent"
        ></div>
      </div>

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
                Mapel
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                Kelas
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                Jadwal
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                Durasi
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                Status
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
              v-for="s in sessions"
              :key="s.id"
              class="hover:bg-gray-50/60 transition-colors"
            >
              <td class="px-4 py-3 text-sm text-gray-900 font-medium">
                {{ s.mataPelajaranId?.slice(0, 8) ?? "-" }}…
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">
                {{ s.kelasId?.slice(0, 8) ?? "-" }}…
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">
                {{ new Date(s.scheduledAt).toLocaleString("id-ID") }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">
                {{ s.durationMinutes }} menit
              </td>
              <td class="px-4 py-3">
                <!-- draft -->
                <span
                  v-if="s.status === 'draft'"
                  class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600"
                >
                  Draft
                </span>
                <!-- packaged -->
                <span
                  v-else-if="s.status === 'packaged'"
                  class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700"
                >
                  Packaged
                </span>
                <!-- active -->
                <span
                  v-else-if="s.status === 'active'"
                  class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700"
                >
                  <span
                    class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"
                  ></span>
                  Active
                </span>
                <!-- completed -->
                <span
                  v-else-if="s.status === 'completed'"
                  class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-500"
                >
                  Completed
                </span>
                <!-- cancelled -->
                <span
                  v-else-if="s.status === 'cancelled'"
                  class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-600"
                >
                  Cancelled
                </span>
                <span
                  v-else
                  :class="[
                    'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                    statusBadgeClass(s.status),
                  ]"
                  >{{ s.status }}</span
                >
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-2">
                  <ActionButton
                    v-if="s.status === 'draft'"
                    variant="primary"
                    icon="play"
                    @click="handlePackage(s.id)"
                  >
                    Package
                  </ActionButton>
                  <ActionButton
                    v-if="s.status === 'packaged'"
                    variant="danger"
                    icon="x"
                    @click="handleCancel(s.id)"
                  >
                    Batalkan
                  </ActionButton>
                  <ActionButton
                    v-if="s.status === 'completed' && !s.resultsReleased"
                    variant="success"
                    icon="check"
                    @click="handleRelease(s.id)"
                  >
                    Rilis Hasil
                  </ActionButton>
                  <!-- Export dropdown for completed sessions -->
                  <div
                    v-if="s.status === 'completed'"
                    class="relative"
                    data-export-menu
                  >
                    <ActionButton
                      variant="success"
                      icon="download"
                      :disabled="exportingId === s.id"
                      @click="toggleExportMenu(s.id)"
                    >
                      <span v-if="exportingId === s.id">Exporting...</span>
                      <span v-else>Export</span>
                    </ActionButton>
                    <!-- Export dropdown menu -->
                    <div
                      v-if="exportMenuOpenId === s.id"
                      class="absolute right-0 z-10 mt-1 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                    >
                      <div class="py-1">
                        <button
                          class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          @click="handleExport(s.id, false)"
                        >
                          Export Ringkasan
                        </button>
                        <button
                          class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          @click="handleExport(s.id, true)"
                        >
                          Export dengan Detail Jawaban
                        </button>
                      </div>
                    </div>
                  </div>
                  <ActionButton
                    v-if="s.status === 'completed'"
                    variant="primary"
                    icon="view"
                    @click="$router.push(`/cbt/report/${s.id}`)"
                  >
                    Laporan
                  </ActionButton>
                </div>
              </td>
            </tr>
            <tr v-if="sessions.length === 0">
              <td colspan="6" class="py-10 text-center text-sm text-gray-400">
                Belum ada sesi ujian.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
