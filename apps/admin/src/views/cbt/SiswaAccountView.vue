<script setup lang="ts">
import { ref, onMounted } from "vue";
import ActionButton from "@/components/ui/ActionButton.vue";
import {
  getSiswaAccounts,
  syncSiswaAccounts,
  resetSiswaPassword,
  type SiswaAccount,
} from "@/api/cbt";

const accounts = ref<SiswaAccount[]>([]);
const loading = ref(false);
const syncing = ref(false);
const error = ref("");
const search = ref("");

async function fetchAccounts() {
  loading.value = true;
  error.value = "";
  try {
    const params = search.value ? { search: search.value } : undefined;
    const res = await getSiswaAccounts(params);
    // Handle both array response and { data: [], meta: {} } response
    accounts.value = Array.isArray(res.data) ? res.data : (res.data.data ?? []);
  } catch (e: any) {
    error.value = e.response?.data?.message || "Gagal memuat akun siswa";
  } finally {
    loading.value = false;
  }
}

async function handleSync() {
  syncing.value = true;
  error.value = "";
  try {
    await syncSiswaAccounts();
    await fetchAccounts();
  } catch (e: any) {
    error.value = e.response?.data?.message || "Gagal sinkronisasi";
  } finally {
    syncing.value = false;
  }
}

async function handleResetPassword(id: string, nisn: string) {
  if (!confirm(`Reset password akun NISN ${nisn}?`)) return;
  try {
    await resetSiswaPassword(id);
    await fetchAccounts();
  } catch (e: any) {
    error.value = e.response?.data?.message || "Gagal reset password";
  }
}

function handleSearch() {
  fetchAccounts();
}

onMounted(fetchAccounts);
</script>

<template>
  <div>
    <!-- Page header -->
    <div
      class="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between"
    >
      <div>
        <h1 class="text-lg font-semibold text-gray-900">Akun Siswa CBT</h1>
        <p class="text-sm text-gray-500 mt-0.5">Manajemen akun ujian siswa</p>
      </div>
    </div>

    <div class="px-6 py-6">
      <!-- Error banner -->
      <div
        v-if="error"
        class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
      >
        {{ error }}
      </div>

      <!-- Stats row -->
      <div class="mb-5 grid grid-cols-3 gap-3">
        <div class="rounded-xl border border-gray-200 bg-white p-4">
          <p class="text-2xl font-bold text-gray-900">{{ accounts.length }}</p>
          <p class="text-xs text-gray-500 mt-1">Total Siswa</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-4">
          <p class="text-2xl font-bold text-gray-900">
            {{ accounts.filter((a) => a.isActive).length }}
          </p>
          <p class="text-xs text-gray-500 mt-1">Aktif</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-4">
          <p class="text-2xl font-bold text-amber-600">
            {{ accounts.filter((a) => a.needsReview).length }}
          </p>
          <p class="text-xs text-gray-500 mt-1">Perlu Review</p>
        </div>
      </div>

      <!-- Search bar -->
      <div class="mb-5">
        <form class="flex gap-2" @submit.prevent="handleSearch">
          <input
            v-model="search"
            type="text"
            placeholder="Cari NISN atau nama siswa..."
            class="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
          <button
            type="button"
            :disabled="syncing"
            class="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            @click="handleSync"
          >
            <svg
              v-if="syncing"
              class="animate-spin h-4 w-4"
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              ></path>
            </svg>
            <svg
              v-else
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>{{ syncing ? "Sinkronisasi..." : "Sync" }}</span>
          </button>
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
                NISN
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                Nama
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                Kelas
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                Status
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                Login Terakhir
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
              v-for="acc in accounts"
              :key="acc.id"
              class="hover:bg-gray-50/60 transition-colors"
            >
              <td class="px-4 py-3 font-mono text-sm text-gray-900">
                {{ acc.nisn }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-900">
                {{ acc.namaSiswa || "-" }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">
                {{ acc.kelasNama || "-" }}
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-1.5">
                  <span
                    :class="[
                      'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                      acc.isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-500',
                    ]"
                  >
                    {{ acc.isActive ? "Aktif" : "Nonaktif" }}
                  </span>
                  <span
                    v-if="acc.needsReview"
                    class="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700"
                  >
                    Review
                  </span>
                </div>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">
                {{
                  acc.lastLoginAt
                    ? new Date(acc.lastLoginAt).toLocaleString("id-ID")
                    : "Belum pernah"
                }}
              </td>
              <td class="px-4 py-3 text-right">
                <ActionButton
                  variant="purple"
                  @click="handleResetPassword(acc.id, acc.nisn)"
                >
                  Reset Password
                </ActionButton>
              </td>
            </tr>
            <tr v-if="accounts.length === 0">
              <td colspan="6" class="py-10 text-center text-sm text-gray-400">
                Belum ada akun siswa.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
