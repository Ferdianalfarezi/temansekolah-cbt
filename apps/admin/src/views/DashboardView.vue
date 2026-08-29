<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import {
  getExamSessions,
  getSiswaAccounts,
  getActivePelaksanaanUjian,
  type ExamSession,
  type PelaksanaanUjian,
} from "@/api/cbt";
import { getBankSoalList, type BankSoal } from "@/api/bank-soal";

const router = useRouter();
const authStore = useAuthStore();

const loading = ref(true);
const error = ref("");

// Data
const sessions = ref<ExamSession[]>([]);
const bankSoalList = ref<BankSoal[]>([]);
const siswaTotal = ref(0);
const activePelaksanaan = ref<PelaksanaanUjian | null>(null);

// Computed stats
const stats = computed(() => {
  const active = sessions.value.filter((s) => s.status === "active").length;
  const packaged = sessions.value.filter((s) => s.status === "packaged").length;
  const completed = sessions.value.filter((s) => s.status === "completed").length;
  const draft = sessions.value.filter((s) => s.status === "draft").length;
  
  return {
    totalSessions: sessions.value.length,
    activeSessions: active,
    packagedSessions: packaged,
    completedSessions: completed,
    draftSessions: draft,
    totalBankSoal: bankSoalList.value.length,
    totalSiswa: siswaTotal.value,
  };
});

// Active and upcoming sessions (packaged + active, sorted by schedule)
const activeAndUpcomingSessions = computed(() => {
  return sessions.value
    .filter((s) => ["packaged", "active"].includes(s.status))
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    .slice(0, 5);
});

// Recent completed sessions
const recentCompletedSessions = computed(() => {
  return sessions.value
    .filter((s) => s.status === "completed")
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
    .slice(0, 5);
});

