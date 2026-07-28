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
  <div class="p-6">
    <div class="flex items-center gap-3 mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Notifikasi</h1>
      <span
        v-if="unreadCount > 0"
        class="inline-flex items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white"
      >
        {{ unreadCount }}
      </span>
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

    <div v-else class="space-y-3">
      <div
        v-if="notifications.length === 0"
        class="py-12 text-center text-sm text-gray-500"
      >
        Tidak ada notifikasi.
      </div>

      <div
        v-for="n in notifications"
        :key="n.id"
        :class="[
          'rounded-lg border p-4 transition-colors',
          n.isRead ? 'border-gray-200 bg-white' : 'border-blue-200 bg-blue-50',
          n.isHighPriority && !n.isRead ? 'border-red-200 bg-red-50' : '',
        ]"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span
                v-if="!n.isRead"
                class="h-2 w-2 rounded-full bg-blue-500"
              ></span>
              <span
                v-if="n.isHighPriority"
                class="text-xs font-medium text-red-600"
              >
                ⚠️ Prioritas Tinggi
              </span>
            </div>
            <h3 class="mt-1 text-sm font-semibold text-gray-900">
              {{ n.title }}
            </h3>
            <p class="mt-1 text-sm text-gray-600">{{ n.body }}</p>
            <p class="mt-2 text-xs text-gray-400">
              {{ new Date(n.createdAt).toLocaleString("id-ID") }}
            </p>
          </div>
          <button
            v-if="!n.isRead"
            class="ml-4 shrink-0 rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            @click="handleAcknowledge(n.id)"
          >
            Tandai Dibaca
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
