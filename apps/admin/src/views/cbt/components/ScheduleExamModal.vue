<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useAuthStore } from "@/stores/auth";

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
  scheduled: [sessionId: string];
}>();

export interface ScheduleExamFormData {
  scheduledAt: string;
  kelasId: string;
  proctorId: string;
}

// Auth store for current user
const authStore = useAuthStore();

// Form state
const form = ref<ScheduleExamFormData>({
  scheduledAt: "",
  kelasId: "",
  proctorId: "",
});

// Validation errors
const errors = ref<Partial<Record<keyof ScheduleExamFormData, string>>>({});

// Dropdown states
const showKelasDropdown = ref(false);
const showProktorDropdown = ref(false);

// Loading state
const submitting = ref(false);

// Computed: check if bank soal has no questions
const hasNoSoal = computed(() => {
  return props.bankSoal?.soalCount === 0;
});

// Computed: form is valid
const isFormValid = computed(() => {
  if (hasNoSoal.value) return false;
  return (
    form.value.scheduledAt !== "" &&
    form.value.kelasId !== "" &&
    form.value.proctorId !== ""
  );
});

// Computed: selected kelas label
const selectedKelasLabel = computed(() => {
  if (!form.value.kelasId || !props.bankSoal) return "-- Pilih Kelas --";
  const selected = props.bankSoal.targetKelas.find(
    (k: KelasOption) => k.value === form.value.kelasId,
  );
  return selected?.label || "-- Pilih Kelas --";
});

// Computed: selected proktor label
const selectedProktorLabel = computed(() => {
  if (!form.value.proctorId) return "-- Pilih Proktor --";
  const selected = props.userOptions.find(
    (u: UserOption) => u.value === form.value.proctorId,
  );
  return selected?.label || "-- Pilih Proktor --";
});

// Computed: minimum datetime (now)
const minDateTime = computed(() => {
  const now = new Date();
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
    const now = new Date();
    if (selectedDate < now) {
      errors.value.scheduledAt = "Tanggal tidak boleh di masa lalu";
    }
  }

  if (!form.value.kelasId) {
    errors.value.kelasId = "Kelas peserta wajib dipilih";
  }

  if (!form.value.proctorId) {
    errors.value.proctorId = "Proktor wajib dipilih";
  }

  return Object.keys(errors.value).length === 0;
}

// Handle form submit
async function handleSubmit() {
  if (!validate() || !props.bankSoal || hasNoSoal.value) return;

  submitting.value = true;
  try {
    // TODO: Replace with actual API call when bank-soal API client is ready
    // const dto: ScheduleExamDto = {
    //   scheduledAt: new Date(form.value.scheduledAt).toISOString(),
    //   kelasId: form.value.kelasId,
    //   proctorId: form.value.proctorId,
    // };
    // const res = await scheduleExam(props.bankSoal.id, dto);
    // emit("scheduled", res.data.id);

    // Mock for now - simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));
    const mockSessionId = "mock-session-id";
    emit("scheduled", mockSessionId);
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } };
    // Show error - could be handled with toast in parent
    console.error(err.response?.data?.message || "Gagal menjadwalkan ujian");
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

// Handle kelas select
function selectKelas(value: string) {
  form.value.kelasId = value;
  showKelasDropdown.value = false;
  errors.value.kelasId = undefined;
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
    kelasId: "",
    proctorId: authStore.user?.id || "",
  };
  errors.value = {};
}

// Watch for show prop changes
watch(
  () => props.show,
  (newVal: boolean) => {
    if (newVal) {
      resetForm();
    }
    // Close all dropdowns when modal closes
    if (!newVal) {
      showKelasDropdown.value = false;
      showProktorDropdown.value = false;
    }
  },
);

// Watch for bankSoal changes - auto-select kelas if only one
watch(
  () => props.bankSoal,
  (newVal: BankSoalForSchedule | null) => {
    if (newVal && newVal.targetKelas.length === 1) {
      form.value.kelasId = newVal.targetKelas[0].value;
    }
  },
  { immediate: true },
);

