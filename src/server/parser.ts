import fs from 'fs';
import csv from 'csv-parser';
import pdfParse from 'pdf-parse';

export interface ParsedTransaction {
  date: Date;
  description: string;
  amount: number;
  originalText: string;
  merchantName?: string;
}

export interface ParseResult {
  transactions: ParsedTransaction[];
  totalAmount: number;
  fileName: string;
  errors: string[];
}

export async function parseStatementFile(filePath: string, fileName: string): Promise<ParseResult> {
  const fileExtension = fileName.toLowerCase().split('.').pop();
  
  try {
    switch (fileExtension) {
      case 'csv':
        return await parseCSV(filePath, fileName);
      case 'pdf':
        return await parsePDF(filePath, fileName);
      default:
        throw new Error(`Unsupported file type: ${fileExtension}`);
    }
  } catch (error) {
    return {
      transactions: [],
      totalAmount: 0,
      fileName,
      errors: [`Failed to parse file: ${error.message}`]
    };
  }
}

async function parseCSV(filePath: string, fileName: string): Promise<ParseResult> {
  return new Promise((resolve) => {
    const transactions: ParsedTransaction[] = [];
    const errors: string[] = [];
    let totalAmount = 0;

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        try {
          const parsed = parseCSVRow(row);
          if (parsed) {
            transactions.push(parsed);
            totalAmount += Math.abs(parsed.amount);
          }
        } catch (error) {
          errors.push(`Error parsing row: ${error.message}`);
        }
      })
      .on('end', () => {
        resolve({
          transactions,
          totalAmount,
          fileName,
          errors
        });
      })
      .on('error', (error) => {
        resolve({
          transactions: [],
          totalAmount: 0,
          fileName,
          errors: [`CSV parsing error: ${error.message}`]
        });
      });
  });
}

function parseCSVRow(row: any): ParsedTransaction | null {
  // Common CSV header variations
  const dateFields = ['Date', 'Transaction Date', 'Posted Date', 'date', 'DATE'];
  const descriptionFields = ['Description', 'Merchant', 'Transaction Description', 'description', 'DESCRIPTION', 'Payee'];
  const amountFields = ['Amount', 'Transaction Amount', 'Debit', 'Credit', 'amount', 'AMOUNT'];

  let date: Date | null = null;
  let description = '';
  let amount = 0;

  // Find date
  for (const field of dateFields) {
    if (row[field]) {
      date = parseDate(row[field]);
      if (date) break;
    }
  }

  // Find description
  for (const field of descriptionFields) {
    if (row[field] && String(row[field]).trim()) {
      description = String(row[field]).trim();
      break;
    }
  }

  // Find amount
  for (const field of amountFields) {
    if (row[field]) {
      const parsedAmount = parseAmount(String(row[field]));
      if (!isNaN(parsedAmount) && parsedAmount !== 0) {
        amount = parsedAmount;
        break;
      }
    }
  }

  // Handle separate debit/credit columns
  if (amount === 0) {
    const debit = row['Debit'] || row['debit'] || row['DEBIT'];
    const credit = row['Credit'] || row['credit'] || row['CREDIT'];
    
    if (debit) {
      const debitAmount = parseAmount(String(debit));
      if (!isNaN(debitAmount)) amount = -Math.abs(debitAmount);
    }
    
    if (credit) {
      const creditAmount = parseAmount(String(credit));
      if (!isNaN(creditAmount)) amount = Math.abs(creditAmount);
    }
  }

  if (!date || !description || amount === 0) {
    return null;
  }

  return {
    date,
    description,
    amount,
    originalText: JSON.stringify(row),
    merchantName: extractMerchantName(description)
  };
}

async function parsePDF(filePath: string, fileName: string): Promise<ParseResult> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    const text = pdfData.text;

    return parsePDFText(text, fileName);
  } catch (error) {
    return {
      transactions: [],
      totalAmount: 0,
      fileName,
      errors: [`PDF parsing error: ${error.message}`]
    };
  }
}

