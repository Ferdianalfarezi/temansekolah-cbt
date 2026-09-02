import DOMPurify from "isomorphic-dompurify";

/**
 * Configuration for HTML sanitization.
 * Allows only safe formatting tags for rich text content.
 */
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "ul",
    "ol",
    "li",
    "img",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "pre",
    "code",
    "span",
    "div",
    "sub",
    "sup",
  ],
  ALLOWED_ATTR: ["src", "alt", "class", "style", "href", "target"],
  ALLOW_DATA_ATTR: false,
};

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Used for rich text content like question text (teks_soal).
 *
 * @param html - The HTML content to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

/**
 * Strip all HTML tags and return plain text.
 * Useful for text-only contexts like Excel exports.
 *
 * @param html - The HTML content to strip
 * @returns Plain text without HTML tags
 */
export function stripHtml(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });
}
