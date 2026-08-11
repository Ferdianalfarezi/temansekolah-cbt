<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import ImageUpload from "./ImageUpload.vue";

export interface Soal {
  id: string;
  teksSoal: string;
  opsiA: string;
  opsiB: string;
  opsiC: string;
  opsiD: string;
  opsiE: string | null;
  jawabanBenar: "A" | "B" | "C" | "D" | "E";
  gambarSoalUrl: string | null;
  gambarAUrl: string | null;
  gambarBUrl: string | null;
  gambarCUrl: string | null;
  gambarDUrl: string | null;
  gambarEUrl: string | null;
}

interface Props {
  show: boolean;
  isEdit?: boolean;
  soal?: Soal | null;
}

const props = withDefaults(defineProps<Props>(), {
  isEdit: false,
  soal: null,
});

const emit = defineEmits<{
  close: [];
  submit: [data: SoalFormData];
}>();

export interface SoalFormData {
  teksSoal: string;
  opsiA: string;
  opsiB: string;
  opsiC: string;
  opsiD: string;
  opsiE: string;
  jawabanBenar: "A" | "B" | "C" | "D" | "E";
  gambarSoalUrl: string;
  gambarAUrl: string;
  gambarBUrl: string;
  gambarCUrl: string;
  gambarDUrl: string;
  gambarEUrl: string;
}

// Jawaban options
const jawabanOptions: Array<"A" | "B" | "C" | "D" | "E"> = [
  "A",
  "B",
  "C",
  "D",
  "E",
];

// Form state
const form = ref<SoalFormData>({
  teksSoal: "",
  opsiA: "",
  opsiB: "",
  opsiC: "",
  opsiD: "",
  opsiE: "",
  jawabanBenar: "A",
  gambarSoalUrl: "",
  gambarAUrl: "",
  gambarBUrl: "",
  gambarCUrl: "",
  gambarDUrl: "",
  gambarEUrl: "",
});

// Validation errors
const errors = ref<Partial<Record<keyof SoalFormData, string>>>({});

// Show advanced options (gambar URLs)
const showGambarOptions = ref(false);

// Computed: is opsi E empty (for disabling jawaban=E)
const isOpsiEEmpty = computed(() => form.value.opsiE.trim() === "");

// Computed: form valid
const isFormValid = computed(() => {
  const teksSoalLen = form.value.teksSoal.trim().length;
  const opsiALen = form.value.opsiA.trim().length;
  const opsiBLen = form.value.opsiB.trim().length;
  const opsiCLen = form.value.opsiC.trim().length;
  const opsiDLen = form.value.opsiD.trim().length;
  const opsiELen = form.value.opsiE.trim().length;

  // Basic required field validation
  if (teksSoalLen < 1 || teksSoalLen > 2000) return false;
  if (opsiALen < 1 || opsiALen > 500) return false;
  if (opsiBLen < 1 || opsiBLen > 500) return false;
  if (opsiCLen < 1 || opsiCLen > 500) return false;
  if (opsiDLen < 1 || opsiDLen > 500) return false;

  // Opsi E validation (optional, but if provided must be 1-500)
  if (opsiELen > 0 && opsiELen > 500) return false;

  // Jawaban E requires opsi E
  if (form.value.jawabanBenar === "E" && opsiELen < 1) return false;

  return true;
});

