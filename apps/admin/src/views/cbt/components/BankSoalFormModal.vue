<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";

export interface MataPelajaranOption {
  value: string;
  label: string;
}

export interface KelasOption {
  value: string;
  label: string;
  tingkat: number;
}

export interface BankSoal {
  id: string;
  nama: string;
  mataPelajaranId: string;
  tingkat: number | null;
  targetKelasIds: string[];
  durasiMenit: number;
  kkm: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
}

interface Props {
  show: boolean;
  isEdit?: boolean;
  bankSoal?: BankSoal | null;
  mataPelajaranOptions: MataPelajaranOption[];
  kelasOptions: KelasOption[];
  hasActivePelaksanaan: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isEdit: false,
  bankSoal: null,
  hasActivePelaksanaan: true,
});

const emit = defineEmits<{
  close: [];
  submit: [data: BankSoalFormData];
}>();

export interface BankSoalFormData {
  nama: string;
  mataPelajaranId: string;
  tingkat: number | null;
  targetKelasIds: string[];
  durasiMenit: number;
  kkm: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
}

// Form state
const form = ref<BankSoalFormData>({
  nama: "",
  mataPelajaranId: "",
  tingkat: null,
  targetKelasIds: [],
  durasiMenit: 60,
  kkm: 70,
  shuffleQuestions: false,
  shuffleOptions: false,
});

// Validation errors
const errors = ref<Partial<Record<keyof BankSoalFormData, string>>>({});

// Dropdown states
const showMataPelajaranDropdown = ref(false);
const showTingkatDropdown = ref(false);
const showKelasDropdown = ref(false);

// Tingkat options (1-12)
const tingkatOptions = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: `Tingkat ${i + 1}`,
}));

// Computed: selected mata pelajaran label
const selectedMataPelajaranLabel = computed(() => {
  const selected = props.mataPelajaranOptions.find(
    (o: MataPelajaranOption) => o.value === form.value.mataPelajaranId,
  );
  return selected?.label || "-- Pilih Mata Pelajaran --";
});

// Computed: selected tingkat label
const selectedTingkatLabel = computed(() => {
  if (form.value.tingkat === null) return "-- Pilih Tingkat --";
  return `Tingkat ${form.value.tingkat}`;
});

// Computed: selected kelas labels
const selectedKelasLabels = computed(() => {
  if (form.value.targetKelasIds.length === 0) return "-- Pilih Kelas --";
  const selected = props.kelasOptions.filter((o: KelasOption) =>
    form.value.targetKelasIds.includes(o.value),
  );
  return selected.map((o: KelasOption) => o.label).join(", ");
});

// Computed: tingkat disabled when kelas selected
const isTingkatDisabled = computed(() => form.value.targetKelasIds.length > 0);

// Computed: kelas disabled when tingkat selected
const isKelasDisabled = computed(() => form.value.tingkat !== null);

// Computed: form valid
const isFormValid = computed(() => {
  return (
    form.value.nama.trim() !== "" &&
    form.value.mataPelajaranId !== "" &&
    form.value.durasiMenit >= 5 &&
    form.value.durasiMenit <= 360 &&
    form.value.kkm >= 0 &&
    form.value.kkm <= 100 &&
    (form.value.tingkat !== null || form.value.targetKelasIds.length > 0)
  );
});

// Validate form
function validate(): boolean {
  errors.value = {};

  if (!form.value.nama.trim()) {
    errors.value.nama = "Nama bank soal wajib diisi";
  }

  if (!form.value.mataPelajaranId) {
    errors.value.mataPelajaranId = "Mata pelajaran wajib dipilih";
  }

  if (form.value.durasiMenit < 5 || form.value.durasiMenit > 360) {
    errors.value.durasiMenit = "Durasi harus antara 5-360 menit";
  }

  if (form.value.kkm < 0 || form.value.kkm > 100) {
    errors.value.kkm = "KKM harus antara 0-100";
  }

  if (form.value.tingkat === null && form.value.targetKelasIds.length === 0) {
    errors.value.tingkat = "Pilih tingkat atau kelas target";
  }

  return Object.keys(errors.value).length === 0;
}

