<script setup lang="ts">
import { ref, onMounted } from "vue";
import { getCbtConfig, updateCbtConfig, type CbtConfig } from "@/api/cbt";

const config = ref<CbtConfig | null>(null);
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const success = ref("");

const form = ref({
  timezone: "Asia/Jakarta",
  defaultAntiCheatLevel: "standard",
  maxViolationCount: 3,
  earlySubmissionThresholdPct: 20,
  defaultResultDetailLevel: "score_only",
});

async function fetchConfig() {
  loading.value = true;
  error.value = "";
  try {
    const res = await getCbtConfig();
    config.value = res.data;
    form.value = {
      timezone: res.data.timezone,
      defaultAntiCheatLevel: res.data.defaultAntiCheatLevel,
      maxViolationCount: res.data.maxViolationCount,
      earlySubmissionThresholdPct: res.data.earlySubmissionThresholdPct,
      defaultResultDetailLevel: res.data.defaultResultDetailLevel,
    };
  } catch (e: any) {
    error.value = e.response?.data?.message || "Gagal memuat konfigurasi";
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  saving.value = true;
  error.value = "";
  success.value = "";
  try {
    await updateCbtConfig(form.value);
    success.value = "Konfigurasi berhasil disimpan";
    setTimeout(() => (success.value = ""), 3000);
  } catch (e: any) {
    error.value = e.response?.data?.message || "Gagal menyimpan konfigurasi";
  } finally {
    saving.value = false;
  }
}

onMounted(fetchConfig);
</script>

<template>
  <div class="p-6">
    <h1 class="mb-6 text-2xl font-bold text-gray-900">Konfigurasi CBT</h1>

    <div
      v-if="error"
      class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
    >
      {{ error }}
    </div>

    <div
      v-if="success"
      class="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700"
    >
      {{ success }}
    </div>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div
        class="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
      ></div>
    </div>

    <form
      v-else
      class="max-w-2xl rounded-lg border border-gray-200 bg-white p-6 space-y-5"
      @submit.prevent="handleSave"
    >
      <div>
        <label class="block text-sm font-medium text-gray-700">Timezone</label>
        <select
          v-model="form.timezone"
          class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
          <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
          <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
        </select>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700"
          >Default Anti-Cheat Level</label
        >
        <select
          v-model="form.defaultAntiCheatLevel"
          class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="standard">Standard</option>
          <option value="relaxed">Relaxed</option>
        </select>
        <p class="mt-1 text-xs text-gray-500">
          Standard: fullscreen lock, tab switch detection. Relaxed: hanya
          warning.
        </p>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700"
          >Maks Pelanggaran (auto-submit)</label
        >
        <input
          v-model.number="form.maxViolationCount"
          type="number"
          min="1"
          max="20"
          class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <p class="mt-1 text-xs text-gray-500">
          Jumlah pelanggaran sebelum auto-submit.
        </p>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700">
          Threshold Early Submission (%)
        </label>
        <input
          v-model.number="form.earlySubmissionThresholdPct"
          type="number"
          min="5"
          max="50"
          class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <p class="mt-1 text-xs text-gray-500">
          Submission di bawah persentase waktu ini dianggap terlalu cepat.
        </p>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700"
          >Default Detail Hasil</label
        >
        <select
          v-model="form.defaultResultDetailLevel"
          class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="score_only">Skor saja</option>
          <option value="score_with_indicator">
            Skor + Indikator benar/salah
          </option>
          <option value="full_detail">Detail lengkap</option>
        </select>
      </div>

      <div class="pt-2">
        <button
          type="submit"
          :disabled="saving"
          class="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {{ saving ? "Menyimpan..." : "Simpan Konfigurasi" }}
        </button>
      </div>
    </form>
  </div>
</template>
