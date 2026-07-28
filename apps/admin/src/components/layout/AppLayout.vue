<script setup lang="ts">
import { RouterView, RouterLink } from "vue-router";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/cbt/pelaksanaan-ujian", label: "Pelaksanaan Ujian" },
  { to: "/cbt/sessions", label: "Sesi Ujian" },
  { to: "/cbt/bank-soal", label: "Bank Soal" },
  { to: "/cbt/siswa-accounts", label: "Akun Siswa" },
  { to: "/cbt/config", label: "Konfigurasi" },
  { to: "/cbt/notifications", label: "Notifikasi" },
];
</script>

<template>
  <div class="flex h-screen bg-gray-50">
    <!-- Sidebar -->
    <aside class="w-64 border-r border-gray-200 bg-white">
      <div class="flex h-16 items-center px-6">
        <span class="text-lg font-bold text-gray-900">CBT Admin</span>
      </div>
      <nav class="mt-4 px-4 space-y-1">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          active-class="bg-blue-50 text-blue-700"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </aside>

    <!-- Main content -->
    <main class="flex-1 overflow-auto">
      <RouterView />
    </main>
  </div>
</template>