// Handle form submit
function handleSubmit() {
  if (!validate()) return;
  emit("submit", { ...form.value });
}

// Handle close
function handleClose() {
  emit("close");
}

// Handle mata pelajaran select
function selectMataPelajaran(value: string) {
  form.value.mataPelajaranId = value;
  showMataPelajaranDropdown.value = false;
  errors.value.mataPelajaranId = undefined;
}

// Handle tingkat select
function selectTingkat(value: number | null) {
  form.value.tingkat = value;
  // When tingkat is selected, clear kelas selection
  if (value !== null) {
    form.value.targetKelasIds = [];
  }
  showTingkatDropdown.value = false;
  errors.value.tingkat = undefined;
}

// Handle kelas toggle
function toggleKelas(value: string) {
  const index = form.value.targetKelasIds.indexOf(value);
  if (index === -1) {
    form.value.targetKelasIds.push(value);
    // When kelas is selected, clear tingkat
    form.value.tingkat = null;
  } else {
    form.value.targetKelasIds.splice(index, 1);
  }
  errors.value.tingkat = undefined;
}

// Clear tingkat
function clearTingkat() {
  form.value.tingkat = null;
  showTingkatDropdown.value = false;
}

// Clear all kelas
function clearKelas() {
  form.value.targetKelasIds = [];
}

// Reset form
function resetForm() {
  form.value = {
    nama: "",
    mataPelajaranId: "",
    tingkat: null,
    targetKelasIds: [],
    durasiMenit: 60,
    kkm: 70,
    shuffleQuestions: false,
    shuffleOptions: false,
  };
  errors.value = {};
}

// Watch for bankSoal prop changes (for edit mode)
watch(
  () => props.bankSoal,
  (newVal: BankSoal | null | undefined) => {
    if (newVal && props.isEdit) {
      form.value = {
        nama: newVal.nama,
        mataPelajaranId: newVal.mataPelajaranId,
        tingkat: newVal.tingkat,
        targetKelasIds: [...(newVal.targetKelasIds || [])],
        durasiMenit: newVal.durasiMenit,
        kkm: newVal.kkm,
        shuffleQuestions: newVal.shuffleQuestions,
        shuffleOptions: newVal.shuffleOptions,
      };
    }
  },
  { immediate: true },
);

// Watch for show prop changes
watch(
  () => props.show,
  (newVal: boolean) => {
    if (newVal && !props.isEdit) {
      resetForm();
    }
    // Close all dropdowns when modal closes
    if (!newVal) {
      showMataPelajaranDropdown.value = false;
      showTingkatDropdown.value = false;
      showKelasDropdown.value = false;
    }
  },
);

