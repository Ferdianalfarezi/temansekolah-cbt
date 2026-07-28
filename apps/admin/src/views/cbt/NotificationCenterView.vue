<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  getNotifications,
  acknowledgeNotification,
  type CbtNotification,
} from "@/api/cbt";

const notifications = ref<CbtNotification[]>([]);
const loading = ref(false);
const error = ref("");

const unreadCount = computed(
  () => notifications.value.filter((n) => !n.isRead).length,
);

async function fetchNotifications() {
  loading.value = true;
  error.value = "";
  try {
    const res = await getNotifications();
    notifications.value = res.data;
  } catch (e: any) {
    error.value = e.response?.data?.message || "Gagal memuat notifikasi";
  } finally {
    loading.value = false;
  }
}

async function handleAcknowledge(id: string) {
  try {
    await acknowledgeNotification(id);
    const item = notifications.value.find((n) => n.id === id);
    if (item) {
      item.isRead = true;
      item.acknowledgedAt = new Date().toISOString();
    }
  } catch (e: any) {
    error.value = e.response?.data?.message || "Gagal acknowledge notifikasi";
  }
}

onMounted(fetchNotifications);
</script>

<template>
  <div>
    <!-- Page header -->
    <div
      class="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between"
    >
      <div class="flex items-center gap-3">
        <h1 class="text-lg font-semibold text-gray-900">Notifikasi</h1>
        <span
          v-if="unreadCount > 0"
          class="inline-flex items-center justify-center rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-bold text-white min-w-[1.5rem]"
        >
          {{ unreadCount }}
        </span>
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

      <div v-else class="space-y-3 max-w-2xl">
        <div
          v-if="notifications.length === 0"
          class="rounded-xl border border-gray-200 bg-white py-12 text-center text-sm text-gray-400"
        >
          Tidak ada notifikasi.
        </div>

        <div
          v-for="n in notifications"
          :key="n.id"
          :class="[
            'rounded-xl border p-4 transition-colors',
            n.isHighPriority && !n.isRead
              ? 'border-l-4 border-l-amber-400 border-t-amber-200 border-r-amber-200 border-b-amber-200 bg-amber-50/30'
              : n.isRead
                ? 'border-gray-200 bg-gray-50 opacity-70'
                : 'border-gray-200 bg-white',
          ]"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span
                  v-if="!n.isRead"
                  class="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500"
                ></span>
                <span
                  v-if="n.isHighPriority"
                  class="text-xs font-medium text-amber-700"
                >
                  ⚠ Prioritas Tinggi
                </span>
              </div>
              <h3 class="text-sm font-medium text-gray-900">{{ n.title }}</h3>
              <p class="mt-1 text-xs text-gray-600 leading-relaxed">
                {{ n.body }}
              </p>
              <p class="mt-2 text-xs text-gray-400">
                {{ new Date(n.createdAt).toLocaleString("id-ID") }}
              </p>
            </div>
            <button
              v-if="!n.isRead"
              class="shrink-0 text-xs text-indigo-600 hover:underline transition-colors"
              @click="handleAcknowledge(n.id)"
            >
              Tandai Dibaca
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
