import React, { useState, useEffect } from 'react';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { CreditCardIcon, TrendingUpIcon, TrendingDownIcon } from '@heroicons/react/24/outline';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface DashboardStats {
  totalSpent: number;
  transactionCount: number;
  avgTransaction: number;
  topCategories: Array<{
    name: string;
    amount: number;
    percentage: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    amount: number;
  }>;
  recentTransactions: Array<{
    id: string;
    description: string;
    amount: number;
    date: string;
    category: string;
  }>;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data for demonstration
    setStats({
      totalSpent: 4567.89,
      transactionCount: 156,
      avgTransaction: 29.28,
      topCategories: [
        { name: 'Groceries', amount: 1234.56, percentage: 27 },
        { name: 'Restaurants', amount: 987.65, percentage: 22 },
        { name: 'Gas & Fuel', amount: 543.21, percentage: 12 },
        { name: 'Shopping', amount: 432.10, percentage: 9 },
        { name: 'Utilities', amount: 321.09, percentage: 7 },
      ],
      monthlyTrend: [
        { month: '2024-02', amount: 3456.78 },
        { month: '2024-03', amount: 4123.45 },
        { month: '2024-04', amount: 3789.12 },
        { month: '2024-05', amount: 4567.89 },
        { month: '2024-06', amount: 5234.56 },
        { month: '2024-07', amount: 4567.89 },
      ],
      recentTransactions: [
        {
          id: '1',
          description: 'Walmart Supercenter',
          amount: -89.45,
          date: '2024-07-28',
          category: 'Groceries'
        },
        {
          id: '2',
          description: 'Shell Gas Station',
          amount: -45.67,
          date: '2024-07-27',
          category: 'Gas & Fuel'
        },
        {
          id: '3',
          description: 'Starbucks',
          amount: -12.50,
          date: '2024-07-27',
          category: 'Restaurants'
        },
      ]
    });
    setLoading(false);
  }, []);

  if (loading || !stats) {
    return <div className="animate-pulse">Loading...</div>;
  }

  const categoryChartData = {
    labels: stats.topCategories.map(c => c.name),
    datasets: [
      {
        data: stats.topCategories.map(c => c.amount),
        backgroundColor: [
          '#3B82F6',
          '#10B981',
          '#F59E0B',
          '#EF4444',
          '#8B5CF6',
        ],
        borderWidth: 0,
      },
    ],
  };

  const trendChartData = {
    labels: stats.monthlyTrend.map(m => m.month),
    datasets: [
      {
        label: 'Monthly Spending',
        data: stats.monthlyTrend.map(m => m.amount),
        borderColor: '#3B82F6',
        backgroundColor: '#3B82F620',
        fill: true,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Overview of your spending patterns and trends</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CreditCardIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Spent</p>
              <p className="text-2xl font-bold text-gray-900">${stats.totalSpent.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingUpIcon className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Transactions</p>
              <p className="text-2xl font-bold text-gray-900">{stats.transactionCount}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingDownIcon className="h-8 w-8 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Transaction</p>
              <p className="text-2xl font-bold text-gray-900">${stats.avgTransaction.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Spending by Category</h3>
          <div className="h-64">
            <Doughnut data={categoryChartData} options={{ maintainAspectRatio: false }} />
          </div>
          <div className="mt-4 space-y-2">
            {stats.topCategories.map((category, index) => (
              <div key={category.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <div
                    className="w-3 h-3 rounded-full mr-2"
                    style={{
                      backgroundColor: categoryChartData.datasets[0].backgroundColor[index],
                    }}
                  />
                  <span>{category.name}</span>
                </div>
                <span className="font-medium">${category.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Trend */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Monthly Spending Trend</h3>
          <div className="h-64">
            <Line data={trendChartData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Transactions</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.recentTransactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transaction.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {transaction.category}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(transaction.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <span
                      className={
                        transaction.amount < 0 ? 'text-red-600' : 'text-green-600'
                      }
                    >
                      ${Math.abs(transaction.amount).toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}