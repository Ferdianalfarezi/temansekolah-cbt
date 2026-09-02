<script setup lang="ts">
/**
 * RichTextEditor — TipTap-based rich text editor for question text.
 *
 * Features:
 * - Bold, Italic, Underline formatting
 * - Bullet and Numbered lists
 * - Placeholder text support
 * - v-model binding with HTML output
 * - Character count display
 * - Error state styling
 */
import { ref, watch, onBeforeUnmount } from "vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";

interface Props {
  modelValue: string;
  placeholder?: string;
  maxLength?: number;
  error?: string;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: "Masukkan teks...",
  maxLength: 10000,
  error: "",
  disabled: false,
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

// Character count (strip HTML tags for counting)
const charCount = ref(0);

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
}

function updateCharCount(html: string) {
  charCount.value = stripHtml(html).length;
}

// Initialize TipTap editor
const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit.configure({
      // Disable heading since we don't need it for question text
      heading: false,
      // Keep basic formatting
      bold: {},
      italic: {},
      bulletList: {},
      orderedList: {},
      listItem: {},
      paragraph: {},
      // Disable code blocks for simplicity
      code: false,
      codeBlock: false,
    }),
    Underline,
    Placeholder.configure({
      placeholder: props.placeholder,
    }),
  ],
  editable: !props.disabled,
  onUpdate: ({ editor }) => {
    const html = editor.getHTML();
    updateCharCount(html);
    emit("update:modelValue", html);
  },
  onCreate: ({ editor }) => {
    updateCharCount(editor.getHTML());
  },
});

// Watch for external modelValue changes
watch(
  () => props.modelValue,
  (newValue) => {
    if (editor.value && editor.value.getHTML() !== newValue) {
      editor.value.commands.setContent(newValue, { emitUpdate: false });
      updateCharCount(newValue);
    }
  },
);

// Watch for disabled changes
watch(
  () => props.disabled,
  (disabled) => {
    editor.value?.setEditable(!disabled);
  },
);

// Cleanup
onBeforeUnmount(() => {
  editor.value?.destroy();
});

// Toolbar button helper
function isActive(type: string, attrs?: Record<string, unknown>): boolean {
  return editor.value?.isActive(type, attrs) ?? false;
}

function toggleBold() {
  editor.value?.chain().focus().toggleBold().run();
}

function toggleItalic() {
  editor.value?.chain().focus().toggleItalic().run();
}

function toggleUnderline() {
  editor.value?.chain().focus().toggleUnderline().run();
}

function toggleBulletList() {
  editor.value?.chain().focus().toggleBulletList().run();
}

function toggleOrderedList() {
  editor.value?.chain().focus().toggleOrderedList().run();
}

// Character count color
function getCharCountColor(): string {
  if (charCount.value > props.maxLength) {
    return "var(--color-danger-500)";
  }
  if (charCount.value > props.maxLength * 0.9) {
    return "var(--color-warning-500)";
  }
  return "var(--color-text-tertiary)";
}
</script>

<template>
  <div class="rich-text-editor" :class="{ 'rich-text-editor--error': error }">
    <!-- Toolbar -->
    <div class="rich-text-editor__toolbar">
      <button
        type="button"
        class="toolbar-btn"
        :class="{ 'toolbar-btn--active': isActive('bold') }"
        title="Bold (Ctrl+B)"
        :disabled="disabled"
        @click="toggleBold"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"
          />
        </svg>
      </button>

      <button
        type="button"
        class="toolbar-btn"
        :class="{ 'toolbar-btn--active': isActive('italic') }"
        title="Italic (Ctrl+I)"
        :disabled="disabled"
        @click="toggleItalic"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z" />
        </svg>
      </button>

      <button
        type="button"
        class="toolbar-btn"
        :class="{ 'toolbar-btn--active': isActive('underline') }"
        title="Underline (Ctrl+U)"
        :disabled="disabled"
        @click="toggleUnderline"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"
          />
        </svg>
      </button>

      <span class="toolbar-divider" />

      <button
        type="button"
        class="toolbar-btn"
        :class="{ 'toolbar-btn--active': isActive('bulletList') }"
        title="Bullet List"
        :disabled="disabled"
        @click="toggleBulletList"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"
          />
        </svg>
      </button>

      <button
        type="button"
        class="toolbar-btn"
        :class="{ 'toolbar-btn--active': isActive('orderedList') }"
        title="Numbered List"
        :disabled="disabled"
        @click="toggleOrderedList"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"
          />
        </svg>
      </button>
    </div>

    <!-- Editor Content -->
    <EditorContent :editor="editor" class="rich-text-editor__content" />

    <!-- Footer: Error message and character count -->
    <div class="rich-text-editor__footer">
      <p v-if="error" class="rich-text-editor__error">
        {{ error }}
      </p>
      <span v-else />
      <span
        class="rich-text-editor__char-count"
        :style="{ color: getCharCountColor() }"
      >
        {{ charCount }}/{{ maxLength }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.rich-text-editor {
  border: 2px solid var(--color-border);
  border-radius: 8px;
  background: white;
  overflow: hidden;
}

.rich-text-editor--error {
  border-color: var(--color-danger-500);
}

/* Toolbar */
.rich-text-editor__toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: var(--color-surface-50);
  border-bottom: 1px solid var(--color-border);
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 150ms ease;
}

.toolbar-btn:hover:not(:disabled) {
  background: var(--color-surface-200);
  color: var(--color-text-primary);
}

.toolbar-btn--active {
  background: var(--color-primary-100);
  color: var(--color-primary-700);
}

.toolbar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--color-border);
  margin: 0 4px;
}

/* Editor Content */
.rich-text-editor__content {
  min-height: 120px;
  max-height: 300px;
  overflow-y: auto;
}

.rich-text-editor__content :deep(.tiptap) {
  padding: 12px;
  outline: none;
  min-height: 120px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text-primary);
}

.rich-text-editor__content :deep(.tiptap p) {
  margin: 0 0 8px 0;
}

.rich-text-editor__content :deep(.tiptap p:last-child) {
  margin-bottom: 0;
}

.rich-text-editor__content :deep(.tiptap ul),
.rich-text-editor__content :deep(.tiptap ol) {
  padding-left: 24px;
  margin: 8px 0;
}

.rich-text-editor__content :deep(.tiptap li) {
  margin: 4px 0;
}

.rich-text-editor__content
  :deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: var(--color-text-tertiary);
  pointer-events: none;
  height: 0;
}

/* Footer */
.rich-text-editor__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface-50);
}

.rich-text-editor__error {
  font-size: 13px;
  color: var(--color-danger-500);
  margin: 0;
}

.rich-text-editor__char-count {
  font-size: 12px;
}
</style>
