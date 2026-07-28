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
  <div class="flex h-screen" style="background: #fafaf8">
    <!-- Sidebar -->
    <aside class="flex w-60 flex-col" style="background: #1e293b">
      <!-- Logo -->
      <div class="flex h-16 items-center gap-2 px-5 shrink-0">
        <span class="text-base font-bold text-indigo-400">CBT</span>
        <span class="text-sm text-slate-300">Teman Sekolah</span>
      </div>

      <!-- Nav -->
      <nav class="flex-1 overflow-y-auto py-2 space-y-0.5">
        <!-- Dashboard -->
        <RouterLink
          to="/"
          class="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          active-class="bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-400 rounded-l-none"
          exact-active-class="bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-400 rounded-l-none"
        >
          <svg
            class="w-4 h-4 shrink-0"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          Dashboard
        </RouterLink>

        <!-- Pelaksanaan Ujian -->
        <RouterLink
          to="/cbt/pelaksanaan-ujian"
          class="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          active-class="bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-400 rounded-l-none"
        >
          <svg
            class="w-4 h-4 shrink-0"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          Pelaksanaan Ujian
        </RouterLink>

        <!-- Sesi Ujian -->
        <RouterLink
          to="/cbt/sessions"
          class="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          active-class="bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-400 rounded-l-none"
        >
          <svg
            class="w-4 h-4 shrink-0"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
            />
          </svg>
          Sesi Ujian
        </RouterLink>

        <!-- Bank Soal -->
        <RouterLink
          to="/cbt/bank-soal"
          class="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          active-class="bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-400 rounded-l-none"
        >
          <svg
            class="w-4 h-4 shrink-0"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          Bank Soal
        </RouterLink>

        <!-- Akun Siswa -->
        <RouterLink
          to="/cbt/siswa-accounts"
          class="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          active-class="bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-400 rounded-l-none"
        >
          <svg
            class="w-4 h-4 shrink-0"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          Akun Siswa
        </RouterLink>

        <!-- Konfigurasi -->
        <RouterLink
          to="/cbt/config"
          class="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          active-class="bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-400 rounded-l-none"
        >
          <svg
            class="w-4 h-4 shrink-0"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Konfigurasi
        </RouterLink>

        <!-- Notifikasi -->
        <RouterLink
          to="/cbt/notifications"
          class="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          active-class="bg-indigo-500/10 text-indigo-400 border-l-2 border-indigo-400 rounded-l-none"
        >
          <svg
            class="w-4 h-4 shrink-0"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          Notifikasi
        </RouterLink>
      </nav>

      <!-- Bottom label -->
      <div class="shrink-0 border-t border-white/10 px-6 py-4">
        <p class="text-xs text-slate-500">Admin</p>
      </div>
    </aside>

    <!-- Main content -->
    <main class="flex-1 overflow-auto" style="background: #fafaf8">
      <RouterView />
    </main>
  </div>
</template>
