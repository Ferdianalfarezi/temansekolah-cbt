<script setup lang="ts">
import { computed } from "vue";
import type { ParticipantDashboardData } from "@/api/cbt";

const props = defineProps<{
  participant: ParticipantDashboardData;
}>();

const emit = defineEmits<{
  pause: [id: string];
  resume: [id: string];
  extend: [id: string];
}>();

const statusDisplay = computed(() => {
  const map: Record<string, { label: string; color: string }> = {
    assigned: { label: "Menunggu", color: "bg-gray-100 text-gray-700" },
    in_progress: { label: "Mengerjakan", color: "bg-blue-100 text-blue-800" },
    paused: { label: "Dijeda", color: "bg-yellow-100 text-yellow-800" },
    disconnected: { label: "Terputus", color: "bg-red-100 text-red-700" },
    submitted: { label: "Selesai", color: "bg-green-100 text-green-800" },
    auto_submitted: {
      label: "Auto-Submit",
      color: "bg-orange-100 text-orange-800",
    },
  };
  return (
    map[props.participant.status] || {
      label: props.participant.status,
      color: "bg-gray-100 text-gray-700",
    }
  );
});

const remainingFormatted = computed(() => {
  const secs = props.participant.remainingSeconds;
  if (secs == null) return "--:--";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
});

const isActive = computed(() =>
  ["in_progress", "paused", "disconnected"].includes(props.participant.status),
);
</script>

<template>
  <div
    :class="[
      'rounded-lg border p-4 transition-shadow hover:shadow-md',
      participant.isFlaggedCheating
        ? 'border-red-300 bg-red-50'
        : 'border-gray-200 bg-white',
    ]"
  >
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-gray-900">
          {{ participant.namaSiswa }}
        </p>
        <p class="text-xs text-gray-500">{{ participant.nisn }}</p>
      </div>
      <span
        :class="[
          'inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
          statusDisplay.color,
        ]"
      >
        {{ statusDisplay.label }}
      </span>
    </div>

    <!-- Stats -->
    <div class="mt-3 grid grid-cols-3 gap-2 text-center">
      <div>
        <p class="text-lg font-bold text-gray-900">{{ remainingFormatted }}</p>
        <p class="text-xs text-gray-500">Sisa Waktu</p>
      </div>
      <div>
        <p
          :class="[
            'text-lg font-bold',
            participant.violationCount > 0 ? 'text-red-600' : 'text-gray-900',
          ]"
        >
          {{ participant.violationCount }}
        </p>
        <p class="text-xs text-gray-500">Pelanggaran</p>
      </div>
      <div>
        <p class="text-lg font-bold text-gray-900">
          {{
            participant.scorePercentage != null
              ? `${participant.scorePercentage}%`
              : "-"
          }}
        </p>
        <p class="text-xs text-gray-500">Skor</p>
      </div>
    </div>

    <!-- Flags -->
    <div
      v-if="participant.isFlaggedCheating || participant.isEarlySubmission"
      class="mt-2 flex gap-1"
    >
      <span
        v-if="participant.isFlaggedCheating"
        class="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700"
      >
        🚩 Curang
      </span>
      <span
        v-if="participant.isEarlySubmission"
        class="rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-700"
      >
        ⚡ Terlalu Cepat
      </span>
    </div>

    <!-- Actions -->
    <div v-if="isActive" class="mt-3 flex gap-2 border-t border-gray-100 pt-3">
      <button
        v-if="participant.status === 'in_progress'"
        class="flex-1 rounded bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800 hover:bg-yellow-200"
        @click="emit('pause', participant.id)"
      >
        Jeda
      </button>
      <button
        v-if="participant.status === 'paused'"
        class="flex-1 rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800 hover:bg-green-200"
        @click="emit('resume', participant.id)"
      >
        Lanjut
      </button>
      <button
        class="flex-1 rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-200"
        @click="emit('extend', participant.id)"
      >
        Tambah Waktu
      </button>
    </div>
  </div>
</template>
