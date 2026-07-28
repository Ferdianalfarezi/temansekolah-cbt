<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { io, type Socket } from "socket.io-client";
import {
  getProctorDashboard,
  pauseParticipant,
  resumeParticipant,
  extendParticipant,
  type ProctorDashboardData,
  type ParticipantDashboardData,
} from "@/api/cbt";
import ParticipantCard from "@/components/cbt/ParticipantCard.vue";

const route = useRoute();
const sessionId = route.params.id as string;

const dashboard = ref<ProctorDashboardData | null>(null);
const loading = ref(false);
const error = ref("");
const socket = ref<Socket | null>(null);

// Modal state
const showModal = ref(false);
const modalAction = ref<"pause" | "resume" | "extend">("pause");
const modalParticipantId = ref("");
const modalReason = ref("");
const modalMinutes = ref(5);

async function fetchDashboard() {
  loading.value = true;
  error.value = "";
  try {
    const res = await getProctorDashboard(sessionId);
    dashboard.value = res.data;
  } catch (e: any) {
    error.value = e.response?.data?.message || "Gagal memuat dashboard";
  } finally {
    loading.value = false;
  }
}

function connectSocket() {
  const baseUrl = import.meta.env.VITE_API_URL || "";
  const token = localStorage.getItem("token");

  socket.value = io(`${baseUrl}/proctor`, {
    auth: { token },
    query: { sessionId },
  });

  socket.value.on(
    "participant_update",
    (data: Partial<ParticipantDashboardData>) => {
      if (!dashboard.value) return;
      const idx = dashboard.value.participants.findIndex(
        (p) => p.id === data.id,
      );
      if (idx >= 0) {
        Object.assign(dashboard.value.participants[idx], data);
      }
      updateStats();
    },
  );

  socket.value.on(
    "violation_alert",
    (data: { participantId: string; count: number }) => {
      if (!dashboard.value) return;
      const p = dashboard.value.participants.find(
        (p) => p.id === data.participantId,
      );
      if (p) p.violationCount = data.count;
      updateStats();
    },
  );

  socket.value.on(
    "participant_disconnected",
    (data: { participantId: string }) => {
      if (!dashboard.value) return;
      const p = dashboard.value.participants.find(
        (p) => p.id === data.participantId,
      );
      if (p) p.status = "disconnected";
      updateStats();
    },
  );

  socket.value.on(
    "participant_reconnected",
    (data: { participantId: string }) => {
      if (!dashboard.value) return;
      const p = dashboard.value.participants.find(
        (p) => p.id === data.participantId,
      );
      if (p) p.status = "in_progress";
      updateStats();
    },
  );

  socket.value.on("early_submission", (data: { participantId: string }) => {
    if (!dashboard.value) return;
    const p = dashboard.value.participants.find(
      (p) => p.id === data.participantId,
    );
    if (p) p.isEarlySubmission = true;
  });
}

function updateStats() {
  if (!dashboard.value) return;
  const parts = dashboard.value.participants;
  dashboard.value.stats = {
    total: parts.length,
    inProgress: parts.filter((p) => p.status === "in_progress").length,
    submitted: parts.filter((p) =>
      ["submitted", "auto_submitted"].includes(p.status),
    ).length,
    disconnected: parts.filter((p) => p.status === "disconnected").length,
    flagged: parts.filter((p) => p.isFlaggedCheating).length,
  };
}

function openModal(
  action: "pause" | "resume" | "extend",
  participantId: string,
) {
  modalAction.value = action;
  modalParticipantId.value = participantId;
  modalReason.value = "";
  modalMinutes.value = 5;
  showModal.value = true;
}

async function handleModalSubmit() {
  if (!modalReason.value) return;
  try {
    if (modalAction.value === "pause") {
      await pauseParticipant(
        sessionId,
        modalParticipantId.value,
        modalReason.value,
      );
    } else if (modalAction.value === "resume") {
      await resumeParticipant(
        sessionId,
        modalParticipantId.value,
        modalReason.value,
      );
    } else if (modalAction.value === "extend") {
      await extendParticipant(sessionId, modalParticipantId.value, {
        minutes: modalMinutes.value,
        reason: modalReason.value,
      });
    }
    showModal.value = false;
    await fetchDashboard();
  } catch (e: any) {
    error.value = e.response?.data?.message || "Gagal melakukan aksi";
  }
}

onMounted(() => {
  fetchDashboard();
  connectSocket();
});

onUnmounted(() => {
  socket.value?.disconnect();
});
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Proctor Dashboard</h1>
      <button
        class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        @click="fetchDashboard"
      >
        🔄 Refresh
      </button>
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

    <template v-else-if="dashboard">
      <!-- Stats bar -->
      <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div class="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <p class="text-2xl font-bold text-gray-900">
            {{ dashboard.stats.total }}
          </p>
          <p class="text-xs text-gray-500">Total</p>
        </div>
        <div
          class="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center"
        >
          <p class="text-2xl font-bold text-blue-700">
            {{ dashboard.stats.inProgress }}
          </p>
          <p class="text-xs text-blue-600">Mengerjakan</p>
        </div>
        <div
          class="rounded-lg border border-green-200 bg-green-50 p-3 text-center"
        >
          <p class="text-2xl font-bold text-green-700">
            {{ dashboard.stats.submitted }}
          </p>
          <p class="text-xs text-green-600">Selesai</p>
        </div>
        <div class="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
          <p class="text-2xl font-bold text-red-700">
            {{ dashboard.stats.disconnected }}
          </p>
          <p class="text-xs text-red-600">Terputus</p>
        </div>
        <div
          class="rounded-lg border border-orange-200 bg-orange-50 p-3 text-center"
        >
          <p class="text-2xl font-bold text-orange-700">
            {{ dashboard.stats.flagged }}
          </p>
          <p class="text-xs text-orange-600">Dicurigai</p>
        </div>
      </div>

      <!-- Participant grid -->
      <div
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <ParticipantCard
          v-for="p in dashboard.participants"
          :key="p.id"
          :participant="p"
          @pause="openModal('pause', $event)"
          @resume="openModal('resume', $event)"
          @extend="openModal('extend', $event)"
        />
      </div>

      <div
        v-if="dashboard.participants.length === 0"
        class="py-12 text-center text-sm text-gray-500"
      >
        Belum ada peserta untuk sesi ini.
      </div>
    </template>

    <!-- Action Modal -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        @click.self="showModal = false"
      >
        <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <h2 class="text-lg font-semibold text-gray-900 capitalize">
            {{
              modalAction === "pause"
                ? "Jeda Peserta"
                : modalAction === "resume"
                  ? "Lanjutkan Peserta"
                  : "Tambah Waktu"
            }}
          </h2>

          <form class="mt-4 space-y-4" @submit.prevent="handleModalSubmit">
            <div v-if="modalAction === 'extend'">
              <label class="block text-sm font-medium text-gray-700"
                >Tambahan (menit)</label
              >
              <input
                v-model.number="modalMinutes"
                type="number"
                min="1"
                max="60"
                class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700"
                >Alasan</label
              >
              <textarea
                v-model="modalReason"
                rows="2"
                required
                class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="Alasan tindakan..."
              ></textarea>
            </div>

            <div class="flex gap-2 justify-end">
              <button
                type="button"
                class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                @click="showModal = false"
              >
                Batal
              </button>
              <button
                type="submit"
                class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Konfirmasi
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
