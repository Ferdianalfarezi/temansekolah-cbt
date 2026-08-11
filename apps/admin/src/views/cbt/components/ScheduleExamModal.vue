<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useAuthStore } from "@/stores/auth";
import { scheduleExam } from "@/api/bank-soal";

// Types
export interface KelasOption {
  value: string;
  label: string;
}

export interface UserOption {
  value: string;
  label: string;
}

export interface BankSoalForSchedule {
  id: string;
  nama: string;
  targetKelas: KelasOption[];
  tingkat: number | null;
  durasiMenit: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  soalCount: number;
}

interface Props {
  show: boolean;
  bankSoal: BankSoalForSchedule | null;
  userOptions?: UserOption[];
}

const props = withDefaults(defineProps<Props>(), {
  userOptions: () => [],
});

const emit = defineEmits<{
  close: [];
  scheduled: [result: { count: number; message: string }];
}>();

export interface ScheduleExamFormData {
  scheduledAt: string;
  proctorId: string;
}

// Auth store for current user
const authStore = useAuthStore();

// Form state - no longer needs kelasId
const form = ref<ScheduleExamFormData>({
  scheduledAt: "",
  proctorId: "",
});

// Validation errors
const errors = ref<Partial<Record<keyof ScheduleExamFormData, string>>>({});

// Dropdown states
const showProktorDropdown = ref(false);

// Loading and error state
const submitting = ref(false);
const submitError = ref("");

// Computed: check if bank soal has no questions
const hasNoSoal = computed(() => {
  return props.bankSoal?.soalCount === 0;
});

// Computed: check if bank soal has no target kelas
const hasNoTargetKelas = computed(() => {
  return !props.bankSoal || props.bankSoal.targetKelas.length === 0;
});

// Computed: form is valid (no longer needs kelasId)
const isFormValid = computed(() => {
  if (hasNoSoal.value || hasNoTargetKelas.value) return false;
  return form.value.scheduledAt !== "" && form.value.proctorId !== "";
});

// Computed: selected proktor label
const selectedProktorLabel = computed(() => {
  if (!form.value.proctorId) return "-- Pilih Proktor --";
  const selected = props.userOptions.find(
    (u: UserOption) => u.value === form.value.proctorId,
  );
  return selected?.label || "-- Pilih Proktor --";
});

// Computed: minimum datetime (now + 1 hour as per backend validation)
const minDateTime = computed(() => {
  const now = new Date();
  now.setHours(now.getHours() + 1);
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
});

// Validate form
function validate(): boolean {
  errors.value = {};

  if (!form.value.scheduledAt) {
    errors.value.scheduledAt = "Tanggal dan waktu wajib diisi";
  } else {
    const selectedDate = new Date(form.value.scheduledAt);
    const minTime = new Date(Date.now() + 60 * 60 * 1000); // now + 60 minutes
    if (selectedDate < minTime) {
      errors.value.scheduledAt =
        "Waktu jadwal harus minimal 60 menit dari sekarang";
    }
  }

  if (!form.value.proctorId) {
    errors.value.proctorId = "Proktor wajib dipilih";
  }

  return Object.keys(errors.value).length === 0;
}

// Handle form submit
async function handleSubmit() {
  if (
    !validate() ||
    !props.bankSoal ||
    hasNoSoal.value ||
    hasNoTargetKelas.value
  )
    return;

  submitting.value = true;
  submitError.value = "";

  try {
    const res = await scheduleExam(props.bankSoal.id, {
      scheduledAt: new Date(form.value.scheduledAt).toISOString(),
      proctorId: form.value.proctorId,
    });

    emit("scheduled", {
      count: res.data.count,
      message: res.data.message,
    });
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } };
    submitError.value =
      err.response?.data?.message || "Gagal menjadwalkan ujian";
  } finally {
    submitting.value = false;
  }
}

// Handle close
function handleClose() {
  if (!submitting.value) {
    emit("close");
  }
}

// Handle proktor select
function selectProktor(value: string) {
  form.value.proctorId = value;
  showProktorDropdown.value = false;
  errors.value.proctorId = undefined;
}

// Reset form
function resetForm() {
  form.value = {
    scheduledAt: "",
    proctorId: authStore.user?.id || "",
  };
  errors.value = {};
  submitError.value = "";
}

// Watch for show prop changes
watch(
  () => props.show,
  (newVal: boolean) => {
    if (newVal) {
      resetForm();
    }
    // Close dropdown when modal closes
    if (!newVal) {
      showProktorDropdown.value = false;
    }
  },
);

