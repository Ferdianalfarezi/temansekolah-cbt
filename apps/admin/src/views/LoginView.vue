<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const email = ref("");
const password = ref("");
const isLoading = ref(false);
const error = ref("");

onMounted(() => {
  // If already authenticated, redirect to dashboard
  if (authStore.isAuthenticated) {
    router.replace("/");
  }
});

async function handleLogin() {
  if (!email.value || !password.value) {
    error.value = "Email dan password harus diisi";
    return;
  }

  isLoading.value = true;
  error.value = "";

  try {
    await authStore.login(email.value, password.value);

    // Redirect to intended page or dashboard
    const redirect = (route.query.redirect as string) || "/";
    router.replace(redirect);
  } catch (err: any) {
    error.value =
      err.response?.data?.message ||
      "Login gagal. Periksa email dan password Anda.";
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div
    class="min-h-screen flex items-center justify-center"
    style="background: var(--color-surface-warm)"
  >
    <div class="w-full max-w-md px-6">
      <!-- Logo & Title -->
      <div class="text-center mb-8">
        <div class="flex items-center justify-center gap-3 mb-4">
          <div
            class="w-14 h-14 rounded-xl flex items-center justify-center"
            style="background: var(--color-teal-dark)"
          >
            <img
              src="/logo.png"
              alt="CBT Teman Sekolah"
              class="w-8 h-8 object-contain"
            />
          </div>
        </div>
        <h1
          class="text-xl font-semibold"
          style="color: var(--color-text-primary)"
        >
          CBT Admin Login
        </h1>
        <p class="text-sm mt-1" style="color: var(--color-text-secondary)">
          Masuk untuk mengelola ujian berbasis komputer
        </p>
      </div>

      <!-- Login Form -->
      <div
        class="rounded-xl p-6"
        style="
          background: var(--color-surface-0);
          box-shadow: var(--shadow-md);
          border: 1px solid var(--color-border);
        "
      >
        <form @submit.prevent="handleLogin" class="space-y-4">
          <!-- Error Alert -->
          <div
            v-if="error"
            class="px-4 py-3 rounded-lg text-sm"
            style="
              background: var(--color-danger-50);
              border: 1px solid var(--color-danger-500);
              color: var(--color-danger-700);
            "
          >
            {{ error }}
          </div>

          <!-- Email -->
          <div>
            <label
              for="email"
              class="block text-sm font-medium mb-1"
              style="color: var(--color-text-secondary)"
            >
              Email
            </label>
            <input
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              required
              class="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2"
              style="
                border: 1px solid var(--color-border);
                color: var(--color-text-primary);
              "
              placeholder="admin@sekolah.sch.id"
            />
          </div>

          <!-- Password -->
          <div>
            <label
              for="password"
              class="block text-sm font-medium mb-1"
              style="color: var(--color-text-secondary)"
            >
              Password
            </label>
            <input
              id="password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              required
              class="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2"
              style="
                border: 1px solid var(--color-border);
                color: var(--color-text-primary);
              "
              placeholder="••••••••"
            />
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="isLoading"
            class="w-full py-2.5 px-4 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style="background: var(--color-primary-600)"
          >
            <span
              v-if="isLoading"
              class="flex items-center justify-center gap-2"
            >
              <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                  fill="none"
                />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Memproses...
            </span>
            <span v-else>Masuk</span>
          </button>
        </form>

        <!-- Divider -->
        <div class="relative my-6">
          <div class="absolute inset-0 flex items-center">
            <div
              class="w-full border-t"
              style="border-color: var(--color-border)"
            ></div>
          </div>
          <div class="relative flex justify-center text-xs">
            <span
              class="px-2"
              style="
                background: var(--color-surface-0);
                color: var(--color-text-tertiary);
              "
              >atau</span
            >
          </div>
        </div>

        <!-- LMS Login Link -->
        <div class="text-center">
          <p class="text-sm" style="color: var(--color-text-secondary)">
            Sudah login di LMS Admin?
          </p>
          <a
            href="https://admin.teman-sekolah.com"
            class="inline-flex items-center gap-1 text-sm mt-1"
            style="color: var(--color-primary-600)"
          >
            Buka LMS Admin
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </div>
      </div>

      <!-- Footer -->
      <p
        class="text-center text-xs mt-6"
        style="color: var(--color-text-tertiary)"
      >
        &copy; {{ new Date().getFullYear() }} Teman Sekolah. All rights
        reserved.
      </p>
    </div>
  </div>
</template>
