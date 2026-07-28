<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import {
  getExamSessions,
  packageSession,
  cancelSession,
  releaseResults,
  type ExamSession,
  type ExamSessionStatus,
} from "@/api/cbt";

const sessions = ref<ExamSession[]>([]);
const loading = ref(false);
const error = ref("");
const statusFilter = ref<ExamSessionStatus | "">("");

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
    sessions.value = res.data;
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

watch(statusFilter, fetchSessions);
onMounted(fetchSessions);
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Sesi Ujian</h1>
      <select
        v-model="statusFilter"
        class="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
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

    <div
      v-if="error"
      class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
    >
      {{ error }}
    </div>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div
        class="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
      ></div>
    </div>

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
              Mapel
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"
            >
              Kelas
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"
            >
              Jadwal
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"
            >
              Durasi
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"
            >
              Status
            </th>
            <th
              class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500"
            >
              Aksi
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-for="s in sessions" :key="s.id" class="hover:bg-gray-50">
            <td class="px-4 py-3 text-sm text-gray-900">
              {{ s.mataPelajaranId.slice(0, 8) }}…
            </td>
            <td class="px-4 py-3 text-sm text-gray-600">
              {{ s.kelasId.slice(0, 8) }}…
            </td>
            <td class="px-4 py-3 text-sm text-gray-600">
              {{ new Date(s.scheduledAt).toLocaleString("id-ID") }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-600">
              {{ s.durationMinutes }} menit
            </td>
            <td class="px-4 py-3">
              <span
                :class="[
                  'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                  statusBadgeClass(s.status),
                ]"
              >
                {{ s.status }}
              </span>
            </td>
            <td class="px-4 py-3 text-right space-x-2">
              <button
                v-if="s.status === 'draft'"
                class="text-sm text-blue-600 hover:text-blue-800"
                @click="handlePackage(s.id)"
              >
                Package
              </button>
              <button
                v-if="s.status === 'packaged'"
                class="text-sm text-red-600 hover:text-red-800"
                @click="handleCancel(s.id)"
              >
                Cancel
              </button>
              <button
                v-if="s.status === 'completed' && !s.resultsReleased"
                class="text-sm text-green-600 hover:text-green-800"
                @click="handleRelease(s.id)"
              >
                Rilis Hasil
              </button>
              <RouterLink
                v-if="s.status === 'completed'"
                :to="`/cbt/report/${s.id}`"
                class="text-sm text-purple-600 hover:text-purple-800"
              >
                Laporan
              </RouterLink>
            </td>
          </tr>
          <tr v-if="sessions.length === 0">
            <td colspan="6" class="px-4 py-8 text-center text-sm text-gray-500">
              Belum ada sesi ujian.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
