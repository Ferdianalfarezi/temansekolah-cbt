<script setup lang="ts">
/**
 * ActionButton — Standardized action button for tables and inline actions.
 *
 * Color variants (consistent UX meaning):
 * - primary: View, detail, info actions (blue)
 * - warning: Edit, modify actions (amber/yellow)
 * - danger: Delete, cancel, remove actions (red)
 * - success: Approve, positive actions (green)
 * - neutral: Secondary/less important actions (gray)
 * - purple: Special/unique actions (purple)
 */

export type ActionVariant =
  "primary" | "warning" | "danger" | "success" | "neutral" | "purple";
export type ActionIcon =
  | "edit"
  | "delete"
  | "view"
  | "copy"
  | "calendar"
  | "check"
  | "x"
  | "play"
  | "pause"
  | "download"
  | "none";

withDefaults(
  defineProps<{
    variant?: ActionVariant;
    icon?: ActionIcon;
    disabled?: boolean;
    size?: "xs" | "sm";
  }>(),
  {
    variant: "primary",
    icon: "none",
    disabled: false,
    size: "xs",
  },
);

defineEmits<{
  click: [e: MouseEvent];
}>();
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    class="action-button"
    :class="[
      `action-button--${variant}`,
      `action-button--${size}`,
      { 'action-button--disabled': disabled },
    ]"
    @click="$emit('click', $event)"
  >
    <!-- Icon -->
    <svg
      v-if="icon !== 'none'"
      class="action-button__icon"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
    >
      <!-- Edit (pencil) -->
      <path
        v-if="icon === 'edit'"
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
      <!-- Delete (trash) -->
      <path
        v-if="icon === 'delete'"
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
      <!-- View (eye) -->
      <path
        v-if="icon === 'view'"
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        v-if="icon === 'view'"
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
      <!-- Copy (document-duplicate) -->
      <path
        v-if="icon === 'copy'"
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
      <!-- Calendar -->
      <path
        v-if="icon === 'calendar'"
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
      <!-- Check -->
      <path
        v-if="icon === 'check'"
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M5 13l4 4L19 7"
      />
      <!-- X (close) -->
      <path
        v-if="icon === 'x'"
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
      <!-- Play -->
      <path
        v-if="icon === 'play'"
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
      />
      <!-- Pause -->
      <path
        v-if="icon === 'pause'"
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M15.75 5.25v13.5m-7.5-13.5v13.5"
      />
      <!-- Download -->
      <path
        v-if="icon === 'download'"
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>

    <!-- Label -->
    <slot />
  </button>
</template>

<style scoped>
.action-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: all 150ms ease;
  white-space: nowrap;
}

.action-button--sm {
  padding: 10px 16px;
  font-size: 14px;
}

/* Primary (blue) */
.action-button--primary {
  background: #4f46e5;
  color: white;
}
.action-button--primary:hover:not(.action-button--disabled) {
  background: #4338ca;
}

/* Neutral (gray) */
.action-button--neutral {
  background: #f5f5f4;
  color: #57534e;
  border: 1px solid #e7e5e4;
}
.action-button--neutral:hover:not(.action-button--disabled) {
  background: #e7e5e4;
  color: #44403c;
}

/* Warning (amber) */
.action-button--warning {
  background: #f59e0b;
  color: white;
}
.action-button--warning:hover:not(.action-button--disabled) {
  background: #d97706;
}

/* Danger (red) */
.action-button--danger {
  background: #ef4444;
  color: white;
}
.action-button--danger:hover:not(.action-button--disabled) {
  background: #dc2626;
}

/* Success (green) */
.action-button--success {
  background: #22c55e;
  color: white;
}
.action-button--success:hover:not(.action-button--disabled) {
  background: #16a34a;
}

/* Purple */
.action-button--purple {
  background: #9333ea;
  color: white;
}
.action-button--purple:hover:not(.action-button--disabled) {
  background: #7e22ce;
}

/* Disabled */
.action-button--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Icon */
.action-button__icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.action-button--sm .action-button__icon {
  width: 16px;
  height: 16px;
}
</style>
