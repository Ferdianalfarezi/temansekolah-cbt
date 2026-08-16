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
  });

  // Join session room after connection
  socket.value.on("connect", () => {
    socket.value?.emit("join_session", { sessionId, token });
  });

  // Handle join confirmation
  socket.value.on("join_session", (data: { success: boolean }) => {
    if (data.success) {
      console.log("Successfully joined proctor session:", sessionId);
    }
  });

  // Handle errors from gateway
  socket.value.on("error", (data: { message: string }) => {
    error.value = data.message;
    console.error("Proctor socket error:", data.message);
  });

  socket.value.on(
    "participant_update",
    (data: Partial<ParticipantDashboardData> & { participantId?: string }) => {
      if (!dashboard.value) return;
      const id = data.participantId || data.id;
      const idx = dashboard.value.participants.findIndex((p) => p.id === id);
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

  socket.value.on("session_completed", () => {
    // Refresh dashboard when session completes
    fetchDashboard();
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
  <div>
    <!-- Page header -->
    <div
      class="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between"
    >
      <div>
        <h1 class="text-lg font-semibold text-gray-900">Proctor Dashboard</h1>
        <p class="text-sm text-gray-500 mt-0.5">Sesi: {{ sessionId }}</p>
      </div>
      <button
        class="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        @click="fetchDashboard"
      >
        <svg
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
        Refresh
      </button>
    </div>

    <div class="px-6 py-6">
      <div
        v-if="error"
        class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
      >
        {{ error }}
      </div>

      <div v-if="loading" class="flex items-center justify-center py-16">
        <div
          class="h-7 w-7 animate-spin rounded-full border-[3px] border-indigo-600 border-t-transparent"
        ></div>
      </div>

      <template v-else-if="dashboard">
        <!-- Stats bar (5 cards) -->
        <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div
            class="rounded-xl border border-gray-200 bg-white p-4 text-center"
          >
            <p class="text-2xl font-bold text-gray-900">
              {{ dashboard.stats.total }}
            </p>
            <p class="text-xs text-gray-500 mt-1">Total</p>
          </div>
          <div
            class="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-center"
          >
            <p class="text-2xl font-bold text-indigo-700">
              {{ dashboard.stats.inProgress }}
            </p>
            <p class="text-xs text-indigo-600 mt-1">Mengerjakan</p>
          </div>
          <div
            class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center"
          >
            <p class="text-2xl font-bold text-emerald-700">
              {{ dashboard.stats.submitted }}
            </p>
            <p class="text-xs text-emerald-600 mt-1">Selesai</p>
          </div>
          <div
            class="rounded-xl border border-red-200 bg-red-50 p-4 text-center"
          >
            <p class="text-2xl font-bold text-red-600">
              {{ dashboard.stats.disconnected }}
            </p>
            <p class="text-xs text-red-500 mt-1">Terputus</p>
          </div>
          <div
            class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center"
          >
            <p class="text-2xl font-bold text-amber-700">
              {{ dashboard.stats.flagged }}
            </p>
            <p class="text-xs text-amber-600 mt-1">Dicurigai</p>
          </div>
        </div>

        <!-- Participant grid -->
        <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
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
          class="py-12 text-center text-sm text-gray-400"
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
          <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 class="text-base font-semibold text-gray-900">
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
                <label class="block text-xs font-medium text-gray-600 mb-1"
                  >Tambahan (menit)</label
                >
                <input
                  v-model.number="modalMinutes"
                  type="number"
                  min="1"
                  max="60"
                  class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1"
                  >Alasan</label
                >
                <textarea
                  v-model="modalReason"
                  rows="2"
                  required
                  class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="Alasan tindakan..."
                ></textarea>
              </div>

              <div class="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  @click="showModal = false"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                >
                  Konfirmasi
                </button>
              </div>
            </form>
          </div>
        </div>
      </Teleport>
    </div>
  </div>
</template>
