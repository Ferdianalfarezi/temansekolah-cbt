import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/login",
      name: "login",
      component: () => import("@/views/LoginView.vue"),
      meta: { requiresAuth: false },
    },
    {
      path: "/",
      component: () => import("@/components/layout/AppLayout.vue"),
      meta: { requiresAuth: true },
      children: [
        {
          path: "",
          name: "dashboard",
          component: () => import("@/views/DashboardView.vue"),
        },
        // ─── CBT Routes ─────────────────────────────────────────
        {
          path: "cbt/pelaksanaan-ujian",
          name: "cbt-pelaksanaan-ujian",
          component: () => import("@/views/cbt/PelaksanaanUjianView.vue"),
        },
        {
          path: "cbt/sessions",
          name: "cbt-sessions",
          component: () => import("@/views/cbt/ExamSessionListView.vue"),
        },
        {
          path: "cbt/bank-soal",
          name: "cbt-bank-soal",
          component: () => import("@/views/cbt/BankSoalListView.vue"),
        },
        {
          path: "cbt/bank-soal/:id",
          name: "cbt-bank-soal-detail",
          component: () => import("@/views/cbt/BankSoalDetailView.vue"),
        },
        {
          path: "cbt/siswa-accounts",
          name: "cbt-siswa-accounts",
          component: () => import("@/views/cbt/SiswaAccountView.vue"),
        },
        {
          path: "cbt/config",
          name: "cbt-config",
          component: () => import("@/views/cbt/CbtConfigView.vue"),
        },
        {
          path: "cbt/notifications",
          name: "cbt-notifications",
          component: () => import("@/views/cbt/NotificationCenterView.vue"),
        },
        {
          path: "cbt/proctor/:id",
          name: "cbt-proctor",
          component: () => import("@/views/cbt/ProctorDashboardView.vue"),
        },
        {
          path: "cbt/report/:id",
          name: "cbt-report",
          component: () => import("@/views/cbt/PostExamReportView.vue"),
        },
      ],
    },
  ],
});

// Navigation guard for authentication
router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore();

  // Initialize auth on first navigation (handles token from URL)
  if (!authStore.isAuthenticated) {
    authStore.initializeAuth();
  }

  const requiresAuth = to.matched.some(
    (record) => record.meta.requiresAuth !== false,
  );

  if (requiresAuth && !authStore.isAuthenticated) {
    // Redirect to login with return URL
    next({
      path: "/login",
      query: { redirect: to.fullPath },
    });
  } else if (to.path === "/login" && authStore.isAuthenticated) {
    // Already logged in, redirect to dashboard
    next("/");
  } else {
    next();
  }
});

export default router;