function parsePDFText(text: string, fileName: string): ParseResult {
  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];
  let totalAmount = 0;

  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  for (const line of lines) {
    try {
      const transaction = parsePDFLine(line);
      if (transaction) {
        transactions.push(transaction);
        totalAmount += Math.abs(transaction.amount);
      }
    } catch (error) {
      // Skip lines that don't parse - this is normal for PDF parsing
      continue;
    }
  }

  return {
    transactions,
    totalAmount,
    fileName,
    errors
  };
}

function parsePDFLine(line: string): ParsedTransaction | null {
  // Common PDF statement patterns
  const patterns = [
    // MM/DD/YYYY DESCRIPTION $AMOUNT
    /(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+?)\s+\$?([\d,]+\.?\d{0,2})$/,
    // MM/DD DESCRIPTION $AMOUNT
    /(\d{1,2}\/\d{1,2})\s+(.+?)\s+\$?([\d,]+\.?\d{0,2})$/,
    // YYYY-MM-DD DESCRIPTION AMOUNT
    /(\d{4}-\d{2}-\d{2})\s+(.+?)\s+([\d,]+\.?\d{0,2})$/
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      const [, dateStr, description, amountStr] = match;
      
      const date = parseDate(dateStr);
      if (!date) continue;

      const amount = parseAmount(amountStr);
      if (isNaN(amount) || amount === 0) continue;

      const cleanDescription = description.replace(/\s+/g, ' ').trim();
      if (!cleanDescription || cleanDescription.length < 2) continue;

      // Assume expenses are negative (most transactions in statements)
      const finalAmount = amount > 0 ? -amount : amount;

      return {
        date,
        description: cleanDescription,
        amount: finalAmount,
        originalText: line,
        merchantName: extractMerchantName(cleanDescription)
      };
    }
  }

  return null;
}

function parseDate(dateStr: string): Date | null {
  try {
    const cleanDate = dateStr.replace(/[^\d\/\-]/g, '');
    
    // Try different date formats
    const formats = [
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // MM/DD/YYYY
      /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
      /^(\d{1,2})\/(\d{1,2})$/ // MM/DD (current year)
    ];

    for (const format of formats) {
      const match = cleanDate.match(format);
      if (match) {
        if (format === formats[2]) { // MM/DD format
          const currentYear = new Date().getFullYear();
          const date = new Date(currentYear, parseInt(match[1]) - 1, parseInt(match[2]));
          if (isValidDate(date)) return date;
        } else if (format === formats[1]) { // YYYY-MM-DD
          const date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
          if (isValidDate(date)) return date;
        } else { // MM/DD/YYYY
          const date = new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
          if (isValidDate(date)) return date;
        }
      }
    }
    
    // Try built-in Date parsing as fallback
    const date = new Date(dateStr);
    if (isValidDate(date)) return date;
    
  } catch (error) {
    return null;
  }
  return null;
}

function parseAmount(amountStr: string): number {
  try {
    // Remove currency symbols, commas, and whitespace
    const cleanAmount = amountStr.replace(/[$,\s]/g, '');
    
    // Handle parentheses (negative amounts)
    if (cleanAmount.includes('(') && cleanAmount.includes(')')) {
      const number = parseFloat(cleanAmount.replace(/[()]/g, ''));
      return isNaN(number) ? NaN : -Math.abs(number);
    }
    
    const number = parseFloat(cleanAmount);
    return isNaN(number) ? NaN : number;
  } catch (error) {
    return NaN;
  }
}

function extractMerchantName(description: string): string {
  // Clean up common transaction descriptions
  let cleaned = description
    .replace(/\*+/g, '') // Remove asterisks
    .replace(/\d{4,}/g, '') // Remove long numbers (reference numbers)
    .replace(/[#*]/g, '') // Remove # and *
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  // Take first few words as merchant name
  const words = cleaned.split(/\s+/);
  if (words.length > 3) {
    return words.slice(0, 3).join(' ');
  }
  
  return cleaned;
}

function isValidDate(date: Date): boolean {
  return date instanceof Date && !isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100;
}