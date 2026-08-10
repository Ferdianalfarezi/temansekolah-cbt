<script setup lang="ts">
import { ref, watch } from "vue";

interface Props {
  title: string;
  schoolName?: string;
  logoUrl?: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "toggleMobileMenu"): void;
}>();

// Local ref so @error can clear it without mutating the prop
const resolvedLogoUrl = ref<string | null>(props.logoUrl ?? null);
watch(
  () => props.logoUrl,
  (val) => {
    resolvedLogoUrl.value = val ?? null;
  },
);
function handleLogoError() {
  resolvedLogoUrl.value = null;
}
</script>

<template>
  <header
    class="flex items-center justify-between px-6 shrink-0"
    style="
      height: 70px;
      background: linear-gradient(
        135deg,
        var(--color-primary-600) 0%,
        var(--color-primary-700) 100%
      );
    "
  >
    <!-- Left side: hamburger (mobile) + page title -->
    <div class="flex items-center gap-3">
      <!-- Mobile hamburger button -->
      <button
        class="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors duration-200"
        aria-label="Toggle menu"
        @click="emit('toggleMobileMenu')"
      >
        <svg
          class="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      <span class="hidden lg:block w-px h-5 bg-white/25"></span>

      <!-- Page title -->
      <h1
        class="text-white font-bold"
        style="font-size: 20px; font-weight: 700"
      >
        {{ title }}
      </h1>
    </div>

    <!-- Right side: school logo + name -->
    <div
      v-if="schoolName"
      class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-sm"
      style="
        background: rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(8px);
        border-radius: 8px;
        font-size: 14px;
      "
    >
      <!-- School logo (32x32 rounded) with fallback to /logo.png -->
      <img
        v-if="resolvedLogoUrl"
        :src="resolvedLogoUrl"
        :alt="schoolName"
        class="w-8 h-8 rounded-full object-cover shrink-0"
        @error="handleLogoError"
      />
      <img
        v-else
        src="/logo.png"
        alt="CBT Teman Sekolah"
        class="w-8 h-8 rounded-full shrink-0"
      />
      <span class="truncate max-w-50">{{ schoolName }}</span>
    </div>
  </header>
</template>
