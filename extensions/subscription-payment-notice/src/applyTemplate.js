/**
 * Applies merchant checkout-editor text, with {{key}} placeholders.
 *
 * @param {unknown} value
 * @param {string} fallback
 * @param {Record<string, string | number>} [replacements]
 * @returns {string}
 */
export function applyTemplate(value, fallback, replacements = {}) {
  const template =
    typeof value === 'string' && value.trim() !== '' ? value : fallback;

  return Object.entries(replacements)
    .sort(([left], [right]) => right.length - left.length)
    .reduce((text, [key, replacement]) => {
      const next = String(replacement);

      return text
        .replaceAll(`{{${key}}}`, next)
        .replaceAll(`{${key}}`, next);
    }, template);
}

/**
 * Builds {{days}}, {{weeks}}, {{months}}, and {{years}} values.
 * Months use the same 30-day month already used for intervals.
 *
 * @param {number} days
 * @returns {Record<string, string>}
 */
export function intervalPlaceholders(days) {
  const n = Number(days);

  return {
    days: formatNumber(n),
    weeks: formatNumber(n / 7),
    week: formatNumber(n / 7),
    months: formatNumber(n / 30),
    month: formatNumber(n / 30),
    years: formatNumber(n / 365),
    year: formatNumber(n / 365),
  };
}

/**
 * @param {number} value
 * @returns {string}
 */
function formatNumber(value) {
  if (!Number.isFinite(value)) return '';

  const rounded = Math.round(value * 10) / 10;
  return String(rounded);
}
