/**
 * Utility functions for Indian Number formatting and Currency to Words
 */

/**
 * Formats a number to Indian currency format (e.g. ₹12,000, ₹1,50,000, ₹12,50,000)
 */
export function formatIndianCurrency(amount: number | null | undefined, showSymbol: boolean = true): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return showSymbol ? '₹0' : '0';
  }

  const rounded = Math.round(amount);
  const isNegative = rounded < 0;
  const absVal = Math.abs(rounded);

  const numStr = absVal.toString();
  let result = '';

  if (numStr.length <= 3) {
    result = numStr;
  } else {
    const lastThree = numStr.substring(numStr.length - 3);
    const otherNumbers = numStr.substring(0, numStr.length - 3);
    const withCommas = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    result = `${withCommas},${lastThree}`;
  }

  const formatted = isNegative ? `-${result}` : result;
  return showSymbol ? `₹${formatted}` : formatted;
}

/**
 * Converts a number to words in Indian numbering convention (Lakhs, Crores)
 * e.g. 150000 -> "Rupees One Lakh Fifty Thousand Only"
 */
export function numberToIndianWords(amount: number): string {
  if (!amount || isNaN(amount)) return 'Rupees Zero Only';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];

  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  const wholeNumber = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - wholeNumber) * 100);

  function convertTwoDigits(n: number): string {
    if (n < 20) return ones[n];
    const unit = n % 10;
    const ten = Math.floor(n / 10);
    return tens[ten] + (unit ? ' ' + ones[unit] : '');
  }

  function convertThreeDigits(n: number): string {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let str = '';
    if (hundred > 0) {
      str += ones[hundred] + ' Hundred';
      if (rest > 0) str += ' and ';
    }
    if (rest > 0) {
      str += convertTwoDigits(rest);
    }
    return str;
  }

  if (wholeNumber === 0) {
    return 'Rupees Zero Only';
  }

  // Indian groupings: Crores (10^7), Lakhs (10^5), Thousands (10^3), Hundreds
  const crore = Math.floor(wholeNumber / 10000000);
  const remainingAfterCrore = wholeNumber % 10000000;

  const lakh = Math.floor(remainingAfterCrore / 100000);
  const remainingAfterLakh = remainingAfterCrore % 100000;

  const thousand = Math.floor(remainingAfterLakh / 1000);
  const remainder = remainingAfterLakh % 1000;

  const parts: string[] = [];

  if (crore > 0) {
    parts.push(convertThreeDigits(crore) + ' Crore');
  }
  if (lakh > 0) {
    parts.push(convertThreeDigits(lakh) + ' Lakh');
  }
  if (thousand > 0) {
    parts.push(convertThreeDigits(thousand) + ' Thousand');
  }
  if (remainder > 0) {
    parts.push(convertThreeDigits(remainder));
  }

  let words = 'Rupees ' + parts.join(' ');
  if (paise > 0) {
    words += ' and ' + convertTwoDigits(paise) + ' Paise';
  }
  words += ' Only';

  return words.replace(/\s+/g, ' ').trim();
}

/**
 * Formats YYYY-MM to Month Name Year (e.g. 2025-04 -> "April 2025")
 */
export function formatPayrollMonth(payrollMonth: string): string {
  if (!payrollMonth || !payrollMonth.includes('-')) return payrollMonth;
  const [yearStr, monthStr] = payrollMonth.split('-');
  const monthNum = parseInt(monthStr, 10);
  const year = parseInt(yearStr, 10);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${months[monthNum - 1] || ''} ${year}`;
}

/**
 * Formats standard date to DD/MM/YYYY
 */
export function formatIndianDate(dateStr?: string | Date): string {
  if (!dateStr) return '-';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Get days in month for YYYY-MM
 */
export function getDaysInPayrollMonth(payrollMonth: string): number {
  if (!payrollMonth || !payrollMonth.includes('-')) return 30;
  const [yearStr, monthStr] = payrollMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  return new Date(year, month, 0).getDate();
}
