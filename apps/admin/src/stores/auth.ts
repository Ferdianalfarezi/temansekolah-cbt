import { defineStore } from "pinia";
import { ref, computed } from "vue";
import api from "@/api/cbt";

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string;
}

const TOKEN_KEY = "cbt_admin_token";
const USER_KEY = "cbt_admin_user";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(loadUserFromStorage());
  const token = ref<string | null>(loadTokenFromStorage());

  const isAuthenticated = computed(() => !!token.value);

  function loadTokenFromStorage(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  function loadUserFromStorage(): User | null {
    const stored = localStorage.getItem(USER_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as User;
    } catch {
      return null;
    }
  }

  /**
   * Initialize auth from URL token (SSO from LMS) or localStorage.
   * Call this on app startup.
   */
  function initializeAuth(): boolean {
    // Check for token in URL (SSO from LMS)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get("token");

    if (urlToken) {
      // Save token from URL and clean up the URL
      setToken(urlToken);

      // Remove token from URL without page reload
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);

      // Decode JWT to get user info (basic decode, no verification - backend will verify)
      try {
        const payload = JSON.parse(atob(urlToken.split(".")[1]));
        const userData: User = {
          id: payload.sub,
          name: payload.name || "User",
          email: payload.email || "",
          role: payload.role,
          tenantId: payload.tenantId || payload.tenant_id,
        };
        setUser(userData);
      } catch {
        // Token decode failed - clear and require login
        clearAuth();
        return false;
      }

      return true;
    }

    // Check localStorage
    const storedToken = loadTokenFromStorage();
    if (storedToken) {
      token.value = storedToken;
      user.value = loadUserFromStorage();
      return true;
    }

    return false;
  }

  function setToken(accessToken: string) {
    token.value = accessToken;
    localStorage.setItem(TOKEN_KEY, accessToken);
  }

  function setUser(userData: User) {
    user.value = userData;
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
  }

  function setAuth(userData: User, accessToken: string) {
    setToken(accessToken);
    setUser(userData);
  }

  function clearAuth() {
    user.value = null;
    token.value = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  /**
   * Login with email and password.
   * Uses LMS API for authentication (shared JWT secret).
   */
  async function login(email: string, password: string): Promise<void> {
    // Call LMS auth endpoint - CBT backend uses same JWT secret
    const lmsApiUrl =
      import.meta.env.VITE_LMS_API_URL ||
      "https://api.teman-sekolah.com/api/v1";

    const response = await fetch(`${lmsApiUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        platform: "admin_panel",
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw { response: { data: error } };
    }

    const data = await response.json();

    // Handle snake_case or camelCase response
    const accessToken = data.access_token || data.accessToken;
    const userData: User = {
      id: data.user?.id,
      name: data.user?.name,
      email: data.user?.email,
      role: data.user?.role,
      tenantId: data.user?.tenant_id || data.user?.tenantId,
    };

    setAuth(userData, accessToken);
  }

  function logout() {
    clearAuth();
  }

  return {
    user,
    token,
    isAuthenticated,
    initializeAuth,
    setAuth,
    clearAuth,
    login,
    logout,
  };
});
