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

// Setelah ada deploy baru, file halaman versi lama sudah tidak ada di server.
// Tab yang masih terbuka gagal membuka menu (tidak terjadi apa-apa saat diklik).
// Solusinya: muat ulang halaman sekali ke menu tujuan supaya memakai versi terbaru.
function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Unable to preload CSS/i.test(
    msg,
  );
}

function muatUlangSekali(tujuan: string) {
  const KUNCI = "muat-ulang-versi-baru";
  try {
    const terakhir = Number(sessionStorage.getItem(KUNCI) || 0);
    if (Date.now() - terakhir < 10_000) return; // cegah reload berulang
    sessionStorage.setItem(KUNCI, String(Date.now()));
  } catch {
    // sessionStorage tidak tersedia: tetap muat ulang
  }
  window.location.assign(tujuan);
}

router.onError((err, to) => {
  if (isChunkLoadError(err)) muatUlangSekali(to.fullPath);
});

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  muatUlangSekali(window.location.href);
});

export default router;
