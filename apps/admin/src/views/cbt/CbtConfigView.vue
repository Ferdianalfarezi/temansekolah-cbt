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
  <div>
    <!-- Page header -->
    <div class="border-b border-gray-200 bg-white px-6 py-4">
      <h1 class="text-lg font-semibold text-gray-900">Konfigurasi CBT</h1>
      <p class="text-sm text-gray-500 mt-0.5">Atur parameter sistem CBT</p>
    </div>

    <div class="px-6 py-6 max-w-2xl">
      <div
        v-if="error"
        class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
      >
        {{ error }}
      </div>

      <div
        v-if="success"
        class="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
      >
        {{ success }}
      </div>

      <div v-if="loading" class="flex items-center justify-center py-12">
        <div
          class="h-7 w-7 animate-spin rounded-full border-[3px] border-indigo-600 border-t-transparent"
        ></div>
      </div>

      <form v-else class="space-y-4" @submit.prevent="handleSave">
        <!-- Card 1: Zona Waktu -->
        <div class="rounded-xl border border-gray-200 bg-white p-5">
          <h2 class="text-sm font-semibold text-gray-700 mb-3">Zona Waktu</h2>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1"
              >Timezone</label
            >
            <select
              v-model="form.timezone"
              class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            >
              <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
              <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
              <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
            </select>
          </div>
          <div class="mt-4">
            <button
              type="button"
              :disabled="saving"
              class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              @click="handleSave"
            >
              {{ saving ? "Menyimpan..." : "Simpan" }}
            </button>
          </div>
        </div>

        <!-- Card 2: Anti-Cheat -->
        <div class="rounded-xl border border-gray-200 bg-white p-5">
          <h2 class="text-sm font-semibold text-gray-700 mb-3">Anti-Cheat</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1"
                >Default Level</label
              >
              <select
                v-model="form.defaultAntiCheatLevel"
                class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                <option value="standard">Standard</option>
                <option value="relaxed">Relaxed</option>
              </select>
              <p class="mt-1 text-xs text-gray-400">
                Standard: fullscreen lock, tab switch detection. Relaxed: hanya
                warning.
              </p>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1"
                >Violation Threshold (auto-submit)</label
              >
              <input
                v-model.number="form.maxViolationCount"
                type="number"
                min="1"
                max="20"
                class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
              <p class="mt-1 text-xs text-gray-400">
                Jumlah pelanggaran sebelum auto-submit.
              </p>
            </div>
          </div>
          <div class="mt-4">
            <button
              type="button"
              :disabled="saving"
              class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              @click="handleSave"
            >
              {{ saving ? "Menyimpan..." : "Simpan" }}
            </button>
          </div>
        </div>

        <!-- Card 3: Hasil Ujian -->
        <div class="rounded-xl border border-gray-200 bg-white p-5">
          <h2 class="text-sm font-semibold text-gray-700 mb-3">Hasil Ujian</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1"
                >Default Detail Hasil</label
              >
              <select
                v-model="form.defaultResultDetailLevel"
                class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                <option value="score_only">Skor saja</option>
                <option value="score_with_indicator">
                  Skor + Indikator benar/salah
                </option>
                <option value="full_detail">Detail lengkap</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1"
                >Threshold Early Submission (%)</label
              >
              <input
                v-model.number="form.earlySubmissionThresholdPct"
                type="number"
                min="5"
                max="50"
                class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
              <p class="mt-1 text-xs text-gray-400">
                Submission di bawah persentase waktu ini dianggap terlalu cepat.
              </p>
            </div>
          </div>
          <div class="mt-4">
            <button
              type="button"
              :disabled="saving"
              class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              @click="handleSave"
            >
              {{ saving ? "Menyimpan..." : "Simpan" }}
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>
