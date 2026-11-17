/**
 * Transaction Categorizer
 * Maps merchant names, transaction descriptions, and keywords to SpendWise categories.
 */

import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../config/constants.js';
import { isCreditCardBillPayment } from './smsParser.js';

// Expense keyword mappings
const EXPENSE_KEYWORD_RULES = [
  {
    category: 'Food',
    keywords: [
      'swiggy', 'zomato', 'mcdonald', 'domino', 'kfc', 'burger king', 'pizza',
      'starbucks', 'cafe', 'restaurant', 'eats', 'eatclub', 'zepto', 'blinkit',
      'instamart', 'barbeque', 'chai', 'coffee', 'haldiram', 'subway', 'food'
    ]
  },
  {
    category: 'Shopping',
    keywords: [
      'amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa', 'zara',
      'h&m', 'decathlon', 'croma', 'reliance digital', 'tatacliq', 'shoppers stop',
      'lifestyle', 'westside', 'ikea', 'retail', 'mart', 'supermarket'
    ]
  },
  {
    category: 'Transport',
    keywords: [
      'uber', 'ola', 'rapido', 'metro', 'petrol', 'diesel', 'fuel', 'hpcl',
      'bpcl', 'indianoil', 'shell', 'irctc', 'redbus', 'abhibus', 'chalo',
      'fastag', 'toll', 'parking'
    ]
  },
  {
    category: 'Utilities',
    keywords: [
      'credit card bill', 'credit card payment', 'card bill', 'bill payment',
      'electricity', 'bescom', 'tatapower', 'airtel', 'jio', 'vi', 'vodafone',
      'broadband', 'act fibernet', 'bsnl', 'dth', 'tata play', 'gas', 'adani gas',
      'indane', 'water bill', 'recharge', 'utility', 'billdesk'
    ]
  },
  {
    category: 'Entertainment',
    keywords: [
      'netflix', 'spotify', 'hotstar', 'disney', 'prime video', 'youtube',
      'bookmyshow', 'pvr', 'inox', 'movie', 'steam', 'playstation', 'gaming'
    ]
  },
  {
    category: 'Health',
    keywords: [
      'apollo', 'pharmeasy', '1mg', 'tata 1mg', 'netmeds', 'medplus',
      'hospital', 'clinic', 'pharmacy', 'diagnostic', 'dr.', 'practo', 'dental'
    ]
  },
  {
    category: 'Education',
    keywords: [
      'udemy', 'coursera', 'unacademy', 'byju', 'school', 'college', 'university',
      'tuition', 'exam', 'fees', 'books'
    ]
  },
  {
    category: 'Travel',
    keywords: [
      'makemytrip', 'goibibo', 'cleartrip', 'air india', 'indigo', 'vistara',
      'akasa', 'booking.com', 'agoda', 'airbnb', 'hotel', 'resort', 'flight'
    ]
  }
];

// Income keyword mappings
const INCOME_KEYWORD_RULES = [
  {
    category: 'Salary',
    keywords: ['salary', 'payroll', 'wages', 'stipend', 'bonus']
  },
  {
    category: 'Refund',
    keywords: ['refund', 'refunded', 'reversal', 'reversed', 'cashback']
  },
  {
    category: 'Received from Friend',
    keywords: ['transfer from', 'received from', 'sent to you', 'p2a']
  },
  {
    category: 'Investment',
    keywords: ['dividend', 'zerodha', 'groww', 'upstox', 'mutual fund', 'interest', 'fixed deposit', 'recurring deposit']
  },
  {
    category: 'Freelance',
    keywords: ['upwork', 'fiverr', 'consulting', 'freelance', 'contract']
  }
];

/**
 * Categorize a parsed transaction
 * @param {object} parsedTransaction - Transaction details from smsParser
 * @returns {string} Matching category name from constants
 */
export function categorizeTransaction(parsedTransaction) {
  const { type, merchant = '', rawSender = '', rawBody = '' } = parsedTransaction;
  const targetText = `${merchant} ${rawSender} ${rawBody}`.toLowerCase();

  // Special check for Credit Card Bill Payment -> categorized under 'Utilities'
  if (isCreditCardBillPayment(rawBody) || /credit\s*card\s*bill/i.test(targetText)) {
    return 'Utilities';
  }

  // Special check for ATM cash withdrawal (both debit/credit messages from ATM)
  if (/\batm\b|cash\s*withdrawal/i.test(targetText)) {
    return 'ATM Withdrawal';
  }

  if (type === 'income' || type === 'credit') {
    for (const rule of INCOME_KEYWORD_RULES) {
      for (const kw of rule.keywords) {
        if (targetText.includes(kw)) {
          return rule.category;
        }
      }
    }
    // Default income category
    return 'Other';
  }

  // Expense categorization
  for (const rule of EXPENSE_KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      if (targetText.includes(kw)) {
        return rule.category;
      }
    }
  }

  // Default expense category
  return 'Other';
}

export default {
  categorizeTransaction
};
