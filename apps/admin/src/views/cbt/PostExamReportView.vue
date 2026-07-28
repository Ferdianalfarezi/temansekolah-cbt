<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { getExamSessionReport } from "@/api/cbt";

interface ViolationEntry {
  participantId: string;
  namaSiswa: string;
  nisn: string;
  violationType: string;
  count: number;
  detectedAt: string;
}

interface ProctorActionEntry {
  participantId: string;
  namaSiswa: string;
  actionType: string;
  extensionMinutes: number | null;
  reason: string;
  createdAt: string;
}

interface EarlySubmissionEntry {
  participantId: string;
  namaSiswa: string;
  nisn: string;
  durationPct: number;
  submittedAt: string;
}

interface ReportData {
  sessionId: string;
  violations: ViolationEntry[];
  proctorActions: ProctorActionEntry[];
  earlySubmissions: EarlySubmissionEntry[];
  summary: {
    totalParticipants: number;
    totalSubmitted: number;
    totalAutoSubmitted: number;
    totalFlagged: number;
    averageScore: number | null;
  };
}

const route = useRoute();
const sessionId = route.params.id as string;

const report = ref<ReportData | null>(null);
const loading = ref(false);
const error = ref("");
const activeTab = ref<"violations" | "actions" | "early">("violations");

async function fetchReport() {
  loading.value = true;
  error.value = "";
  try {
    const res = await getExamSessionReport(sessionId);
    report.value = res.data as ReportData;
  } catch (e: any) {
    error.value = e.response?.data?.message || "Gagal memuat laporan";
  } finally {
    loading.value = false;
  }
}

function violationLabel(type: string) {
  const map: Record<string, string> = {
    tab_switch: "Tab Switch",
    focus_loss: "Focus Loss",
    fullscreen_exit: "Fullscreen Exit",
    multiple_login: "Multiple Login",
  };
  return map[type] || type;
}

function actionLabel(type: string) {
  const map: Record<string, string> = {
    pause: "Jeda",
    resume: "Lanjutkan",
    extend: "Tambah Waktu",
  };
  return map[type] || type;
}

