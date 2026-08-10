<script setup lang="ts">
import { ref, computed } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import AppSidebar from "@/components/layout/AppSidebar.vue";
import AppTopBar from "@/components/layout/AppTopBar.vue";

const route = useRoute();
const authStore = useAuthStore();

const mobileMenuOpen = ref(false);

const pageTitle = computed(() => {
  if (route.meta?.title) return route.meta.title as string;

  // Derive from route path
  const path = route.path;
  if (path === "/") return "Dashboard";

  const titleMap: Record<string, string> = {
    "/cbt/pelaksanaan-ujian": "Pelaksanaan Ujian",
    "/cbt/sessions": "Sesi Ujian",
    "/cbt/bank-soal": "Bank Soal",
    "/cbt/siswa-accounts": "Akun Siswa",
    "/cbt/config": "Konfigurasi",
    "/cbt/notifications": "Notifikasi",
    "/cbt/proctor": "Proctor Dashboard",
    "/cbt/report": "Laporan Ujian",
  };

  // Exact match first
  if (titleMap[path]) return titleMap[path];

  // Prefix match for nested routes (like /cbt/proctor/:id)
  const matchedKey = Object.keys(titleMap).find(
    (key) => path.startsWith(key + "/") || path === key,
  );
  if (matchedKey) return titleMap[matchedKey];

  // Fallback: capitalize first path segment
  const segment = path.split("/").filter(Boolean).pop() || "";
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
});

// Get school name from user's tenantId info if available
const schoolName = computed(() => {
  // For now, we'll show the user's role context
  // In production, this would come from tenant API
  return authStore.user?.tenantId ? "CBT Admin" : "";
});
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-surface-warm">
    <!-- Mobile overlay backdrop -->
    <div
      v-if="mobileMenuOpen"
      class="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
      @click="mobileMenuOpen = false"
    />

    <!-- Sidebar (fixed on desktop, drawer on mobile) -->
    <div
      :class="[
        'fixed lg:static inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out',
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      ]"
    >
      <AppSidebar
        @navigate="mobileMenuOpen = false"
        @toggle-mobile-menu="mobileMenuOpen = false"
      />
    </div>

    <!-- Main content area -->
    <div class="flex-1 flex flex-col overflow-hidden min-w-0">
      <AppTopBar
        :title="pageTitle"
        :school-name="schoolName"
        @toggle-mobile-menu="mobileMenuOpen = !mobileMenuOpen"
      />

      <!-- Page content with scrollable area and custom scrollbar -->
      <main class="flex-1 overflow-y-auto scrollbar-custom">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
/* Custom scrollbar for content area */
.scrollbar-custom {
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.15) transparent;
}

.scrollbar-custom::-webkit-scrollbar {
  width: 8px;
}

.scrollbar-custom::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-custom::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.15);
  border-radius: 9999px;
}

.scrollbar-custom::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.25);
}
</style>
