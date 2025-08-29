import React, { useState, useEffect } from 'react';

interface DashboardData {
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

export default function SimpleDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Refresh data when page becomes visible (user returns from upload)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchDashboardData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      console.log('Fetching dashboard data...');
      const response = await fetch('/api/analytics/dashboard');
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      
      const dashboardData = await response.json();
      console.log('Dashboard data received:', dashboardData);
      setData(dashboardData);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-300 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6">
                <div className="h-6 bg-gray-300 rounded mb-4"></div>
                <div className="h-10 bg-gray-300 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-300 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">Error Loading Dashboard</h3>
          <p className="text-red-700 mt-1">{error}</p>
          <button 
            onClick={fetchDashboardData}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    console.log('No data available, showing empty state');
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">
          <h2 className="text-xl font-semibold mb-2">No Data Available</h2>
          <p>Upload a credit card statement to get started!</p>
        </div>
      </div>
    );
  }

  console.log('Rendering dashboard with data:', data);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold text-gray-900">
          Credit Card Tracker Dashboard
        </h1>
        <button 
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh Data
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900">Total Spent</h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">
            ${data.totalSpent.toFixed(2)}
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900">Transactions</h3>
          <p className="text-3xl font-bold text-green-600 mt-2">
            {data.transactionCount}
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900">Avg Transaction</h3>
          <p className="text-3xl font-bold text-orange-600 mt-2">
            ${data.avgTransaction.toFixed(2)}
          </p>
        </div>
      </div>
      
      {data.topCategories.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Top Categories</h3>
          <div className="space-y-3">
            {data.topCategories.map((category, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className="text-gray-700">{category.name}</span>
                <span className="font-semibold text-gray-900">
                  ${category.amount.toFixed(2)} ({category.percentage}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {data.recentTransactions.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Transactions</h3>
          <div className="space-y-3">
            {data.recentTransactions.map((transaction) => (
              <div key={transaction.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                <div>
                  <p className="font-medium text-gray-900">{transaction.description}</p>
                  <p className="text-sm text-gray-500">
                    {transaction.category} • {new Date(transaction.date).toLocaleDateString()}
                  </p>
                </div>
                <span className={`font-semibold ${transaction.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {transaction.amount < 0 ? '-' : '+'}${Math.abs(transaction.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {data.totalSpent === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📊</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Transactions Yet</h3>
          <p className="text-gray-500">Upload your first credit card statement to see your spending analysis!</p>
        </div>
      )}
    </div>
  );
}