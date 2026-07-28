import { defineStore } from "pinia";
import { ref, computed } from "vue";

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string;
}

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(null);
  const token = ref<string | null>(null);

  const isAuthenticated = computed(() => !!token.value);

  function setAuth(userData: User, accessToken: string) {
    user.value = userData;
    token.value = accessToken;
  }

  function clearAuth() {
    user.value = null;
    token.value = null;
  }

  return {
    user,
    token,
    isAuthenticated,
    setAuth,
    clearAuth,
  };
});