// Validate form
function validate(): boolean {
  errors.value = {};

  const teksSoalLen = form.value.teksSoal.trim().length;
  const opsiALen = form.value.opsiA.trim().length;
  const opsiBLen = form.value.opsiB.trim().length;
  const opsiCLen = form.value.opsiC.trim().length;
  const opsiDLen = form.value.opsiD.trim().length;
  const opsiELen = form.value.opsiE.trim().length;

  // Teks soal validation (1-2000 chars)
  if (teksSoalLen < 1) {
    errors.value.teksSoal = "Teks soal wajib diisi";
  } else if (teksSoalLen > 2000) {
    errors.value.teksSoal = "Teks soal maksimal 2000 karakter";
  }

  // Opsi A validation (1-500 chars, required)
  if (opsiALen < 1) {
    errors.value.opsiA = "Opsi A wajib diisi";
  } else if (opsiALen > 500) {
    errors.value.opsiA = "Opsi A maksimal 500 karakter";
  }

  // Opsi B validation (1-500 chars, required)
  if (opsiBLen < 1) {
    errors.value.opsiB = "Opsi B wajib diisi";
  } else if (opsiBLen > 500) {
    errors.value.opsiB = "Opsi B maksimal 500 karakter";
  }

  // Opsi C validation (1-500 chars, required)
  if (opsiCLen < 1) {
    errors.value.opsiC = "Opsi C wajib diisi";
  } else if (opsiCLen > 500) {
    errors.value.opsiC = "Opsi C maksimal 500 karakter";
  }

  // Opsi D validation (1-500 chars, required)
  if (opsiDLen < 1) {
    errors.value.opsiD = "Opsi D wajib diisi";
  } else if (opsiDLen > 500) {
    errors.value.opsiD = "Opsi D maksimal 500 karakter";
  }

  // Opsi E validation (optional, but 1-500 chars if provided)
  if (opsiELen > 500) {
    errors.value.opsiE = "Opsi E maksimal 500 karakter";
  }

  // Jawaban E requires opsi E to be filled
  if (form.value.jawabanBenar === "E" && opsiELen < 1) {
    errors.value.opsiE = "Opsi E wajib diisi jika jawaban benar adalah E";
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

// Handle jawaban change - reset to A if E is selected but opsiE becomes empty
function handleJawabanChange(jawaban: "A" | "B" | "C" | "D" | "E") {
  if (jawaban === "E" && isOpsiEEmpty.value) {
    return; // Don't allow selecting E if opsiE is empty
  }
  form.value.jawabanBenar = jawaban;
}

// Watch opsiE changes - if it becomes empty and jawaban is E, reset jawaban to A
watch(
  () => form.value.opsiE,
  (newVal) => {
    if (newVal.trim() === "" && form.value.jawabanBenar === "E") {
      form.value.jawabanBenar = "A";
    }
  },
);

// Reset form
function resetForm() {
  form.value = {
    teksSoal: "",
    opsiA: "",
    opsiB: "",
    opsiC: "",
    opsiD: "",
    opsiE: "",
    jawabanBenar: "A",
    gambarSoalUrl: "",
    gambarAUrl: "",
    gambarBUrl: "",
    gambarCUrl: "",
    gambarDUrl: "",
    gambarEUrl: "",
  };
  errors.value = {};
  showGambarOptions.value = false;
}

// Watch for soal prop changes (for edit mode)
watch(
  () => props.soal,
  (newVal) => {
    if (newVal && props.isEdit) {
      form.value = {
        teksSoal: newVal.teksSoal,
        opsiA: newVal.opsiA,
        opsiB: newVal.opsiB,
        opsiC: newVal.opsiC,
        opsiD: newVal.opsiD,
        opsiE: newVal.opsiE || "",
        jawabanBenar: newVal.jawabanBenar,
        gambarSoalUrl: newVal.gambarSoalUrl || "",
        gambarAUrl: newVal.gambarAUrl || "",
        gambarBUrl: newVal.gambarBUrl || "",
        gambarCUrl: newVal.gambarCUrl || "",
        gambarDUrl: newVal.gambarDUrl || "",
        gambarEUrl: newVal.gambarEUrl || "",
      };
      // Auto-expand gambar section if any gambar URL is provided
      if (
        newVal.gambarSoalUrl ||
        newVal.gambarAUrl ||
        newVal.gambarBUrl ||
        newVal.gambarCUrl ||
        newVal.gambarDUrl ||
        newVal.gambarEUrl
      ) {
        showGambarOptions.value = true;
      }
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
  },
);

// Character count helpers
function charCount(text: string): number {
  return text.trim().length;
}

function charCountClass(
  text: string,
  maxLen: number,
): { text: string; color: string } {
  const len = text.trim().length;
  if (len > maxLen) {
    return { text: `${len}/${maxLen}`, color: "var(--color-danger-500)" };
  }
  if (len > maxLen * 0.9) {
    return { text: `${len}/${maxLen}`, color: "var(--color-warning-500)" };
  }
  return { text: `${len}/${maxLen}`, color: "var(--color-text-tertiary)" };
}

// Handle escape key to close modal
function handleKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape" && props.show) {
    handleClose();
  }
}

onMounted(() => {
  document.addEventListener("keydown", handleKeyDown);
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleKeyDown);
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
          class="relative bg-white rounded-[16px] shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          style="box-shadow: var(--shadow-lg)"
        >
          <!-- Header -->
          <div
            class="flex items-center justify-between px-6 py-4 shrink-0"
            style="border-bottom: 2px solid var(--color-border)"
          >
            <h2
              class="text-[18px] font-bold"
              style="color: var(--color-text-primary)"
            >
              {{ isEdit ? "Edit Soal" : "Tambah Soal Baru" }}
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

          <!-- Body - Scrollable -->
          <div class="px-6 py-5 overflow-y-auto flex-1">
            <form class="space-y-5" @submit.prevent="handleSubmit">
              <!-- Teks Soal -->
              <div>
                <label
                  class="block text-[14px] font-medium mb-1.5"
                  style="color: var(--color-text-secondary)"
                >
                  Teks Soal
                  <span style="color: var(--color-danger-500)">*</span>
                </label>
                <textarea
                  v-model="form.teksSoal"
                  rows="4"
                  placeholder="Masukkan teks soal..."
                  class="block w-full px-3 py-2.5 text-[14px] rounded-[8px] outline-none transition-colors resize-none"
                  :style="{
                    border: errors.teksSoal
                      ? '2px solid var(--color-danger-500)'
                      : '2px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }"
                  @input="errors.teksSoal = undefined"
                />
                <div class="flex items-center justify-between mt-1">
                  <p
                    v-if="errors.teksSoal"
                    class="text-[13px]"
                    style="color: var(--color-danger-500)"
                  >
                    {{ errors.teksSoal }}
                  </p>
                  <span v-else />
                  <span
                    class="text-[12px]"
                    :style="{
                      color: charCountClass(form.teksSoal, 2000).color,
                    }"
                  >
                    {{ charCountClass(form.teksSoal, 2000).text }}
                  </span>
                </div>
              </div>

              <!-- Opsi Jawaban -->
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
                  Opsi Jawaban
                  <span style="color: var(--color-danger-500)">*</span>
                </label>

                <!-- Opsi A -->
                <div class="mb-3">
                  <div class="flex items-start gap-3">
                    <span
                      class="flex items-center justify-center w-7 h-7 rounded-full text-[13px] font-bold shrink-0 mt-1"
                      style="
                        background: var(--color-primary-100);
                        color: var(--color-primary-700);
                      "
                    >
                      A
                    </span>
                    <div class="flex-1">
                      <input
                        v-model="form.opsiA"
                        type="text"
                        placeholder="Opsi jawaban A"
                        class="block w-full px-3 py-2 text-[14px] rounded-[8px] outline-none transition-colors"
                        :style="{
                          border: errors.opsiA
                            ? '2px solid var(--color-danger-500)'
                            : '2px solid var(--color-border)',
                          color: 'var(--color-text-primary)',
                          background: 'white',
                        }"
                        @input="errors.opsiA = undefined"
                      />
                      <div class="flex items-center justify-between mt-0.5">
                        <p
                          v-if="errors.opsiA"
                          class="text-[12px]"
                          style="color: var(--color-danger-500)"
                        >
                          {{ errors.opsiA }}
                        </p>
                        <span v-else />
                        <span
                          class="text-[11px]"
                          :style="{
                            color: charCountClass(form.opsiA, 500).color,
                          }"
                        >
                          {{ charCountClass(form.opsiA, 500).text }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Opsi B -->
                <div class="mb-3">
                  <div class="flex items-start gap-3">
                    <span
                      class="flex items-center justify-center w-7 h-7 rounded-full text-[13px] font-bold shrink-0 mt-1"
                      style="
                        background: var(--color-primary-100);
                        color: var(--color-primary-700);
                      "
                    >
                      B
                    </span>
                    <div class="flex-1">
                      <input
                        v-model="form.opsiB"
                        type="text"
                        placeholder="Opsi jawaban B"
                        class="block w-full px-3 py-2 text-[14px] rounded-[8px] outline-none transition-colors"
                        :style="{
                          border: errors.opsiB
                            ? '2px solid var(--color-danger-500)'
                            : '2px solid var(--color-border)',
                          color: 'var(--color-text-primary)',
                          background: 'white',
                        }"
                        @input="errors.opsiB = undefined"
                      />
                      <div class="flex items-center justify-between mt-0.5">
                        <p
                          v-if="errors.opsiB"
                          class="text-[12px]"
                          style="color: var(--color-danger-500)"
                        >
                          {{ errors.opsiB }}
                        </p>
                        <span v-else />
                        <span
                          class="text-[11px]"
                          :style="{
                            color: charCountClass(form.opsiB, 500).color,
                          }"
                        >
                          {{ charCountClass(form.opsiB, 500).text }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Opsi C -->
                <div class="mb-3">
                  <div class="flex items-start gap-3">
                    <span
                      class="flex items-center justify-center w-7 h-7 rounded-full text-[13px] font-bold shrink-0 mt-1"
                      style="
                        background: var(--color-primary-100);
                        color: var(--color-primary-700);
                      "
                    >
                      C
                    </span>
                    <div class="flex-1">
                      <input
                        v-model="form.opsiC"
                        type="text"
                        placeholder="Opsi jawaban C"
                        class="block w-full px-3 py-2 text-[14px] rounded-[8px] outline-none transition-colors"
                        :style="{
                          border: errors.opsiC
                            ? '2px solid var(--color-danger-500)'
                            : '2px solid var(--color-border)',
                          color: 'var(--color-text-primary)',
                          background: 'white',
                        }"
                        @input="errors.opsiC = undefined"
                      />
                      <div class="flex items-center justify-between mt-0.5">
                        <p
                          v-if="errors.opsiC"
                          class="text-[12px]"
                          style="color: var(--color-danger-500)"
                        >
                          {{ errors.opsiC }}
                        </p>
                        <span v-else />
                        <span
                          class="text-[11px]"
                          :style="{
                            color: charCountClass(form.opsiC, 500).color,
                          }"
                        >
                          {{ charCountClass(form.opsiC, 500).text }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Opsi D -->
                <div class="mb-3">
                  <div class="flex items-start gap-3">
                    <span
                      class="flex items-center justify-center w-7 h-7 rounded-full text-[13px] font-bold shrink-0 mt-1"
                      style="
                        background: var(--color-primary-100);
                        color: var(--color-primary-700);
                      "
                    >
                      D
                    </span>
                    <div class="flex-1">
                      <input
                        v-model="form.opsiD"
                        type="text"
                        placeholder="Opsi jawaban D"
                        class="block w-full px-3 py-2 text-[14px] rounded-[8px] outline-none transition-colors"
                        :style="{
                          border: errors.opsiD
                            ? '2px solid var(--color-danger-500)'
                            : '2px solid var(--color-border)',
                          color: 'var(--color-text-primary)',
                          background: 'white',
                        }"
                        @input="errors.opsiD = undefined"
                      />
                      <div class="flex items-center justify-between mt-0.5">
                        <p
                          v-if="errors.opsiD"
                          class="text-[12px]"
                          style="color: var(--color-danger-500)"
                        >
                          {{ errors.opsiD }}
                        </p>
                        <span v-else />
                        <span
                          class="text-[11px]"
                          :style="{
                            color: charCountClass(form.opsiD, 500).color,
                          }"
                        >
                          {{ charCountClass(form.opsiD, 500).text }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Opsi E (Optional) -->
                <div>
                  <div class="flex items-start gap-3">
                    <span
                      class="flex items-center justify-center w-7 h-7 rounded-full text-[13px] font-bold shrink-0 mt-1"
                      style="
                        background: var(--color-surface-200);
                        color: var(--color-text-secondary);
                      "
                    >
                      E
                    </span>
                    <div class="flex-1">
                      <input
                        v-model="form.opsiE"
                        type="text"
                        placeholder="Opsi jawaban E (opsional)"
                        class="block w-full px-3 py-2 text-[14px] rounded-[8px] outline-none transition-colors"
                        :style="{
                          border: errors.opsiE
                            ? '2px solid var(--color-danger-500)'
                            : '2px solid var(--color-border)',
                          color: 'var(--color-text-primary)',
                          background: 'white',
                        }"
                        @input="errors.opsiE = undefined"
                      />
                      <div class="flex items-center justify-between mt-0.5">
                        <p
                          v-if="errors.opsiE"
                          class="text-[12px]"
                          style="color: var(--color-danger-500)"
                        >
                          {{ errors.opsiE }}
                        </p>
                        <span
                          v-else
                          class="text-[11px]"
                          style="color: var(--color-text-tertiary)"
                          >Opsional</span
                        >
                        <span
                          class="text-[11px]"
                          :style="{
                            color: charCountClass(form.opsiE, 500).color,
                          }"
                        >
                          {{ charCountClass(form.opsiE, 500).text }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Jawaban Benar -->
              <div>
                <label
                  class="block text-[14px] font-medium mb-2"
                  style="color: var(--color-text-secondary)"
                >
                  Jawaban Benar
                  <span style="color: var(--color-danger-500)">*</span>
                </label>
                <div class="flex items-center gap-2 flex-wrap">
                  <button
                    v-for="opt in jawabanOptions"
                    :key="opt"
                    type="button"
                    :disabled="opt === 'E' && isOpsiEEmpty"
                    class="flex items-center justify-center w-10 h-10 rounded-[8px] text-[14px] font-bold transition-all"
                    :style="{
                      border:
                        form.jawabanBenar === opt
                          ? '2px solid var(--color-primary-500)'
                          : '2px solid var(--color-border)',
                      background:
                        form.jawabanBenar === opt
                          ? 'var(--color-primary-50)'
                          : 'white',
                      color:
                        form.jawabanBenar === opt
                          ? 'var(--color-primary-700)'
                          : 'var(--color-text-secondary)',
                      opacity: opt === 'E' && isOpsiEEmpty ? '0.4' : '1',
                      cursor:
                        opt === 'E' && isOpsiEEmpty ? 'not-allowed' : 'pointer',
                    }"
                    :title="
                      opt === 'E' && isOpsiEEmpty
                        ? 'Isi opsi E terlebih dahulu untuk memilih jawaban E'
                        : `Pilih ${opt} sebagai jawaban benar`
                    "
                    @click="handleJawabanChange(opt)"
                  >
                    {{ opt }}
                  </button>
                </div>
                <p
                  v-if="isOpsiEEmpty"
                  class="mt-1.5 text-[12px]"
                  style="color: var(--color-text-tertiary)"
                >
                  Isi opsi E terlebih dahulu untuk dapat memilih E sebagai
                  jawaban benar
                </p>
              </div>

              <!-- Gambar URLs (Collapsible) -->
              <div
                class="rounded-[12px] overflow-hidden"
                style="border: 1px solid var(--color-border)"
              >
                <button
                  type="button"
                  class="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--color-surface-50)]"
                  @click="showGambarOptions = !showGambarOptions"
                >
                  <div class="flex items-center gap-2">
                    <svg
                      class="w-5 h-5"
                      style="color: var(--color-text-tertiary)"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span
                      class="text-[14px] font-medium"
                      style="color: var(--color-text-secondary)"
                    >
                      Gambar (Opsional)
                    </span>
                  </div>
                  <svg
                    :class="[
                      'w-4 h-4 transition-transform',
                      showGambarOptions ? 'rotate-180' : '',
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

                <Transition
                  enter-active-class="transition-all duration-200 ease-out"
                  enter-from-class="max-h-0 opacity-0"
                  enter-to-class="max-h-[800px] opacity-100"
                  leave-active-class="transition-all duration-150 ease-in"
                  leave-from-class="max-h-[800px] opacity-100"
                  leave-to-class="max-h-0 opacity-0"
                >
                  <div
                    v-if="showGambarOptions"
                    class="px-4 pb-4 space-y-4 overflow-hidden"
                    style="border-top: 1px solid var(--color-border)"
                  >
                    <p
                      class="text-[13px] pt-3"
                      style="color: var(--color-text-tertiary)"
                    >
                      Upload gambar untuk soal atau opsi jawaban (max 5MB per
                      gambar)
                    </p>

                    <!-- Gambar Soal -->
                    <ImageUpload
                      v-model="form.gambarSoalUrl"
                      label="Gambar Soal"
                    />

                    <!-- Gambar Opsi -->
                    <div class="grid grid-cols-2 gap-4">
                      <ImageUpload
                        v-model="form.gambarAUrl"
                        label="Gambar Opsi A"
                      />
                      <ImageUpload
                        v-model="form.gambarBUrl"
                        label="Gambar Opsi B"
                      />
                      <ImageUpload
                        v-model="form.gambarCUrl"
                        label="Gambar Opsi C"
                      />
                      <ImageUpload
                        v-model="form.gambarDUrl"
                        label="Gambar Opsi D"
                      />
                      <div class="col-span-2">
                        <ImageUpload
                          v-model="form.gambarEUrl"
                          label="Gambar Opsi E"
                        />
                      </div>
                    </div>
                  </div>
                </Transition>
              </div>
            </form>
          </div>

          <!-- Footer -->
          <div
            class="flex items-center justify-end gap-3 px-6 py-4 shrink-0"
            style="border-top: 2px solid var(--color-border)"
          >
            <button
              type="button"
              class="px-4 py-2.5 text-[14px] font-medium rounded-[8px] transition-colors"
              style="
                border: 2px solid var(--color-border);
                color: var(--color-text-secondary);
              "
              @click="handleClose"
            >
              Batal
            </button>
            <button
              type="button"
              :disabled="!isFormValid"
              class="px-5 py-2.5 text-[14px] font-semibold rounded-[8px] transition-all"
              :style="{
                background: isFormValid
                  ? 'var(--color-primary-500)'
                  : 'var(--color-surface-200)',
                color: isFormValid ? 'white' : 'var(--color-text-tertiary)',
                cursor: isFormValid ? 'pointer' : 'not-allowed',
              }"
              @click="handleSubmit"
            >
              {{ isEdit ? "Simpan Perubahan" : "Tambah Soal" }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