async function fetchData() {
  loading.value = true;
  error.value = "";
  
  try {
    const [sessionsRes, bankSoalRes, siswaRes, pelaksanaanRes] = await Promise.all([
      getExamSessions(),
      getBankSoalList({ limit: 100 }),
      getSiswaAccounts({ isActive: true }),
      getActivePelaksanaanUjian(),
    ]);
    
    sessions.value = sessionsRes.data.data;
    bankSoalList.value = bankSoalRes.data.data;
    siswaTotal.value = siswaRes.data.meta.total;
    activePelaksanaan.value = pelaksanaanRes.data;
  } catch (e: any) {
    error.value = e.response?.data?.message || "Gagal memuat data dashboard";
  } finally {
    loading.value = false;
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusBadge(status: string) {
  const badges: Record<string, { class: string; label: string }> = {
    active: { class: "bg-emerald-100 text-emerald-700", label: "Berlangsung" },
    packaged: { class: "bg-amber-100 text-amber-700", label: "Terjadwal" },
    completed: { class: "bg-gray-100 text-gray-600", label: "Selesai" },
    draft: { class: "bg-gray-100 text-gray-500", label: "Draf" },
    cancelled: { class: "bg-red-100 text-red-600", label: "Dibatalkan" },
  };
  return badges[status] || { class: "bg-gray-100 text-gray-600", label: status };
}

onMounted(fetchData);
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Page header -->
    <div class="border-b border-gray-200 bg-white px-6 py-5">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-semibold text-gray-900">
            Selamat datang, {{ authStore.user?.name || 'Admin' }}
          </h1>
          <p class="mt-1 text-sm text-gray-500">
            <template v-if="activePelaksanaan">
              Periode aktif: <span class="font-medium text-gray-700">{{ activePelaksanaan.nama }}</span>
            </template>
            <template v-else>
              Tidak ada pelaksanaan ujian aktif
            </template>
          </p>
        </div>
        <button
          @click="fetchData"
          class="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>
    </div>

    <div class="px-6 py-6">
      <!-- Error state -->
      <div v-if="error" class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {{ error }}
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <div class="h-8 w-8 animate-spin rounded-full border-[3px] border-indigo-600 border-t-transparent"></div>
      </div>

      <template v-else>
        <!-- Stats Cards -->
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
          <!-- Active Sessions -->
          <div class="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <svg class="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
                </svg>
              </div>
              <div>
                <p class="text-2xl font-bold text-emerald-700">{{ stats.activeSessions }}</p>
                <p class="text-xs text-emerald-600">Sedang Berlangsung</p>
              </div>
            </div>
          </div>

          <!-- Scheduled Sessions -->
          <div class="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <svg class="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p class="text-2xl font-bold text-amber-700">{{ stats.packagedSessions }}</p>
                <p class="text-xs text-amber-600">Terjadwal</p>
              </div>
            </div>
          </div>

          <!-- Bank Soal -->
          <div class="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
                <svg class="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p class="text-2xl font-bold text-indigo-700">{{ stats.totalBankSoal }}</p>
                <p class="text-xs text-indigo-600">Bank Soal</p>
              </div>
            </div>
          </div>

          <!-- Siswa Accounts -->
          <div class="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
                <svg class="h-5 w-5 text-violet-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <p class="text-2xl font-bold text-violet-700">{{ stats.totalSiswa }}</p>
                <p class="text-xs text-violet-600">Akun Siswa</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <button
            @click="router.push('/cbt/bank-soal')"
            class="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors"
          >
            <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100">
              <svg class="h-4 w-4 text-indigo-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-900">Bank Soal</p>
              <p class="text-xs text-gray-500">Kelola soal</p>
            </div>
          </button>

          <button
            @click="router.push('/cbt/sessions')"
            class="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors"
          >
            <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">
              <svg class="h-4 w-4 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-900">Sesi Ujian</p>
              <p class="text-xs text-gray-500">Lihat semua</p>
            </div>
          </button>

          <button
            @click="router.push('/cbt/siswa')"
            class="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors"
          >
            <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100">
              <svg class="h-4 w-4 text-violet-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-900">Akun Siswa</p>
              <p class="text-xs text-gray-500">Kelola akun</p>
            </div>
          </button>

          <button
            @click="router.push('/cbt/config')"
            class="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors"
          >
            <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
              <svg class="h-4 w-4 text-gray-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-900">Konfigurasi</p>
              <p class="text-xs text-gray-500">Pengaturan CBT</p>
            </div>
          </button>
        </div>

        <!-- Two Column Layout -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Active & Upcoming Sessions -->
          <div class="rounded-xl border border-gray-200 bg-white">
            <div class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 class="font-semibold text-gray-900">Ujian Aktif & Terjadwal</h2>
              <button
                @click="router.push('/cbt/sessions?status=active')"
                class="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Lihat Semua
              </button>
            </div>
            <div class="divide-y divide-gray-100">
              <template v-if="activeAndUpcomingSessions.length > 0">
                <div
                  v-for="session in activeAndUpcomingSessions"
                  :key="session.id"
                  class="flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition-colors cursor-pointer"
                  @click="router.push(`/cbt/proctor/${session.id}`)"
                >
                  <div class="min-w-0 flex-1">
                    <p class="font-medium text-gray-900 truncate">
                      {{ session.mataPelajaranNama || 'Mata Pelajaran' }}
                    </p>
                    <p class="text-sm text-gray-500 truncate">
                      {{ session.kelasNama || 'Kelas' }} · {{ formatDate(session.scheduledAt) }}
                    </p>
                  </div>
                  <div class="ml-4 flex items-center gap-2">
                    <span
                      :class="[
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                        getStatusBadge(session.status).class,
                      ]"
                    >
                      <span
                        v-if="session.status === 'active'"
                        class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"
                      ></span>
                      {{ getStatusBadge(session.status).label }}
                    </span>
                    <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </template>
              <div v-else class="px-5 py-10 text-center">
                <svg class="mx-auto h-10 w-10 text-gray-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <p class="mt-2 text-sm text-gray-500">Tidak ada ujian aktif atau terjadwal</p>
                <button
                  @click="router.push('/cbt/bank-soal')"
                  class="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Jadwalkan Ujian Baru
                </button>
              </div>
            </div>
          </div>

          <!-- Recent Completed Sessions -->
          <div class="rounded-xl border border-gray-200 bg-white">
            <div class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 class="font-semibold text-gray-900">Ujian Selesai Terbaru</h2>
              <button
                @click="router.push('/cbt/sessions?status=completed')"
                class="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Lihat Semua
              </button>
            </div>
            <div class="divide-y divide-gray-100">
              <template v-if="recentCompletedSessions.length > 0">
                <div
                  v-for="session in recentCompletedSessions"
                  :key="session.id"
                  class="flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition-colors cursor-pointer"
                  @click="router.push(`/cbt/report/${session.id}`)"
                >
                  <div class="min-w-0 flex-1">
                    <p class="font-medium text-gray-900 truncate">
                      {{ session.mataPelajaranNama || 'Mata Pelajaran' }}
                    </p>
                    <p class="text-sm text-gray-500 truncate">
                      {{ session.kelasNama || 'Kelas' }} · {{ formatDate(session.scheduledAt) }}
                    </p>
                  </div>
                  <div class="ml-4 flex items-center gap-2">
                    <span
                      v-if="session.resultsReleased"
                      class="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700"
                    >
                      Dirilis
                    </span>
                    <span
                      v-else
                      class="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600"
                    >
                      Belum Dirilis
                    </span>
                    <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </template>
              <div v-else class="px-5 py-10 text-center">
                <svg class="mx-auto h-10 w-10 text-gray-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
                <p class="mt-2 text-sm text-gray-500">Belum ada ujian yang selesai</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Session Stats Summary -->
        <div class="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <h2 class="font-semibold text-gray-900 mb-4">Ringkasan Sesi Ujian</h2>
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div class="text-center">
              <p class="text-2xl font-bold text-gray-900">{{ stats.totalSessions }}</p>
              <p class="text-xs text-gray-500">Total Sesi</p>
            </div>
            <div class="text-center">
              <p class="text-2xl font-bold text-emerald-600">{{ stats.activeSessions }}</p>
              <p class="text-xs text-gray-500">Berlangsung</p>
            </div>
            <div class="text-center">
              <p class="text-2xl font-bold text-amber-600">{{ stats.packagedSessions }}</p>
              <p class="text-xs text-gray-500">Terjadwal</p>
            </div>
            <div class="text-center">
              <p class="text-2xl font-bold text-gray-600">{{ stats.completedSessions }}</p>
              <p class="text-xs text-gray-500">Selesai</p>
            </div>
            <div class="text-center">
              <p class="text-2xl font-bold text-gray-400">{{ stats.draftSessions }}</p>
              <p class="text-xs text-gray-500">Draf</p>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
