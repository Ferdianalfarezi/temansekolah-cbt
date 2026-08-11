<script setup lang="ts">
import { ref, computed } from "vue";
import { uploadSoalImage } from "@/api/bank-soal";

interface Props {
  modelValue: string;
  label: string;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const uploading = ref(false);
const error = ref("");
const fileInput = ref<HTMLInputElement | null>(null);

// Preview URL (either from modelValue or local blob)
const previewUrl = computed(() => props.modelValue);

const hasImage = computed(() => !!props.modelValue);

function triggerFileInput() {
  if (props.disabled || uploading.value) return;
  fileInput.value?.click();
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    error.value = "Format tidak valid. Gunakan JPEG, PNG, atau WebP.";
    return;
  }

  // Validate file size (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    error.value = "Ukuran file maksimum 5 MB.";
    return;
  }

  error.value = "";
  uploading.value = true;

  try {
    const res = await uploadSoalImage(file);
    emit("update:modelValue", res.data.url);
  } catch (e: any) {
    error.value =
      e.response?.data?.message || "Gagal mengupload gambar. Coba lagi.";
  } finally {
    uploading.value = false;
    // Reset input so same file can be selected again
    input.value = "";
  }
}

function removeImage() {
  emit("update:modelValue", "");
}
</script>

<template>
  <div class="space-y-1.5">
    <label
      class="block text-[13px] font-medium"
      style="color: var(--color-text-secondary)"
    >
      {{ label }}
    </label>

    <!-- Upload area -->
    <div
      v-if="!hasImage"
      class="relative border-2 border-dashed rounded-[8px] p-4 text-center cursor-pointer transition-colors"
      :class="{
        'opacity-50 cursor-not-allowed': disabled,
        'hover:border-[var(--color-primary-400)] hover:bg-[var(--color-primary-50)]':
          !disabled && !uploading,
      }"
      :style="{
        borderColor: error ? 'var(--color-danger-400)' : 'var(--color-border)',
        background: error ? 'var(--color-danger-50)' : 'transparent',
      }"
      @click="triggerFileInput"
    >
      <input
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        class="hidden"
        :disabled="disabled || uploading"
        @change="handleFileChange"
      />

      <!-- Loading state -->
      <div v-if="uploading" class="flex flex-col items-center gap-2 py-2">
        <div
          class="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
          style="
            border-color: var(--color-primary-500);
            border-top-color: transparent;
          "
        />
        <span class="text-[12px]" style="color: var(--color-text-tertiary)">
          Mengupload...
        </span>
      </div>

      <!-- Default state -->
      <div v-else class="flex flex-col items-center gap-2 py-2">
        <svg
          class="w-8 h-8"
          style="color: var(--color-text-tertiary)"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <span class="text-[12px]" style="color: var(--color-text-tertiary)">
          Klik untuk upload gambar
        </span>
        <span class="text-[11px]" style="color: var(--color-text-quaternary)">
          JPEG, PNG, WebP (max 5MB)
        </span>
      </div>
    </div>

    <!-- Preview with remove button -->
    <div v-else class="relative inline-block">
      <img
        :src="previewUrl"
        alt="Preview"
        class="max-w-full max-h-[120px] rounded-[8px] border"
        style="border-color: var(--color-border)"
      />
      <button
        v-if="!disabled"
        type="button"
        class="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center shadow-md transition-colors"
        style="background: var(--color-danger-500); color: white"
        title="Hapus gambar"
        @click="removeImage"
      >
        <svg
          class="w-4 h-4"
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

    <!-- Error message -->
    <p v-if="error" class="text-[12px]" style="color: var(--color-danger-500)">
      {{ error }}
    </p>
  </div>
</template>
