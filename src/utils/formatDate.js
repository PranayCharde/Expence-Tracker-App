/**
 * Bulletproof Date Formatting Utility for SpendWise
 * Safely parses and formats dates across string (YYYY-MM-DD), Firestore Timestamps, and JS Date objects.
 */

import { format, parseISO, isValid } from 'date-fns';

/**
 * Format a transaction date for display (e.g. "14 Nov 2026")
 * @param {string | object | Date} rawDate 
 * @returns {string} Formatted date string
 */
export function formatTransactionDate(rawDate) {
  if (!rawDate) {
    return format(new Date(), 'dd MMM yyyy');
  }

  try {
    // 1. Handle Firestore Timestamp ({ seconds, nanoseconds })
    if (typeof rawDate === 'object' && typeof rawDate.seconds === 'number') {
      const d = new Date(rawDate.seconds * 1000);
      if (isValid(d)) {
        return format(d, 'dd MMM yyyy');
      }
    }

    // 2. Handle YYYY-MM-DD string
    if (typeof rawDate === 'string') {
      const clean = rawDate.split('T')[0].trim();
      const parts = clean.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (isValid(d)) {
          return format(d, 'dd MMM yyyy');
        }
      }

      // Try DD/MM/YYYY
      const slashParts = clean.split('/');
      if (slashParts.length === 3) {
        const day = parseInt(slashParts[0], 10);
        const month = parseInt(slashParts[1], 10) - 1;
        const year = parseInt(slashParts[2], 10);
        const d = new Date(year, month, day);
        if (isValid(d)) {
          return format(d, 'dd MMM yyyy');
        }
      }
    }

    // 3. Fallback to standard Date parsing
    const fallbackDate = new Date(rawDate);
    if (isValid(fallbackDate)) {
      return format(fallbackDate, 'dd MMM yyyy');
    }
  } catch (err) {
    console.warn('Error formatting date:', err);
  }

  return String(rawDate);
}

/**
 * Return today's date formatted as YYYY-MM-DD
 */
export function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Return yesterday's date formatted as YYYY-MM-DD
 */
export function getYesterdayDateString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default {
  formatTransactionDate,
  getTodayDateString,
  getYesterdayDateString
};