// Close dropdowns on click outside
function handleClickOutside(event: Event) {
  const target = event.target as HTMLElement;
  if (!target.closest(".dropdown-container")) {
    showKelasDropdown.value = false;
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
          class="absolute inset-0 backdrop-blur-[2px]"
          style="background: rgba(28, 25, 23, 0.4)"
          @click="handleClose"
        />

        <!-- Modal panel -->
        <div
          class="relative bg-white rounded-[16px] shadow-lg w-full max-w-lg overflow-hidden"
          style="box-shadow: var(--shadow-lg)"
        >
          <!-- Header -->
          <div
            class="flex items-center justify-between px-6 py-4"
            style="border-bottom: 2px solid var(--color-border)"
          >
            <div>
              <h2
                class="text-[18px] font-bold"
                style="color: var(--color-text-primary)"
              >
                Jadwalkan Ujian
              </h2>
              <p
                v-if="bankSoal"
                class="text-[14px] mt-0.5"
                style="color: var(--color-text-tertiary)"
              >
                {{ bankSoal.nama }}
              </p>
            </div>
            <button
              class="p-2 rounded-[8px] transition-colors hover:bg-[var(--color-surface-100)]"
              style="color: var(--color-text-tertiary)"
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
              class="mb-5 rounded-[12px] p-4 text-[14px]"
              style="
                background: var(--color-danger-50);
                border: 1px solid var(--color-danger-500);
                color: var(--color-danger-700);
              "
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
                <span class="font-semibold"
                  >Bank soal belum memiliki soal. Tambahkan soal terlebih dahulu
                  sebelum menjadwalkan ujian.</span
                >
              </div>
            </div>

            <!-- Inherited Settings Info -->
            <div
              v-if="bankSoal"
              class="mb-5 rounded-[12px] p-4"
              style="
                background: var(--color-surface-50);
                border: 1px solid var(--color-border);
              "
            >
              <p
                class="text-[13px] font-semibold mb-3"
                style="color: var(--color-text-secondary)"
              >
                Pengaturan dari Bank Soal
              </p>
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <p
                    class="text-[11px] uppercase tracking-wide mb-0.5"
                    style="color: var(--color-text-tertiary)"
                  >
                    Durasi
                  </p>
                  <p
                    class="text-[14px] font-medium"
                    style="color: var(--color-text-primary)"
                  >
                    {{ bankSoal.durasiMenit }} menit
                  </p>
                </div>
                <div>
                  <p
                    class="text-[11px] uppercase tracking-wide mb-0.5"
                    style="color: var(--color-text-tertiary)"
                  >
                    Acak Soal
                  </p>
                  <p
                    class="text-[14px] font-medium"
                    :style="{
                      color: bankSoal.shuffleQuestions
                        ? 'var(--color-success-600)'
                        : 'var(--color-text-tertiary)',
                    }"
                  >
                    {{ bankSoal.shuffleQuestions ? "Ya" : "Tidak" }}
                  </p>
                </div>
                <div>
                  <p
                    class="text-[11px] uppercase tracking-wide mb-0.5"
                    style="color: var(--color-text-tertiary)"
                  >
                    Acak Opsi
                  </p>
                  <p
                    class="text-[14px] font-medium"
                    :style="{
                      color: bankSoal.shuffleOptions
                        ? 'var(--color-success-600)'
                        : 'var(--color-text-tertiary)',
                    }"
                  >
                    {{ bankSoal.shuffleOptions ? "Ya" : "Tidak" }}
                  </p>
                </div>
              </div>
              <div
                class="mt-3 pt-3"
                style="border-top: 1px solid var(--color-border)"
              >
                <p
                  class="text-[12px]"
                  style="color: var(--color-text-tertiary)"
                >
                  <span
                    class="font-medium"
                    style="color: var(--color-primary-600)"
                    >{{ bankSoal.soalCount }}</span
                  >
                  soal akan disalin ke sesi ujian
                </p>
              </div>
            </div>

            <form class="space-y-5" @submit.prevent="handleSubmit">
              <!-- Tanggal dan Waktu -->
              <div>
                <label
                  class="block text-[14px] font-medium mb-1.5"
                  style="color: var(--color-text-secondary)"
                >
                  Tanggal dan Waktu Mulai
                  <span style="color: var(--color-danger-500)">*</span>
                </label>
                <input
                  v-model="form.scheduledAt"
                  type="datetime-local"
                  :min="minDateTime"
                  :disabled="hasNoSoal"
                  class="block w-full px-3 py-2.5 text-[14px] rounded-[8px] outline-none transition-colors"
                  :style="{
                    border: errors.scheduledAt
                      ? '2px solid var(--color-danger-500)'
                      : '2px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                    background: hasNoSoal
                      ? 'var(--color-surface-100)'
                      : 'white',
                  }"
                  @input="errors.scheduledAt = undefined"
                />
                <p
                  v-if="errors.scheduledAt"
                  class="mt-1 text-[13px]"
                  style="color: var(--color-danger-500)"
                >
                  {{ errors.scheduledAt }}
                </p>
              </div>

              <!-- Kelas Peserta -->
              <div class="dropdown-container relative">
                <label
                  class="block text-[14px] font-medium mb-1.5"
                  style="color: var(--color-text-secondary)"
                >
                  Kelas Peserta
                  <span style="color: var(--color-danger-500)">*</span>
                </label>
                <button
                  type="button"
                  :disabled="
                    hasNoSoal || !bankSoal || bankSoal.targetKelas.length === 0
                  "
                  class="w-full flex items-center justify-between px-3 py-2.5 text-[14px] rounded-[8px] text-left transition-colors"
                  :style="{
                    border: errors.kelasId
                      ? '2px solid var(--color-danger-500)'
                      : '2px solid var(--color-border)',
                    color: form.kelasId
                      ? 'var(--color-text-primary)'
                      : 'var(--color-text-tertiary)',
                    background: hasNoSoal
                      ? 'var(--color-surface-100)'
                      : 'white',
                    cursor: hasNoSoal ? 'not-allowed' : 'pointer',
                  }"
                  @click="
                    !hasNoSoal &&
                    bankSoal &&
                    bankSoal.targetKelas.length > 0 &&
                    (showKelasDropdown = !showKelasDropdown)
                  "
                >
                  <span class="truncate">{{ selectedKelasLabel }}</span>
                  <svg
                    :class="[
                      'w-4 h-4 transition-transform',
                      showKelasDropdown ? 'rotate-180' : '',
                    ]"
                    style="color: var(--color-text-tertiary)"
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
                    v-if="showKelasDropdown && bankSoal"
                    class="absolute z-10 mt-1 w-full bg-white border rounded-[8px] shadow-lg max-h-48 overflow-y-auto"
                    style="border-color: var(--color-border)"
                  >
                    <div
                      v-for="option in bankSoal.targetKelas"
                      :key="option.value"
                      class="px-3 py-2.5 text-[14px] cursor-pointer transition-colors hover:bg-[var(--color-primary-50)]"
                      :style="{
                        background:
                          option.value === form.kelasId
                            ? 'var(--color-primary-50)'
                            : 'transparent',
                        color:
                          option.value === form.kelasId
                            ? 'var(--color-primary-700)'
                            : 'var(--color-text-primary)',
                      }"
                      @click="selectKelas(option.value)"
                    >
                      {{ option.label }}
                    </div>
                    <div
                      v-if="bankSoal.targetKelas.length === 0"
                      class="px-3 py-4 text-center text-[14px]"
                      style="color: var(--color-text-tertiary)"
                    >
                      Tidak ada target kelas
                    </div>
                  </div>
                </Transition>
                <p
                  v-if="errors.kelasId"
                  class="mt-1 text-[13px]"
                  style="color: var(--color-danger-500)"
                >
                  {{ errors.kelasId }}
                </p>
                <p
                  v-if="
                    bankSoal &&
                    bankSoal.tingkat &&
                    bankSoal.targetKelas.length === 0
                  "
                  class="mt-1 text-[12px]"
                  style="color: var(--color-text-tertiary)"
                >
                  Bank soal menggunakan tingkat {{ bankSoal.tingkat }}, pilih
                  kelas dari tingkat tersebut
                </p>
              </div>

              <!-- Proktor -->
              <div class="dropdown-container relative">
                <label
                  class="block text-[14px] font-medium mb-1.5"
                  style="color: var(--color-text-secondary)"
                >
                  Proktor
                  <span style="color: var(--color-danger-500)">*</span>
                </label>
                <button
                  type="button"
                  :disabled="hasNoSoal"
                  class="w-full flex items-center justify-between px-3 py-2.5 text-[14px] rounded-[8px] text-left transition-colors"
                  :style="{
                    border: errors.proctorId
                      ? '2px solid var(--color-danger-500)'
                      : '2px solid var(--color-border)',
                    color: form.proctorId
                      ? 'var(--color-text-primary)'
                      : 'var(--color-text-tertiary)',
                    background: hasNoSoal
                      ? 'var(--color-surface-100)'
                      : 'white',
                    cursor: hasNoSoal ? 'not-allowed' : 'pointer',
                  }"
                  @click="
                    !hasNoSoal && (showProktorDropdown = !showProktorDropdown)
                  "
                >
                  <span class="truncate">{{ selectedProktorLabel }}</span>
                  <svg
                    :class="[
                      'w-4 h-4 transition-transform',
                      showProktorDropdown ? 'rotate-180' : '',
                    ]"
                    style="color: var(--color-text-tertiary)"
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
                    class="absolute z-10 mt-1 w-full bg-white border rounded-[8px] shadow-lg max-h-48 overflow-y-auto"
                    style="border-color: var(--color-border)"
                  >
                    <div
                      v-for="option in userOptions"
                      :key="option.value"
                      class="px-3 py-2.5 text-[14px] cursor-pointer transition-colors hover:bg-[var(--color-primary-50)]"
                      :style="{
                        background:
                          option.value === form.proctorId
                            ? 'var(--color-primary-50)'
                            : 'transparent',
                        color:
                          option.value === form.proctorId
                            ? 'var(--color-primary-700)'
                            : 'var(--color-text-primary)',
                      }"
                      @click="selectProktor(option.value)"
                    >
                      {{ option.label }}
                    </div>
                    <div
                      v-if="userOptions.length === 0"
                      class="px-3 py-4 text-center text-[14px]"
                      style="color: var(--color-text-tertiary)"
                    >
                      Tidak ada proktor tersedia
                    </div>
                  </div>
                </Transition>
                <p
                  v-if="errors.proctorId"
                  class="mt-1 text-[13px]"
                  style="color: var(--color-danger-500)"
                >
                  {{ errors.proctorId }}
                </p>
                <p
                  v-if="
                    !errors.proctorId && form.proctorId === authStore.user?.id
                  "
                  class="mt-1 text-[12px]"
                  style="color: var(--color-text-tertiary)"
                >
                  Anda akan menjadi proktor untuk sesi ujian ini
                </p>
              </div>
            </form>
          </div>

          <!-- Footer -->
          <div
            class="flex items-center justify-end gap-3 px-6 py-4"
            style="border-top: 2px solid var(--color-border)"
          >
            <button
              type="button"
              class="px-4 py-2.5 text-[14px] font-medium rounded-[8px] transition-colors"
              style="
                border: 2px solid var(--color-border);
                color: var(--color-text-secondary);
              "
              :disabled="submitting"
              @click="handleClose"
            >
              Batal
            </button>
            <button
              type="submit"
              class="inline-flex items-center gap-2 px-4 py-2.5 text-[14px] font-medium rounded-[8px] transition-colors"
              :style="{
                background:
                  isFormValid && !submitting
                    ? 'var(--color-primary-600)'
                    : 'var(--color-surface-200)',
                color:
                  isFormValid && !submitting
                    ? 'white'
                    : 'var(--color-text-tertiary)',
                cursor: isFormValid && !submitting ? 'pointer' : 'not-allowed',
              }"
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
              {{ submitting ? "Menjadwalkan..." : "Jadwalkan Ujian" }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