// Close dropdown on click outside
function handleClickOutside(event: Event) {
  const target = event.target as HTMLElement;
  if (!target.closest(".dropdown-container")) {
    showProktorDropdown.value = false;
  }
}

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
  // Set default proktor to current user
  if (authStore.user?.id) {
    form.value.proctorId = authStore.user.id;
  }
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-in-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200 ease-in-out"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          @click="handleClose"
        />

        <!-- Modal panel -->
        <div
          class="relative bg-white rounded-2xl shadow-lg w-full max-w-lg overflow-hidden"
        >
          <!-- Header -->
          <div
            class="flex items-center justify-between px-6 py-4 border-b-2 border-gray-200"
          >
            <div>
              <h2 class="text-lg font-bold text-gray-900">Jadwalkan Ujian</h2>
              <p v-if="bankSoal" class="text-sm mt-0.5 text-gray-500">
                {{ bankSoal.nama }}
              </p>
            </div>
            <button
              class="p-2 rounded-lg transition-colors hover:bg-gray-100 text-gray-500"
              :disabled="submitting"
              @click="handleClose"
            >
              <svg
                class="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="px-6 py-5 max-h-[70vh] overflow-y-auto">
            <!-- No Soal Warning -->
            <div
              v-if="hasNoSoal"
              class="mb-5 rounded-xl p-4 text-sm bg-red-50 border border-red-500 text-red-700"
            >
              <div class="flex items-center gap-2">
                <svg
                  class="w-5 h-5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span class="font-semibold">
                  Bank soal belum memiliki soal. Tambahkan soal terlebih dahulu
                  sebelum menjadwalkan ujian.
                </span>
              </div>
            </div>

            <!-- No Target Kelas Warning -->
            <div
              v-else-if="hasNoTargetKelas"
              class="mb-5 rounded-xl p-4 text-sm bg-amber-50 border border-amber-500 text-amber-700"
            >
              <div class="flex items-center gap-2">
                <svg
                  class="w-5 h-5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span class="font-semibold">
                  Bank soal tidak memiliki target kelas. Edit bank soal dan
                  tambahkan target kelas terlebih dahulu.
                </span>
              </div>
            </div>

            <!-- Submit Error -->
            <div
              v-if="submitError"
              class="mb-5 rounded-xl p-4 text-sm bg-red-50 border border-red-200 text-red-700 flex items-center justify-between"
            >
              <span>{{ submitError }}</span>
              <button
                class="text-red-500 hover:text-red-700"
                @click="submitError = ''"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <!-- Inherited Settings Info -->
            <div
              v-if="bankSoal && !hasNoSoal && !hasNoTargetKelas"
              class="mb-5 rounded-xl p-4 bg-gray-50 border border-gray-200"
            >
              <p class="text-xs font-semibold mb-3 text-gray-600">
                Pengaturan dari Bank Soal
              </p>
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <p
                    class="text-[11px] uppercase tracking-wide mb-0.5 text-gray-500"
                  >
                    Durasi
                  </p>
                  <p class="text-sm font-medium text-gray-900">
                    {{ bankSoal.durasiMenit }} menit
                  </p>
                </div>
                <div>
                  <p
                    class="text-[11px] uppercase tracking-wide mb-0.5 text-gray-500"
                  >
                    Acak Soal
                  </p>
                  <p
                    class="text-sm font-medium"
                    :class="
                      bankSoal.shuffleQuestions
                        ? 'text-emerald-600'
                        : 'text-gray-500'
                    "
                  >
                    {{ bankSoal.shuffleQuestions ? "Ya" : "Tidak" }}
                  </p>
                </div>
                <div>
                  <p
                    class="text-[11px] uppercase tracking-wide mb-0.5 text-gray-500"
                  >
                    Acak Opsi
                  </p>
                  <p
                    class="text-sm font-medium"
                    :class="
                      bankSoal.shuffleOptions
                        ? 'text-emerald-600'
                        : 'text-gray-500'
                    "
                  >
                    {{ bankSoal.shuffleOptions ? "Ya" : "Tidak" }}
                  </p>
                </div>
              </div>

              <!-- Target Kelas Info - NEW -->
              <div class="mt-3 pt-3 border-t border-gray-200">
                <p class="text-xs font-semibold mb-2 text-gray-600">
                  Target Kelas
                </p>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="kelas in bankSoal.targetKelas"
                    :key="kelas.value"
                    class="inline-flex rounded-lg bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700"
                  >
                    {{ kelas.label }}
                  </span>
                </div>
                <p class="mt-2 text-xs text-gray-500">
                  <span class="font-medium text-indigo-600"
                    >{{ bankSoal.targetKelas.length }} sesi ujian</span
                  >
                  akan dibuat secara otomatis (satu per kelas)
                </p>
              </div>

              <div class="mt-3 pt-3 border-t border-gray-200">
                <p class="text-xs text-gray-500">
                  <span class="font-medium text-indigo-600">{{
                    bankSoal.soalCount
                  }}</span>
                  soal akan disalin ke setiap sesi ujian
                </p>
              </div>
            </div>

            <form class="space-y-5" @submit.prevent="handleSubmit">
              <!-- Tanggal dan Waktu -->
              <div>
                <label class="block text-sm font-medium mb-1.5 text-gray-700">
                  Tanggal dan Waktu Mulai
                  <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="form.scheduledAt"
                  type="datetime-local"
                  :min="minDateTime"
                  :disabled="hasNoSoal || hasNoTargetKelas"
                  class="block w-full px-3 py-2.5 text-sm rounded-lg outline-none transition-colors border-2"
                  :class="[
                    errors.scheduledAt
                      ? 'border-red-500'
                      : 'border-gray-200 focus:border-indigo-500',
                    hasNoSoal || hasNoTargetKelas
                      ? 'bg-gray-100 cursor-not-allowed'
                      : 'bg-white',
                  ]"
                  @input="errors.scheduledAt = undefined"
                />
                <p v-if="errors.scheduledAt" class="mt-1 text-xs text-red-500">
                  {{ errors.scheduledAt }}
                </p>
              </div>

              <!-- Proktor -->
              <div class="dropdown-container relative">
                <label class="block text-sm font-medium mb-1.5 text-gray-700">
                  Proktor
                  <span class="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  :disabled="hasNoSoal || hasNoTargetKelas"
                  class="w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg text-left transition-colors border-2"
                  :class="[
                    errors.proctorId ? 'border-red-500' : 'border-gray-200',
                    form.proctorId ? 'text-gray-900' : 'text-gray-500',
                    hasNoSoal || hasNoTargetKelas
                      ? 'bg-gray-100 cursor-not-allowed'
                      : 'bg-white cursor-pointer',
                  ]"
                  @click="
                    !hasNoSoal &&
                    !hasNoTargetKelas &&
                    (showProktorDropdown = !showProktorDropdown)
                  "
                >
                  <span class="truncate">{{ selectedProktorLabel }}</span>
                  <svg
                    :class="[
                      'w-4 h-4 transition-transform text-gray-500',
                      showProktorDropdown ? 'rotate-180' : '',
                    ]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                <!-- Dropdown -->
                <Transition
                  enter-active-class="transition-all duration-150 ease-out"
                  enter-from-class="opacity-0 translate-y-1"
                  enter-to-class="opacity-100 translate-y-0"
                  leave-active-class="transition-all duration-100 ease-in"
                  leave-from-class="opacity-100 translate-y-0"
                  leave-to-class="opacity-0 translate-y-1"
                >
                  <div
                    v-if="showProktorDropdown"
                    class="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                  >
                    <div
                      v-for="option in userOptions"
                      :key="option.value"
                      class="px-3 py-2.5 text-sm cursor-pointer transition-colors hover:bg-indigo-50"
                      :class="
                        option.value === form.proctorId
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-gray-900'
                      "
                      @click="selectProktor(option.value)"
                    >
                      {{ option.label }}
                    </div>
                    <div
                      v-if="userOptions.length === 0"
                      class="px-3 py-4 text-center text-sm text-gray-500"
                    >
                      Tidak ada proktor tersedia
                    </div>
                  </div>
                </Transition>
                <p v-if="errors.proctorId" class="mt-1 text-xs text-red-500">
                  {{ errors.proctorId }}
                </p>
                <p
                  v-if="
                    !errors.proctorId && form.proctorId === authStore.user?.id
                  "
                  class="mt-1 text-xs text-gray-500"
                >
                  Anda akan menjadi proktor untuk semua sesi ujian yang dibuat
                </p>
              </div>
            </form>
          </div>

          <!-- Footer -->
          <div
            class="flex items-center justify-end gap-3 px-6 py-4 border-t-2 border-gray-200"
          >
            <button
              type="button"
              class="px-4 py-2.5 text-sm font-medium rounded-lg transition-colors border-2 border-gray-200 text-gray-700 hover:bg-gray-50"
              :disabled="submitting"
              @click="handleClose"
            >
              Batal
            </button>
            <button
              type="submit"
              class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
              :class="
                isFormValid && !submitting
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              "
              :disabled="!isFormValid || submitting"
              @click="handleSubmit"
            >
              <svg
                v-if="submitting"
                class="h-4 w-4 animate-spin"
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
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <svg
                v-else
                class="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              {{
                submitting
                  ? "Menjadwalkan..."
                  : `Jadwalkan ${bankSoal?.targetKelas.length || 0} Sesi`
              }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
