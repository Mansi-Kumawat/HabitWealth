/**
 * CURRENCY CONFIG - the ONE place that decides the currency for the whole app.
 * Want USD instead of INR? Change the two constants below to:
 *   CURRENCY_CODE = "USD", LOCALE = "en-US"
 * Every screen formats money through formatMoney(), so it updates everywhere.
 *
 * Intl.NumberFormat is built into JavaScript. It knows how each country
 * writes money: en-IN groups digits as 1,00,000 (lakh style) and prefixes ₹.
 */
export const CURRENCY_CODE = "INR";
export const LOCALE = "en-IN";
export const CURRENCY_SYMBOL = "₹";

/** Format a number as a money string, e.g. 123456.5 -> "₹1,23,456.50". */
export function formatMoney(amount: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY_CODE,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

/** Short format for chart axis labels, e.g. 45000 -> "₹45k". */
export function formatMoneyShort(amount: number): string {
  if (Math.abs(amount) >= 100000) {
    return `${CURRENCY_SYMBOL}${(amount / 100000).toFixed(1)}L`;
  }
  if (Math.abs(amount) >= 1000) {
    return `${CURRENCY_SYMBOL}${Math.round(amount / 1000)}k`;
  }
  return `${CURRENCY_SYMBOL}${Math.round(amount)}`;
}