onMounted(fetchReport);
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Laporan Pasca Ujian</h1>
      <RouterLink
        to="/cbt/sessions"
        class="text-sm text-blue-600 hover:text-blue-800"
      >
        ← Kembali
      </RouterLink>
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

    <template v-else-if="report">
      <!-- Summary -->
      <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div class="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <p class="text-xl font-bold text-gray-900">
            {{ report.summary.totalParticipants }}
          </p>
          <p class="text-xs text-gray-500">Peserta</p>
        </div>
        <div
          class="rounded-lg border border-green-200 bg-green-50 p-3 text-center"
        >
          <p class="text-xl font-bold text-green-700">
            {{ report.summary.totalSubmitted }}
          </p>
          <p class="text-xs text-green-600">Submit Manual</p>
        </div>
        <div
          class="rounded-lg border border-orange-200 bg-orange-50 p-3 text-center"
        >
          <p class="text-xl font-bold text-orange-700">
            {{ report.summary.totalAutoSubmitted }}
          </p>
          <p class="text-xs text-orange-600">Auto Submit</p>
        </div>
        <div class="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
          <p class="text-xl font-bold text-red-700">
            {{ report.summary.totalFlagged }}
          </p>
          <p class="text-xs text-red-600">Dicurigai</p>
        </div>
        <div
          class="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center"
        >
          <p class="text-xl font-bold text-blue-700">
            {{
              report.summary.averageScore != null
                ? `${report.summary.averageScore}%`
                : "-"
            }}
          </p>
          <p class="text-xs text-blue-600">Rata-rata</p>
        </div>
      </div>

      <!-- Tabs -->
      <div class="mb-4 flex gap-1 border-b border-gray-200">
        <button
          :class="[
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px',
            activeTab === 'violations'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700',
          ]"
          @click="activeTab = 'violations'"
        >
          Pelanggaran ({{ report.violations.length }})
        </button>
        <button
          :class="[
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px',
            activeTab === 'actions'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700',
          ]"
          @click="activeTab = 'actions'"
        >
          Aksi Proctor ({{ report.proctorActions.length }})
        </button>
        <button
          :class="[
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px',
            activeTab === 'early'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700',
          ]"
          @click="activeTab = 'early'"
        >
          Early Submit ({{ report.earlySubmissions.length }})
        </button>
      </div>

      <!-- Violations Table -->
      <div
        v-if="activeTab === 'violations'"
        class="overflow-hidden rounded-lg border border-gray-200 bg-white"
      >
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"
              >
                Siswa
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"
              >
                NISN
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"
              >
                Tipe
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"
              >
                Jumlah
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"
              >
                Waktu
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr
              v-for="v in report.violations"
              :key="`${v.participantId}-${v.violationType}`"
              class="hover:bg-gray-50"
            >
              <td class="px-4 py-3 text-sm text-gray-900">{{ v.namaSiswa }}</td>
              <td class="px-4 py-3 text-sm font-mono text-gray-600">
                {{ v.nisn }}
              </td>
              <td class="px-4 py-3">
                <span
                  class="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
                >
                  {{ violationLabel(v.violationType) }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-900">{{ v.count }}×</td>
              <td class="px-4 py-3 text-sm text-gray-600">
                {{ new Date(v.detectedAt).toLocaleTimeString("id-ID") }}
              </td>
            </tr>
            <tr v-if="report.violations.length === 0">
              <td
                colspan="5"
                class="px-4 py-8 text-center text-sm text-gray-500"
              >
                Tidak ada pelanggaran.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Proctor Actions Table -->
      <div
        v-if="activeTab === 'actions'"
        class="overflow-hidden rounded-lg border border-gray-200 bg-white"
      >
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"
              >
                Siswa
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"
              >
                Aksi
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"
              >
                Detail
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"
              >
                Alasan
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"
              >
                Waktu
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr
              v-for="a in report.proctorActions"
              :key="`${a.participantId}-${a.createdAt}`"
              class="hover:bg-gray-50"
            >
              <td class="px-4 py-3 text-sm text-gray-900">{{ a.namaSiswa }}</td>
              <td class="px-4 py-3">
                <span
                  class="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
                >
                  {{ actionLabel(a.actionType) }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">
                {{ a.extensionMinutes ? `+${a.extensionMinutes} menit` : "-" }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                {{ a.reason }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">
                {{ new Date(a.createdAt).toLocaleTimeString("id-ID") }}
              </td>
            </tr>
            <tr v-if="report.proctorActions.length === 0">
              <td
                colspan="5"
                class="px-4 py-8 text-center text-sm text-gray-500"
              >
                Tidak ada aksi proctor.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Early Submissions Table -->
      <div
        v-if="activeTab === 'early'"
        class="overflow-hidden rounded-lg border border-gray-200 bg-white"
      >
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"
              >
                Siswa
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"
              >
                NISN
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"
              >
                Waktu Dipakai
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"
              >
                Submitted
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr
              v-for="e in report.earlySubmissions"
              :key="e.participantId"
              class="hover:bg-gray-50"
            >
              <td class="px-4 py-3 text-sm text-gray-900">{{ e.namaSiswa }}</td>
              <td class="px-4 py-3 text-sm font-mono text-gray-600">
                {{ e.nisn }}
              </td>
              <td class="px-4 py-3 text-sm text-orange-600 font-medium">
                {{ e.durationPct }}%
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">
                {{ new Date(e.submittedAt).toLocaleTimeString("id-ID") }}
              </td>
            </tr>
            <tr v-if="report.earlySubmissions.length === 0">
              <td
                colspan="4"
                class="px-4 py-8 text-center text-sm text-gray-500"
              >
                Tidak ada early submission.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
