<script setup lang="ts">
/**
 * BankSoalCard — Card component for displaying bank soal information.
 *
 * Renders a card with bank soal details including:
 * - nama and mata pelajaran
 * - Status badge (draft/ready/archived)
 * - Soal count badge
 * - Target kelas as chips (shows first 2-3 + overflow indicator)
 * - Durasi and createdAt
 * - Action buttons (edit, duplicate, schedule, delete)
 *
 * _Requirements: 4.2_
 */

export type BankSoalStatus = "draft" | "ready" | "archived";

export interface BankSoal {
  id: string;
  nama: string;
  mataPelajaranId: string;
  mataPelajaranNama: string;
  soalCount: number;
  targetKelas: string[];
  tingkat: number | null;
  durasiMenit: number;
  kkm: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  status: BankSoalStatus;
  createdAt: string;
  createdBy: string;
}

interface Props {
  bankSoal: BankSoal;
  maxVisibleKelas?: number;
}

const props = withDefaults(defineProps<Props>(), {
  maxVisibleKelas: 3,
});

const emit = defineEmits<{
  (e: "click"): void;
  (e: "edit"): void;
  (e: "duplicate"): void;
  (e: "schedule"): void;
  (e: "delete"): void;
}>();

// Status badge styling
function statusBadgeClass(status: BankSoalStatus): string {
  const map: Record<BankSoalStatus, string> = {
    draft: "bg-gray-100 text-gray-600",
    ready: "bg-emerald-100 text-emerald-700",
    archived: "bg-amber-100 text-amber-700",
  };
  return map[status] || "bg-gray-100 text-gray-600";
}

function statusLabel(status: BankSoalStatus): string {
  const map: Record<BankSoalStatus, string> = {
    draft: "Draft",
    ready: "Siap",
    archived: "Diarsipkan",
  };
  return map[status] || status;
}

// Format date
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Computed visible kelas
function getVisibleKelas(): string[] {
  return props.bankSoal.targetKelas.slice(0, props.maxVisibleKelas);
}

function getOverflowCount(): number {
  return Math.max(0, props.bankSoal.targetKelas.length - props.maxVisibleKelas);
}

function handleCardClick() {
  emit("click");
}

function handleEdit(event: Event) {
  event.stopPropagation();
  emit("edit");
}

function handleDuplicate(event: Event) {
  event.stopPropagation();
  emit("duplicate");
}

function handleSchedule(event: Event) {
  event.stopPropagation();
  emit("schedule");
}

function handleDelete(event: Event) {
  event.stopPropagation();
  emit("delete");
}
</script>

<template>
  <div
    class="bank-soal-card group rounded-xl border border-gray-200 bg-white p-4 hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer"
    @click="handleCardClick"
  >
    <!-- Header: nama + status -->
    <div class="flex items-start justify-between gap-3 mb-3">
      <div class="flex-1 min-w-0">
        <h3 class="text-sm font-semibold text-gray-900 truncate">
          {{ bankSoal.nama }}
        </h3>
        <p class="text-xs text-gray-500 mt-0.5 truncate">
          {{ bankSoal.mataPelajaranNama }}
        </p>
      </div>
      <!-- Status Badge -->
      <span
        :class="[
          'inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
          statusBadgeClass(bankSoal.status),
        ]"
      >
        {{ statusLabel(bankSoal.status) }}
      </span>
    </div>

    <!-- Stats Row: soal count + durasi -->
    <div class="flex items-center gap-3 mb-3">
      <!-- Soal Count Badge -->
      <span
        class="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700"
      >
        <svg
          class="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        {{ bankSoal.soalCount }} soal
      </span>

      <!-- Durasi -->
      <span class="inline-flex items-center gap-1 text-xs text-gray-500">
        <svg
          class="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {{ bankSoal.durasiMenit }} menit
      </span>
    </div>

    <!-- Target Kelas Chips -->
    <div class="mb-3">
      <div v-if="bankSoal.targetKelas.length > 0" class="flex flex-wrap gap-1">
        <span
          v-for="kelas in getVisibleKelas()"
          :key="kelas"
          class="inline-flex rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
        >
          {{ kelas }}
        </span>
        <span
          v-if="getOverflowCount() > 0"
          class="inline-flex rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
          :title="bankSoal.targetKelas.slice(maxVisibleKelas).join(', ')"
        >
          +{{ getOverflowCount() }} lainnya
        </span>
      </div>
      <div v-else-if="bankSoal.tingkat" class="text-xs text-gray-500">
        Tingkat {{ bankSoal.tingkat }}
      </div>
      <div v-else class="text-xs text-gray-400">Belum ada target kelas</div>
    </div>

    <!-- Footer: date + actions -->
    <div
      class="flex items-center justify-between pt-3 border-t border-gray-100"
    >
      <span class="text-xs text-gray-400">
        {{ formatDate(bankSoal.createdAt) }}
      </span>

      <!-- Action Buttons -->
      <div
        class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <!-- Edit -->
        <button
          title="Edit"
          class="rounded-md p-1.5 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
          @click="handleEdit"
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
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>

        <!-- Duplicate -->
        <button
          title="Duplikasi"
          class="rounded-md p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
          @click="handleDuplicate"
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
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </button>

        <!-- Schedule Exam -->
        <button
          title="Jadwalkan Ujian"
          class="rounded-md p-1.5 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
          @click="handleSchedule"
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
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </button>

        <!-- Delete -->
        <button
          title="Hapus"
          class="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          @click="handleDelete"
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
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
