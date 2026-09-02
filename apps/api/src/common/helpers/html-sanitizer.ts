/**
 * HTML Sanitizer for server-side use.
 * Uses a whitelist approach to allow only safe HTML tags.
 */

/**
 * Allowed HTML tags for rich text content.
 */
const ALLOWED_TAGS = new Set([
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
  "a",
]);

/**
 * Allowed attributes for HTML tags.
 */
const ALLOWED_ATTRS = new Set([
  "src",
  "alt",
  "class",
  "style",
  "href",
  "target",
]);

/**
 * Dangerous patterns to remove completely.
 */
const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
  /on\w+\s*=\s*["'][^"']*["']/gi, // onclick, onload, etc.
  /on\w+\s*=\s*[^\s>]+/gi, // unquoted event handlers
];

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Uses a whitelist approach - only allowed tags and attributes are kept.
 *
 * @param html - The HTML content to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";

  let result = html;

  // Remove dangerous patterns first
  for (const pattern of DANGEROUS_PATTERNS) {
    result = result.replace(pattern, "");
  }

  // Remove disallowed tags but keep their content
  // Match opening tags
  result = result.replace(/<(\w+)([^>]*)>/gi, (match, tagName, attrs) => {
    const tag = tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      return ""; // Remove disallowed tag
    }

    // Filter attributes
    const sanitizedAttrs = sanitizeAttributes(attrs);
    return `<${tag}${sanitizedAttrs}>`;
  });

  // Match closing tags
  result = result.replace(/<\/(\w+)>/gi, (match, tagName) => {
    const tag = tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      return ""; // Remove disallowed closing tag
    }
    return `</${tag}>`;
  });

  return result.trim();
}

/**
 * Filter attributes to only allow safe ones.
 */
function sanitizeAttributes(attrs: string): string {
  if (!attrs || !attrs.trim()) return "";

  const attrRegex = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  const sanitized: string[] = [];
  let match;

  while ((match = attrRegex.exec(attrs)) !== null) {
    const attrName = match[1].toLowerCase();
    const attrValue = match[2] || match[3] || match[4] || "";

    if (ALLOWED_ATTRS.has(attrName)) {
      // Additional check for href/src to prevent javascript: URLs
      if (attrName === "href" || attrName === "src") {
        const lowerValue = attrValue.toLowerCase().trim();
        if (
          lowerValue.startsWith("javascript:") ||
          lowerValue.startsWith("vbscript:") ||
          lowerValue.startsWith("data:") ||
          lowerValue.includes("javascript:") ||
          lowerValue.includes("vbscript:")
        ) {
          continue; // Skip dangerous URLs
        }
      }
      sanitized.push(`${attrName}="${escapeAttrValue(attrValue)}"`);
    }
  }

  return sanitized.length > 0 ? " " + sanitized.join(" ") : "";
}

/**
 * Escape attribute values to prevent XSS.
 */
function escapeAttrValue(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

  return html
    .replace(/<[^>]*>/g, "") // Remove all tags
    .replace(/&nbsp;/gi, " ") // Replace nbsp
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}
