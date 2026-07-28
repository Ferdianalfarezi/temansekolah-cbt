<script setup lang="ts">
import { ref, onMounted } from "vue";
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
    accounts.value = res.data;
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
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Akun Siswa CBT</h1>
      <button
        :disabled="syncing"
        class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        @click="handleSync"
      >
        <span v-if="syncing">Sinkronisasi...</span>
        <span v-else>🔄 Sync dari LMS</span>
      </button>
    </div>

    <div
      v-if="error"
      class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
    >
      {{ error }}
    </div>

    <!-- Search -->
    <div class="mb-4">
      <form class="flex gap-2" @submit.prevent="handleSearch">
        <input
          v-model="search"
          type="text"
          placeholder="Cari NISN atau nama..."
          class="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          class="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Cari
        </button>
      </form>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div
        class="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
      ></div>
    </div>

    <!-- Table -->
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
              NISN
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"
            >
              Nama
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"
            >
              Kelas
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"
            >
              Status
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"
            >
              Login Terakhir
            </th>
            <th
              class="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500"
            >
              Aksi
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr v-for="acc in accounts" :key="acc.id" class="hover:bg-gray-50">
            <td class="px-4 py-3 text-sm font-mono text-gray-900">
              {{ acc.nisn }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-900">
              {{ acc.namaSiswa || "-" }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-600">
              {{ acc.kelasNama || "-" }}
            </td>
            <td class="px-4 py-3">
              <span
                :class="[
                  'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                  acc.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600',
                ]"
              >
                {{ acc.isActive ? "Aktif" : "Nonaktif" }}
              </span>
              <span
                v-if="acc.needsReview"
                class="ml-1 inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700"
              >
                Review
              </span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600">
              {{
                acc.lastLoginAt
                  ? new Date(acc.lastLoginAt).toLocaleString("id-ID")
                  : "Belum pernah"
              }}
            </td>
            <td class="px-4 py-3 text-right">
              <button
                class="text-sm text-blue-600 hover:text-blue-800"
                @click="handleResetPassword(acc.id, acc.nisn)"
              >
                Reset Password
              </button>
            </td>
          </tr>
          <tr v-if="accounts.length === 0">
            <td colspan="6" class="px-4 py-8 text-center text-sm text-gray-500">
              Belum ada akun siswa.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
