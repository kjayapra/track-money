import fs from 'fs';
import csv from 'csv-parser';
import pdfParse from 'pdf-parse';
import { Transaction } from '../../types';

export interface ParsedTransaction {
  date: Date;
  description: string;
  amount: number;
  originalText: string;
  merchantName?: string;
  merchantCategory?: string;
}

export interface ParseResult {
  transactions: ParsedTransaction[];
  totalAmount: number;
  statementDate: Date;
  errors: string[];
}

export class StatementParser {
  async parseFile(filePath: string, fileType: string): Promise<ParseResult> {
    switch (fileType.toLowerCase()) {
      case 'csv':
        return this.parseCSV(filePath);
      case 'pdf':
        return this.parsePDF(filePath);
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  }

  private async parseCSV(filePath: string): Promise<ParseResult> {
    return new Promise((resolve, reject) => {
      const transactions: ParsedTransaction[] = [];
      const errors: string[] = [];
      let totalAmount = 0;
      let statementDate = new Date();

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          try {
            const parsed = this.parseCSVRow(row);
            if (parsed) {
              transactions.push(parsed);
              totalAmount += Math.abs(parsed.amount);
            }
          } catch (error) {
            errors.push(`Error parsing row: ${error.message}`);
          }
        })
        .on('end', () => {
          if (transactions.length > 0) {
            statementDate = this.getLatestDate(transactions);
          }
          resolve({
            transactions,
            totalAmount,
            statementDate,
            errors
          });
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  private parseCSVRow(row: any): ParsedTransaction | null {
    const possibleDateFields = ['Date', 'Transaction Date', 'Posted Date', 'date'];
    const possibleDescriptionFields = ['Description', 'Merchant', 'Transaction Description', 'description'];
    const possibleAmountFields = ['Amount', 'Transaction Amount', 'Debit', 'Credit', 'amount'];

    let date: Date | null = null;
    let description = '';
    let amount = 0;

    for (const field of possibleDateFields) {
      if (row[field]) {
        date = this.parseDate(row[field]);
        if (date) break;
      }
    }

    for (const field of possibleDescriptionFields) {
      if (row[field]) {
        description = String(row[field]).trim();
        break;
      }
    }

    for (const field of possibleAmountFields) {
      if (row[field]) {
        const parsedAmount = this.parseAmount(row[field]);
        if (!isNaN(parsedAmount)) {
          amount = parsedAmount;
          break;
        }
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
      merchantName: this.extractMerchantName(description),
      merchantCategory: this.guessMerchantCategory(description)
    };
  }

  private async parsePDF(filePath: string): Promise<ParseResult> {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      const text = pdfData.text;

      return this.parsePDFText(text);
    } catch (error) {
      throw new Error(`Failed to parse PDF: ${error.message}`);
    }
  }

  private parsePDFText(text: string): ParseResult {
    const transactions: ParsedTransaction[] = [];
    const errors: string[] = [];
    let totalAmount = 0;
    let statementDate = new Date();

    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    for (let i = 0; i < lines.length; i++) {
      try {
        const transaction = this.parsePDFLine(lines[i]);
        if (transaction) {
          transactions.push(transaction);
          totalAmount += Math.abs(transaction.amount);
        }
      } catch (error) {
        continue;
      }
    }

    if (transactions.length > 0) {
      statementDate = this.getLatestDate(transactions);
    }

    return {
      transactions,
      totalAmount,
      statementDate,
      errors
    };
  }

  private parsePDFLine(line: string): ParsedTransaction | null {
    const dateRegex = /(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|\d{2}\/\d{2})/;
    const amountRegex = /[\$]?([\d,]+\.?\d{0,2})/g;
    
    const dateMatch = line.match(dateRegex);
    if (!dateMatch) return null;

    const date = this.parseDate(dateMatch[1]);
    if (!date) return null;

    const amountMatches = Array.from(line.matchAll(amountRegex));
    if (amountMatches.length === 0) return null;

    const amountStr = amountMatches[amountMatches.length - 1][1];
    const amount = this.parseAmount(amountStr);
    if (isNaN(amount) || amount === 0) return null;

    const dateEndIndex = line.indexOf(dateMatch[1]) + dateMatch[1].length;
    const amountStartIndex = line.lastIndexOf(amountMatches[amountMatches.length - 1][0]);
    
    let description = line.substring(dateEndIndex, amountStartIndex).trim();
    if (!description) {
      description = line.replace(dateMatch[0], '').replace(amountMatches[amountMatches.length - 1][0], '').trim();
    }

    if (!description || description.length < 3) return null;

    return {
      date,
      description,
      amount: line.toLowerCase().includes('payment') || line.toLowerCase().includes('credit') ? amount : -amount,
      originalText: line,
      merchantName: this.extractMerchantName(description),
      merchantCategory: this.guessMerchantCategory(description)
    };
  }

  private parseDate(dateStr: string): Date | null {
    try {
      const cleanDate = dateStr.replace(/[^\d\/\-]/g, '');
      
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
            return new Date(currentYear, parseInt(match[1]) - 1, parseInt(match[2]));
          } else if (format === formats[1]) { // YYYY-MM-DD
            return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
          } else { // MM/DD/YYYY
            return new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
          }
        }
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  private parseAmount(amountStr: string): number {
    try {
      const cleanAmount = amountStr.replace(/[$,]/g, '');
      return parseFloat(cleanAmount);
    } catch (error) {
      return NaN;
    }
  }

  private extractMerchantName(description: string): string {
    const cleaned = description
      .replace(/\*+/g, '')
      .replace(/\d{4,}/g, '')
      .replace(/[#*]/g, '')
      .trim();
    
    const parts = cleaned.split(/\s+/);
    if (parts.length > 3) {
      return parts.slice(0, 3).join(' ');
    }
    return cleaned;
  }

  private guessMerchantCategory(description: string): string {
    const desc = description.toLowerCase();
    
    const categoryKeywords = {
      'groceries': ['grocery', 'supermarket', 'food', 'market', 'safeway', 'kroger', 'walmart'],
      'gas': ['gas', 'fuel', 'exxon', 'shell', 'chevron', 'bp'],
      'restaurants': ['restaurant', 'cafe', 'coffee', 'mcdonald', 'subway', 'pizza'],
      'shopping': ['amazon', 'target', 'store', 'shop', 'retail'],
      'utilities': ['electric', 'water', 'gas company', 'utility'],
      'transport': ['uber', 'lyft', 'taxi', 'bus', 'metro'],
      'entertainment': ['movie', 'theater', 'netflix', 'spotify'],
      'healthcare': ['pharmacy', 'doctor', 'hospital', 'medical']
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => desc.includes(keyword))) {
        return category;
      }
    }

    return 'other';
  }

  private getLatestDate(transactions: ParsedTransaction[]): Date {
    return transactions.reduce((latest, transaction) => {
      return transaction.date > latest ? transaction.date : latest;
    }, new Date(0));
  }
}