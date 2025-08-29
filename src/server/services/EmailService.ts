import nodemailer from 'nodemailer';
import { Database } from '../database/Database';
import { SpendingAnalysis, EmailReport } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { format, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter } from 'date-fns';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendMonthlyReport(
    userEmail: string,
    userName: string,
    spendingAnalysis: SpendingAnalysis,
    reportDate: Date
  ): Promise<void> {
    const subject = `Monthly Spending Report - ${format(reportDate, 'MMMM yyyy')}`;
    const htmlContent = this.generateMonthlyReportHTML(userName, spendingAnalysis, reportDate);
    
    await this.sendEmail(userEmail, subject, htmlContent);
  }

  async sendQuarterlyReport(
    userEmail: string,
    userName: string,
    spendingAnalysis: SpendingAnalysis,
    reportDate: Date
  ): Promise<void> {
    const quarter = Math.floor(reportDate.getMonth() / 3) + 1;
    const subject = `Quarterly Spending Report - Q${quarter} ${reportDate.getFullYear()}`;
    const htmlContent = this.generateQuarterlyReportHTML(userName, spendingAnalysis, reportDate);
    
    await this.sendEmail(userEmail, subject, htmlContent);
  }

  async sendAnomalyAlert(
    userEmail: string,
    userName: string,
    anomalies: Array<{
      date: Date;
      amount: number;
      description: string;
      reason: string;
    }>
  ): Promise<void> {
    const subject = 'Spending Anomaly Alert - Unusual Transactions Detected';
    const htmlContent = this.generateAnomalyAlertHTML(userName, anomalies);
    
    await this.sendEmail(userEmail, subject, htmlContent);
  }

  async sendBudgetAlert(
    userEmail: string,
    userName: string,
    categoryName: string,
    spent: number,
    budget: number,
    percentage: number
  ): Promise<void> {
    const subject = `Budget Alert - ${categoryName} spending at ${percentage.toFixed(0)}%`;
    const htmlContent = this.generateBudgetAlertHTML(userName, categoryName, spent, budget, percentage);
    
    await this.sendEmail(userEmail, subject, htmlContent);
  }

  private async sendEmail(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: process.env.FROM_EMAIL || 'noreply@credittracker.com',
        to,
        subject,
        html,
      });
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  private generateMonthlyReportHTML(
    userName: string,
    analysis: SpendingAnalysis,
    reportDate: Date
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Monthly Spending Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f9fafb; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { padding: 30px; }
        .stat { margin-bottom: 20px; padding: 15px; background-color: #f3f4f6; border-radius: 6px; }
        .stat-value { font-size: 24px; font-weight: bold; color: #1f2937; }
        .stat-label { color: #6b7280; font-size: 14px; margin-top: 5px; }
        .category-item { display: flex; justify-content: between; align-items: center; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .category-name { font-weight: 500; }
        .category-amount { font-weight: 600; color: #dc2626; }
        .footer { padding: 20px 30px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center; color: #6b7280; font-size: 12px; }
        .anomaly { background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Monthly Spending Report</h1>
            <p>${format(reportDate, 'MMMM yyyy')}</p>
        </div>
        
        <div class="content">
            <p>Hello ${userName},</p>
            <p>Here's your spending summary for ${format(reportDate, 'MMMM yyyy')}:</p>
            
            <div class="stat">
                <div class="stat-value">$${analysis.totalSpent.toFixed(2)}</div>
                <div class="stat-label">Total Spent</div>
            </div>
            
            <div class="stat">
                <div class="stat-value">${analysis.transactionCount}</div>
                <div class="stat-label">Transactions</div>
            </div>
            
            <div class="stat">
                <div class="stat-value">$${analysis.avgTransactionAmount.toFixed(2)}</div>
                <div class="stat-label">Average Transaction</div>
            </div>
            
            <h3>Top Spending Categories</h3>
            ${analysis.topCategories.slice(0, 5).map(cat => `
                <div class="category-item">
                    <span class="category-name">${cat.categoryName}</span>
                    <span class="category-amount">$${cat.amount.toFixed(2)} (${cat.percentage.toFixed(0)}%)</span>
                </div>
            `).join('')}
            
            ${analysis.anomalies.length > 0 ? `
                <h3>Unusual Transactions</h3>
                ${analysis.anomalies.slice(0, 3).map(anomaly => `
                    <div class="anomaly">
                        <strong>$${Math.abs(anomaly.amount).toFixed(2)}</strong> - ${anomaly.description}<br>
                        <small>${anomaly.reason}</small>
                    </div>
                `).join('')}
            ` : ''}
        </div>
        
        <div class="footer">
            <p>This report was generated automatically by Credit Tracker.</p>
            <p>If you have any questions, please contact support.</p>
        </div>
    </div>
</body>
</html>`;
  }

  private generateQuarterlyReportHTML(
    userName: string,
    analysis: SpendingAnalysis,
    reportDate: Date
  ): string {
    const quarter = Math.floor(reportDate.getMonth() / 3) + 1;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quarterly Spending Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f9fafb; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #10b981, #047857); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { padding: 30px; }
        .stat { margin-bottom: 20px; padding: 15px; background-color: #f3f4f6; border-radius: 6px; }
        .stat-value { font-size: 24px; font-weight: bold; color: #1f2937; }
        .stat-label { color: #6b7280; font-size: 14px; margin-top: 5px; }
        .trend-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .footer { padding: 20px 30px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Quarterly Spending Report</h1>
            <p>Q${quarter} ${reportDate.getFullYear()}</p>
        </div>
        
        <div class="content">
            <p>Hello ${userName},</p>
            <p>Here's your quarterly spending summary for Q${quarter} ${reportDate.getFullYear()}:</p>
            
            <div class="stat">
                <div class="stat-value">$${analysis.totalSpent.toFixed(2)}</div>
                <div class="stat-label">Total Spent This Quarter</div>
            </div>
            
            <div class="stat">
                <div class="stat-value">${analysis.transactionCount}</div>
                <div class="stat-label">Total Transactions</div>
            </div>
            
            <h3>Monthly Breakdown</h3>
            ${analysis.monthlyTrend.slice(0, 3).map(month => `
                <div class="trend-item">
                    <span>${format(new Date(month.month + '-01'), 'MMMM yyyy')}</span>
                    <span>$${month.amount.toFixed(2)}</span>
                </div>
            `).join('')}
            
            <h3>Top Categories This Quarter</h3>
            ${analysis.topCategories.slice(0, 5).map(cat => `
                <div class="trend-item">
                    <span>${cat.categoryName}</span>
                    <span>$${cat.amount.toFixed(2)} (${cat.percentage.toFixed(0)}%)</span>
                </div>
            `).join('')}
        </div>
        
        <div class="footer">
            <p>This quarterly report was generated automatically by Credit Tracker.</p>
        </div>
    </div>
</body>
</html>`;
  }

  private generateAnomalyAlertHTML(
    userName: string,
    anomalies: Array<{
      date: Date;
      amount: number;
      description: string;
      reason: string;
    }>
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Spending Anomaly Alert</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f9fafb; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #dc2626, #991b1b); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { padding: 30px; }
        .anomaly { background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 10px 0; border-radius: 4px; }
        .footer { padding: 20px 30px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚠️ Spending Alert</h1>
            <p>Unusual transactions detected</p>
        </div>
        
        <div class="content">
            <p>Hello ${userName},</p>
            <p>We've detected some unusual spending patterns in your account:</p>
            
            ${anomalies.map(anomaly => `
                <div class="anomaly">
                    <strong>$${Math.abs(anomaly.amount).toFixed(2)}</strong> - ${anomaly.description}<br>
                    <small>${format(anomaly.date, 'MMM dd, yyyy')}</small><br>
                    <em>${anomaly.reason}</em>
                </div>
            `).join('')}
            
            <p>Please review these transactions to ensure they are legitimate. If you notice any unauthorized charges, contact your credit card company immediately.</p>
        </div>
        
        <div class="footer">
            <p>This alert was generated automatically by Credit Tracker.</p>
        </div>
    </div>
</body>
</html>`;
  }

  private generateBudgetAlertHTML(
    userName: string,
    categoryName: string,
    spent: number,
    budget: number,
    percentage: number
  ): string {
    const isOverBudget = percentage > 100;
    const color = isOverBudget ? '#dc2626' : '#f59e0b';
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Budget Alert</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f9fafb; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { background: ${color}; color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { padding: 30px; }
        .budget-bar { background-color: #e5e7eb; height: 20px; border-radius: 10px; overflow: hidden; margin: 20px 0; }
        .budget-fill { height: 100%; background: ${color}; width: ${Math.min(percentage, 100)}%; }
        .footer { padding: 20px 30px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${isOverBudget ? '🚨' : '⚠️'} Budget Alert</h1>
            <p>${categoryName} - ${percentage.toFixed(0)}% of budget used</p>
        </div>
        
        <div class="content">
            <p>Hello ${userName},</p>
            <p>${isOverBudget ? 'You have exceeded' : 'You are approaching'} your budget for <strong>${categoryName}</strong>.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <div style="font-size: 32px; font-weight: bold; color: ${color};">
                    $${spent.toFixed(2)}
                </div>
                <div style="color: #6b7280;">of $${budget.toFixed(2)} budgeted</div>
                
                <div class="budget-bar">
                    <div class="budget-fill"></div>
                </div>
                
                <div style="font-size: 18px; font-weight: 600;">
                    ${percentage.toFixed(1)}% used
                </div>
            </div>
            
            ${isOverBudget ? 
              `<p style="color: #dc2626;"><strong>You are $${(spent - budget).toFixed(2)} over budget for this category.</strong></p>` :
              `<p>You have $${(budget - spent).toFixed(2)} remaining in this budget category.</p>`
            }
            
            <p>Consider reviewing your spending in this category to stay on track with your financial goals.</p>
        </div>
        
        <div class="footer">
            <p>This budget alert was generated automatically by Credit Tracker.</p>
        </div>
    </div>
</body>
</html>`;
  }
}