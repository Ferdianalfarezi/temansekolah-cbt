import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      component: () => import("@/components/layout/AppLayout.vue"),
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
          component: () => import("@/views/cbt/BankSoalView.vue"),
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

export default router;