// Close dropdowns on click outside
function handleClickOutside(event: Event) {
  const target = event.target as HTMLElement;
  if (!target.closest(".dropdown-container")) {
    showMataPelajaranDropdown.value = false;
    showTingkatDropdown.value = false;
    showKelasDropdown.value = false;
  }
}

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
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
          class="relative bg-white rounded-[16px] shadow-lg w-full max-w-2xl overflow-hidden"
          style="box-shadow: var(--shadow-lg)"
        >
          <!-- Header -->
          <div
            class="flex items-center justify-between px-6 py-4"
            style="border-bottom: 2px solid var(--color-border)"
          >
            <h2
              class="text-[18px] font-bold"
              style="color: var(--color-text-primary)"
            >
              {{ isEdit ? "Edit Bank Soal" : "Buat Bank Soal Baru" }}
            </h2>
            <button
              class="p-2 rounded-[8px] transition-colors hover:bg-[var(--color-surface-100)]"
              style="color: var(--color-text-tertiary)"
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
            <!-- No Active Pelaksanaan Error -->
            <div
              v-if="!hasActivePelaksanaan"
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
                  >Tidak ada pelaksanaan ujian aktif. Hubungi admin.</span
                >
              </div>
            </div>

            <form class="space-y-5" @submit.prevent="handleSubmit">
              <!-- Nama Bank Soal -->
              <div>
                <label
                  class="block text-[14px] font-medium mb-1.5"
                  style="color: var(--color-text-secondary)"
                >
                  Nama Bank Soal
                  <span style="color: var(--color-danger-500)">*</span>
                </label>
                <input
                  v-model="form.nama"
                  type="text"
                  placeholder="Contoh: UTS Matematika Kelas 10"
                  :disabled="!hasActivePelaksanaan"
                  class="block w-full px-3 py-2.5 text-[14px] rounded-[8px] outline-none transition-colors"
                  :style="{
                    border: errors.nama
                      ? '2px solid var(--color-danger-500)'
                      : '2px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                    background: !hasActivePelaksanaan
                      ? 'var(--color-surface-100)'
                      : 'white',
                  }"
                  @input="errors.nama = undefined"
                />
                <p
                  v-if="errors.nama"
                  class="mt-1 text-[13px]"
                  style="color: var(--color-danger-500)"
                >
                  {{ errors.nama }}
                </p>
              </div>

              <!-- Mata Pelajaran -->
              <div class="dropdown-container relative">
                <label
                  class="block text-[14px] font-medium mb-1.5"
                  style="color: var(--color-text-secondary)"
                >
                  Mata Pelajaran
                  <span style="color: var(--color-danger-500)">*</span>
                </label>
                <button
                  type="button"
                  :disabled="!hasActivePelaksanaan || isEdit"
                  class="w-full flex items-center justify-between px-3 py-2.5 text-[14px] rounded-[8px] text-left transition-colors"
                  :style="{
                    border: errors.mataPelajaranId
                      ? '2px solid var(--color-danger-500)'
                      : '2px solid var(--color-border)',
                    color: form.mataPelajaranId
                      ? 'var(--color-text-primary)'
                      : 'var(--color-text-tertiary)',
                    background:
                      !hasActivePelaksanaan || isEdit
                        ? 'var(--color-surface-100)'
                        : 'white',
                    cursor:
                      !hasActivePelaksanaan || isEdit
                        ? 'not-allowed'
                        : 'pointer',
                  }"
                  @click="
                    !isEdit &&
                    hasActivePelaksanaan &&
                    (showMataPelajaranDropdown = !showMataPelajaranDropdown)
                  "
                >
                  <span class="truncate">{{ selectedMataPelajaranLabel }}</span>
                  <svg
                    :class="[
                      'w-4 h-4 transition-transform',
                      showMataPelajaranDropdown ? 'rotate-180' : '',
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
                    v-if="showMataPelajaranDropdown"
                    class="absolute z-10 mt-1 w-full bg-white border rounded-[8px] shadow-lg max-h-48 overflow-y-auto"
                    style="border-color: var(--color-border)"
                  >
                    <div
                      v-for="option in mataPelajaranOptions"
                      :key="option.value"
                      class="px-3 py-2.5 text-[14px] cursor-pointer transition-colors hover:bg-[var(--color-primary-50)]"
                      :style="{
                        background:
                          option.value === form.mataPelajaranId
                            ? 'var(--color-primary-50)'
                            : 'transparent',
                        color:
                          option.value === form.mataPelajaranId
                            ? 'var(--color-primary-700)'
                            : 'var(--color-text-primary)',
                      }"
                      @click="selectMataPelajaran(option.value)"
                    >
                      {{ option.label }}
                    </div>
                    <div
                      v-if="mataPelajaranOptions.length === 0"
                      class="px-3 py-4 text-center text-[14px]"
                      style="color: var(--color-text-tertiary)"
                    >
                      Tidak ada mata pelajaran tersedia
                    </div>
                  </div>
                </Transition>
                <p
                  v-if="errors.mataPelajaranId"
                  class="mt-1 text-[13px]"
                  style="color: var(--color-danger-500)"
                >
                  {{ errors.mataPelajaranId }}
                </p>
                <p
                  v-if="isEdit"
                  class="mt-1 text-[13px]"
                  style="color: var(--color-text-tertiary)"
                >
                  Mata pelajaran tidak dapat diubah setelah bank soal dibuat
                </p>
              </div>

              <!-- Target Peserta: Tingkat vs Kelas -->
              <div
                class="p-4 rounded-[12px]"
                style="
                  background: var(--color-surface-50);
                  border: 1px solid var(--color-border);
                "
              >
                <label
                  class="block text-[14px] font-semibold mb-3"
                  style="color: var(--color-text-primary)"
                >
                  Target Peserta
                  <span style="color: var(--color-danger-500)">*</span>
                </label>
                <p
                  class="text-[13px] mb-4"
                  style="color: var(--color-text-tertiary)"
                >
                  Pilih tingkat (berlaku untuk semua kelas di tingkat tersebut)
                  ATAU pilih kelas spesifik. Keduanya tidak bisa dipilih
                  bersamaan.
                </p>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <!-- Tingkat Dropdown -->
                  <div class="dropdown-container relative">
                    <label
                      class="block text-[13px] font-medium mb-1.5"
                      style="color: var(--color-text-secondary)"
                      >Tingkat</label
                    >
                    <button
                      type="button"
                      :disabled="!hasActivePelaksanaan || isTingkatDisabled"
                      class="w-full flex items-center justify-between px-3 py-2.5 text-[14px] rounded-[8px] text-left transition-colors"
                      :style="{
                        border: '2px solid var(--color-border)',
                        color:
                          form.tingkat !== null
                            ? 'var(--color-text-primary)'
                            : 'var(--color-text-tertiary)',
                        background:
                          !hasActivePelaksanaan || isTingkatDisabled
                            ? 'var(--color-surface-100)'
                            : 'white',
                        cursor:
                          !hasActivePelaksanaan || isTingkatDisabled
                            ? 'not-allowed'
                            : 'pointer',
                        opacity: isTingkatDisabled ? '0.6' : '1',
                      }"
                      @click="
                        !isTingkatDisabled &&
                        hasActivePelaksanaan &&
                        (showTingkatDropdown = !showTingkatDropdown)
                      "
                    >
                      <span class="truncate">{{ selectedTingkatLabel }}</span>
                      <div class="flex items-center gap-1">
                        <span
                          v-if="form.tingkat !== null && !isTingkatDisabled"
                          class="p-0.5 rounded hover:bg-[var(--color-surface-200)] transition-colors"
                          style="color: var(--color-text-tertiary)"
                          @click.stop="clearTingkat"
                        >
                          <svg
                            class="w-3.5 h-3.5"
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
                        </span>
                        <svg
                          :class="[
                            'w-4 h-4 transition-transform',
                            showTingkatDropdown ? 'rotate-180' : '',
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
                      </div>
                    </button>
                    <Transition
                      enter-active-class="transition-all duration-150 ease-out"
                      enter-from-class="opacity-0 translate-y-1"
                      enter-to-class="opacity-100 translate-y-0"
                      leave-active-class="transition-all duration-100 ease-in"
                      leave-from-class="opacity-100 translate-y-0"
                      leave-to-class="opacity-0 translate-y-1"
                    >
                      <div
                        v-if="showTingkatDropdown"
                        class="absolute z-10 mt-1 w-full bg-white border rounded-[8px] shadow-lg max-h-48 overflow-y-auto"
                        style="border-color: var(--color-border)"
                      >
                        <div
                          v-for="option in tingkatOptions"
                          :key="option.value"
                          class="px-3 py-2.5 text-[14px] cursor-pointer transition-colors hover:bg-[var(--color-primary-50)]"
                          :style="{
                            background:
                              option.value === form.tingkat
                                ? 'var(--color-primary-50)'
                                : 'transparent',
                            color:
                              option.value === form.tingkat
                                ? 'var(--color-primary-700)'
                                : 'var(--color-text-primary)',
                          }"
                          @click="selectTingkat(option.value)"
                        >
                          {{ option.label }}
                        </div>
                      </div>
                    </Transition>
                    <p
                      v-if="isTingkatDisabled"
                      class="mt-1 text-[12px]"
                      style="color: var(--color-text-tertiary)"
                    >
                      Nonaktif karena kelas dipilih
                    </p>
                  </div>

                  <!-- Kelas Multi-Select -->
                  <div class="dropdown-container relative">
                    <label
                      class="block text-[13px] font-medium mb-1.5"
                      style="color: var(--color-text-secondary)"
                      >Target Kelas</label
                    >
                    <button
                      type="button"
                      :disabled="!hasActivePelaksanaan || isKelasDisabled"
                      class="w-full flex items-center justify-between px-3 py-2.5 text-[14px] rounded-[8px] text-left transition-colors"
                      :style="{
                        border: '2px solid var(--color-border)',
                        color:
                          form.targetKelasIds.length > 0
                            ? 'var(--color-text-primary)'
                            : 'var(--color-text-tertiary)',
                        background:
                          !hasActivePelaksanaan || isKelasDisabled
                            ? 'var(--color-surface-100)'
                            : 'white',
                        cursor:
                          !hasActivePelaksanaan || isKelasDisabled
                            ? 'not-allowed'
                            : 'pointer',
                        opacity: isKelasDisabled ? '0.6' : '1',
                      }"
                      @click="
                        !isKelasDisabled &&
                        hasActivePelaksanaan &&
                        (showKelasDropdown = !showKelasDropdown)
                      "
                    >
                      <span class="truncate">{{ selectedKelasLabels }}</span>
                      <div class="flex items-center gap-1">
                        <span
                          v-if="
                            form.targetKelasIds.length > 0 && !isKelasDisabled
                          "
                          class="p-0.5 rounded hover:bg-[var(--color-surface-200)] transition-colors"
                          style="color: var(--color-text-tertiary)"
                          @click.stop="clearKelas"
                        >
                          <svg
                            class="w-3.5 h-3.5"
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
                        </span>
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
                      </div>
                    </button>
                    <Transition
                      enter-active-class="transition-all duration-150 ease-out"
                      enter-from-class="opacity-0 translate-y-1"
                      enter-to-class="opacity-100 translate-y-0"
                      leave-active-class="transition-all duration-100 ease-in"
                      leave-from-class="opacity-100 translate-y-0"
                      leave-to-class="opacity-0 translate-y-1"
                    >
                      <div
                        v-if="showKelasDropdown"
                        class="absolute z-10 mt-1 w-full bg-white border rounded-[8px] shadow-lg max-h-48 overflow-y-auto"
                        style="border-color: var(--color-border)"
                      >
                        <div
                          v-for="option in kelasOptions"
                          :key="option.value"
                          class="px-3 py-2.5 text-[14px] cursor-pointer transition-colors flex items-center justify-between hover:bg-[var(--color-primary-50)]"
                          :style="{
                            background: form.targetKelasIds.includes(
                              option.value,
                            )
                              ? 'var(--color-primary-50)'
                              : 'transparent',
                          }"
                          @click="toggleKelas(option.value)"
                        >
                          <span
                            :style="{
                              color: form.targetKelasIds.includes(option.value)
                                ? 'var(--color-primary-700)'
                                : 'var(--color-text-primary)',
                            }"
                            >{{ option.label }}</span
                          >
                          <svg
                            v-if="form.targetKelasIds.includes(option.value)"
                            class="w-4 h-4"
                            style="color: var(--color-primary-600)"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                        <div
                          v-if="kelasOptions.length === 0"
                          class="px-3 py-4 text-center text-[14px]"
                          style="color: var(--color-text-tertiary)"
                        >
                          Tidak ada kelas tersedia
                        </div>
                      </div>
                    </Transition>
                    <p
                      v-if="isKelasDisabled"
                      class="mt-1 text-[12px]"
                      style="color: var(--color-text-tertiary)"
                    >
                      Nonaktif karena tingkat dipilih
                    </p>
                  </div>
                </div>

                <p
                  v-if="errors.tingkat"
                  class="mt-2 text-[13px]"
                  style="color: var(--color-danger-500)"
                >
                  {{ errors.tingkat }}
                </p>
              </div>

              <!-- Durasi and KKM -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Durasi -->
                <div>
                  <label
                    class="block text-[14px] font-medium mb-1.5"
                    style="color: var(--color-text-secondary)"
                  >
                    Durasi Ujian (menit)
                    <span style="color: var(--color-danger-500)">*</span>
                  </label>
                  <input
                    v-model.number="form.durasiMenit"
                    type="number"
                    min="5"
                    max="360"
                    :disabled="!hasActivePelaksanaan"
                    class="block w-full px-3 py-2.5 text-[14px] rounded-[8px] outline-none transition-colors"
                    :style="{
                      border: errors.durasiMenit
                        ? '2px solid var(--color-danger-500)'
                        : '2px solid var(--color-border)',
                      color: 'var(--color-text-primary)',
                      background: !hasActivePelaksanaan
                        ? 'var(--color-surface-100)'
                        : 'white',
                    }"
                    @input="errors.durasiMenit = undefined"
                  />
                  <p
                    class="mt-1 text-[12px]"
                    style="color: var(--color-text-tertiary)"
                  >
                    Minimal 5 menit, maksimal 360 menit
                  </p>
                  <p
                    v-if="errors.durasiMenit"
                    class="mt-1 text-[13px]"
                    style="color: var(--color-danger-500)"
                  >
                    {{ errors.durasiMenit }}
                  </p>
                </div>

                <!-- KKM -->
                <div>
                  <label
                    class="block text-[14px] font-medium mb-1.5"
                    style="color: var(--color-text-secondary)"
                  >
                    KKM (Kriteria Ketuntasan Minimal)
                    <span style="color: var(--color-danger-500)">*</span>
                  </label>
                  <input
                    v-model.number="form.kkm"
                    type="number"
                    min="0"
                    max="100"
                    :disabled="!hasActivePelaksanaan"
                    class="block w-full px-3 py-2.5 text-[14px] rounded-[8px] outline-none transition-colors"
                    :style="{
                      border: errors.kkm
                        ? '2px solid var(--color-danger-500)'
                        : '2px solid var(--color-border)',
                      color: 'var(--color-text-primary)',
                      background: !hasActivePelaksanaan
                        ? 'var(--color-surface-100)'
                        : 'white',
                    }"
                    @input="errors.kkm = undefined"
                  />
                  <p
                    class="mt-1 text-[12px]"
                    style="color: var(--color-text-tertiary)"
                  >
                    Nilai 0-100
                  </p>
                  <p
                    v-if="errors.kkm"
                    class="mt-1 text-[13px]"
                    style="color: var(--color-danger-500)"
                  >
                    {{ errors.kkm }}
                  </p>
                </div>
              </div>

              <!-- Shuffle Options -->
              <div
                class="p-4 rounded-[12px]"
                style="
                  background: var(--color-surface-50);
                  border: 1px solid var(--color-border);
                "
              >
                <label
                  class="block text-[14px] font-semibold mb-3"
                  style="color: var(--color-text-primary)"
                  >Pengaturan Acak</label
                >

                <div class="space-y-3">
                  <!-- Shuffle Questions Toggle -->
                  <label
                    class="flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <span
                        class="text-[14px]"
                        style="color: var(--color-text-primary)"
                        >Acak Urutan Soal</span
                      >
                      <p
                        class="text-[12px]"
                        style="color: var(--color-text-tertiary)"
                      >
                        Urutan soal akan diacak untuk setiap peserta
                      </p>
                    </div>
                    <button
                      type="button"
                      :disabled="!hasActivePelaksanaan"
                      class="relative w-11 h-6 rounded-full transition-colors duration-200"
                      :style="{
                        background: form.shuffleQuestions
                          ? 'var(--color-primary-600)'
                          : 'var(--color-surface-300)',
                        cursor: !hasActivePelaksanaan
                          ? 'not-allowed'
                          : 'pointer',
                        opacity: !hasActivePelaksanaan ? '0.6' : '1',
                      }"
                      @click="
                        hasActivePelaksanaan &&
                        (form.shuffleQuestions = !form.shuffleQuestions)
                      "
                    >
                      <span
                        class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                        :style="{
                          transform: form.shuffleQuestions
                            ? 'translateX(20px)'
                            : 'translateX(0)',
                        }"
                      ></span>
                    </button>
                  </label>

                  <!-- Shuffle Options Toggle -->
                  <label
                    class="flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <span
                        class="text-[14px]"
                        style="color: var(--color-text-primary)"
                        >Acak Urutan Opsi Jawaban</span
                      >
                      <p
                        class="text-[12px]"
                        style="color: var(--color-text-tertiary)"
                      >
                        Urutan opsi A-E akan diacak untuk setiap peserta
                      </p>
                    </div>
                    <button
                      type="button"
                      :disabled="!hasActivePelaksanaan"
                      class="relative w-11 h-6 rounded-full transition-colors duration-200"
                      :style="{
                        background: form.shuffleOptions
                          ? 'var(--color-primary-600)'
                          : 'var(--color-surface-300)',
                        cursor: !hasActivePelaksanaan
                          ? 'not-allowed'
                          : 'pointer',
                        opacity: !hasActivePelaksanaan ? '0.6' : '1',
                      }"
                      @click="
                        hasActivePelaksanaan &&
                        (form.shuffleOptions = !form.shuffleOptions)
                      "
                    >
                      <span
                        class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                        :style="{
                          transform: form.shuffleOptions
                            ? 'translateX(20px)'
                            : 'translateX(0)',
                        }"
                      ></span>
                    </button>
                  </label>
                </div>
              </div>
            </form>
          </div>

          <!-- Footer -->
          <div
            class="px-6 py-4 flex items-center justify-end gap-3"
            style="
              border-top: 2px solid var(--color-border);
              background: var(--color-surface-50);
            "
          >
            <button
              type="button"
              class="px-4.5 py-2.5 text-[14px] font-semibold rounded-[8px] transition-colors hover:bg-[var(--color-surface-100)]"
              style="
                background: var(--color-surface-0);
                border: 2px solid var(--color-border);
                color: var(--color-text-secondary);
              "
              @click="handleClose"
            >
              Batal
            </button>
            <button
              type="button"
              :disabled="!hasActivePelaksanaan || !isFormValid"
              class="px-4.5 py-2.5 text-[14px] font-semibold text-white rounded-[8px] transition-all duration-200"
              :style="{
                background:
                  !hasActivePelaksanaan || !isFormValid
                    ? 'var(--color-surface-300)'
                    : 'var(--color-primary-600)',
                boxShadow:
                  !hasActivePelaksanaan || !isFormValid
                    ? 'none'
                    : '0 2px 8px rgba(37, 99, 235, 0.3)',
                cursor:
                  !hasActivePelaksanaan || !isFormValid
                    ? 'not-allowed'
                    : 'pointer',
              }"
              @click="handleSubmit"
            >
              {{ isEdit ? "Simpan Perubahan" : "Buat Bank Soal" }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
