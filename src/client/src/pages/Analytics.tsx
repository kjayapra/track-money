import React, { useState, useEffect } from 'react';
import { 
  TrendingUpIcon, 
  TrendingDownIcon, 
  CreditCardIcon,
  MapPinIcon,
  CalendarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
// Chart.js imports removed for debugging

interface AnalyticsData {
  period: {
    type: string;
    current: {
      start: string;
      end: string;
      total: number;
    };
    prior: {
      start: string;
      end: string;
      total: number;
    };
    change: {
      amount: number;
      percentage: number;
    };
  };
  categoryComparisons: Array<{
    id: string;
    name: string;
    icon: string;
    color: string;
    current: {
      amount: number;
      transactions: number;
      avgAmount: number;
    };
    prior: {
      amount: number;
      transactions: number;
    };
    change: {
      amount: number;
      percentage: number;
    };
  }>;
  monthlyTrends: Array<{
    month: string;
    spending: number;
    transactions: number;
  }>;
  cardComparison: Array<{
    cardNumber: string;
    totalSpending: number;
    transactions: number;
    avgTransaction: number;
    period: {
      start: string;
      end: string;
    };
  }>;
  locationAnalysis: Array<{
    location: string;
    spending: number;
    transactions: number;
    avgAmount: number;
  }>;
}

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('month');

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/analytics/advanced?period=${period}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }
      
      const analyticsData = await response.json();
      setData(analyticsData);
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
  
  const formatPercentage = (percentage: number) => {
    const abs = Math.abs(percentage);
    const sign = percentage >= 0 ? '+' : '-';
    return `${sign}${abs.toFixed(1)}%`;
  };

  const getChangeColor = (percentage: number) => {
    if (percentage > 0) return 'text-red-600'; // Spending increased (bad)
    if (percentage < 0) return 'text-green-600'; // Spending decreased (good)
    return 'text-gray-600';
  };

  const getChangeIcon = (percentage: number) => {
    if (percentage > 0) return <ArrowUpIcon className="h-4 w-4" />;
    if (percentage < 0) return <ArrowDownIcon className="h-4 w-4" />;
    return null;
  };

  const getCategoryComparisonChartData = () => {
    if (!data) return null;
    
    const categories = data.categoryComparisons
      .filter(cat => cat.current.amount > 0 || cat.prior.amount > 0)
      .slice(0, 8);
    
    return {
      labels: categories.map(cat => cat.name),
      datasets: [
        {
          label: `Current ${data.period.type}`,
          data: categories.map(cat => cat.current.amount),
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1,
        },
        {
          label: `Prior ${data.period.type}`,
          data: categories.map(cat => cat.prior.amount),
          backgroundColor: 'rgba(156, 163, 175, 0.6)',
          borderColor: 'rgba(156, 163, 175, 1)',
          borderWidth: 1,
        }
      ],
    };
  };

  const getMonthlyTrendsChartData = () => {
    if (!data) return null;
    
    return {
      labels: data.monthlyTrends.map(trend => 
        new Date(trend.month + '-01').toLocaleDateString('en-US', { 
          month: 'short', 
          year: '2-digit' 
        })
      ),
      datasets: [
        {
          label: 'Monthly Spending',
          data: data.monthlyTrends.map(trend => trend.spending),
          borderColor: 'rgba(59, 130, 246, 1)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true,
        }
      ],
    };
  };

  const getCardComparisonChartData = () => {
    if (!data) return null;
    
    const colors = [
      'rgba(59, 130, 246, 0.8)',
      'rgba(16, 185, 129, 0.8)',
      'rgba(245, 101, 101, 0.8)',
      'rgba(251, 191, 36, 0.8)',
      'rgba(139, 92, 246, 0.8)',
    ];
    
    return {
      labels: data.cardComparison.map(card => card.cardNumber),
      datasets: [
        {
          data: data.cardComparison.map(card => card.totalSpending),
          backgroundColor: colors.slice(0, data.cardComparison.length),
          borderColor: colors.slice(0, data.cardComparison.length).map(color => color.replace('0.8', '1')),
          borderWidth: 2,
        }
      ],
    };
  };

// Removed global chart options to prevent potential issues

  const getLocationAnalysisChartData = () => {
    if (!data || data.locationAnalysis.length === 0) return null;
    
    const topLocations = data.locationAnalysis.slice(0, 8);
    const colors = [
      'rgba(59, 130, 246, 0.8)',
      'rgba(16, 185, 129, 0.8)',
      'rgba(245, 101, 101, 0.8)',
      'rgba(251, 191, 36, 0.8)',
      'rgba(139, 92, 246, 0.8)',
      'rgba(236, 72, 153, 0.8)',
      'rgba(14, 165, 233, 0.8)',
      'rgba(34, 197, 94, 0.8)',
    ];
    
    return {
      labels: topLocations.map(loc => loc.location),
      datasets: [
        {
          label: 'Spending by Location',
          data: topLocations.map(loc => loc.spending),
          backgroundColor: colors.slice(0, topLocations.length),
          borderColor: colors.slice(0, topLocations.length).map(color => color.replace('0.8', '1')),
          borderWidth: 1,
        }
      ],
    };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600">Loading your detailed spending analysis...</p>
        </div>
        <div className="animate-pulse space-y-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6">
              <div className="h-6 bg-gray-300 rounded w-1/3 mb-4"></div>
              <div className="h-20 bg-gray-300 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600">Error loading analytics</p>
        </div>
        <div className="bg-red-50 border border-red-300 rounded-lg p-4">
          <p className="text-red-700">{error || 'No data available'}</p>
          <button 
            onClick={fetchAnalytics}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600">
            Detailed spending analysis with {data.period.type}ly comparisons
          </p>
        </div>
        
        {/* Period Selector */}
        <div className="flex space-x-2">
          {['month', 'quarter', 'year'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-2 rounded text-sm font-medium ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Period Overview */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <CalendarIcon className="h-5 w-5 mr-2" />
            Period Comparison
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Current Period</h4>
            <p className="text-xs text-gray-500 mb-2">
              {data.period.current.start} to {data.period.current.end}
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(data.period.current.total)}
            </p>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Prior Period</h4>
            <p className="text-xs text-gray-500 mb-2">
              {data.period.prior.start} to {data.period.prior.end}
            </p>
            <p className="text-2xl font-bold text-gray-600">
              {formatCurrency(data.period.prior.total)}
            </p>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Change</h4>
            <p className="text-xs text-gray-500 mb-2">Period over period</p>
            <div className="flex items-center space-x-2">
              <span className={`text-2xl font-bold ${getChangeColor(data.period.change.percentage)}`}>
                {formatCurrency(Math.abs(data.period.change.amount))}
              </span>
              <span className={`flex items-center text-sm font-medium ${getChangeColor(data.period.change.percentage)}`}>
                {getChangeIcon(data.period.change.percentage)}
                {formatPercentage(data.period.change.percentage)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Comparison */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
          <ChartBarIcon className="h-5 w-5 mr-2" />
          Category Spending Comparison
        </h3>
        
        {/* Chart disabled for debugging */}
        <div className="mb-8">
          <div className="h-80 bg-gray-100 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">Charts disabled for debugging</p>
          </div>
        </div>
        
        {/* Detailed Breakdown */}
        <div className="space-y-4">
          {data.categoryComparisons
            .filter(cat => cat.current.amount > 0 || cat.prior.amount > 0)
            .slice(0, 8)
            .map((category) => (
            <div key={category.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{category.icon}</span>
                <div>
                  <h4 className="font-medium text-gray-900">{category.name}</h4>
                  <p className="text-xs text-gray-500">
                    {category.current.transactions} transactions this period
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <div className="flex items-center space-x-4 mb-1">
                  <span className="text-sm text-gray-600">
                    Was: {formatCurrency(category.prior.amount)}
                  </span>
                  <span className="text-lg font-semibold text-gray-900">
                    Now: {formatCurrency(category.current.amount)}
                  </span>
                </div>
                
                {category.change.percentage !== 0 && (
                  <div className={`flex items-center justify-end space-x-1 text-sm font-medium ${getChangeColor(category.change.percentage)}`}>
                    {getChangeIcon(category.change.percentage)}
                    <span>{formatPercentage(category.change.percentage)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly Trends */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
          <TrendingUpIcon className="h-5 w-5 mr-2" />
          Monthly Spending Trends
        </h3>
        
        {/* Chart - Temporarily disabled for debugging */}
        <div className="mb-8">
          <div className="h-80 bg-gray-100 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">Monthly trends chart temporarily disabled</p>
          </div>
        </div>
        
        {/* Detailed Breakdown */}
        <div className="space-y-3">
          {data.monthlyTrends.map((trend, index) => (
            <div key={trend.month} className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div>
                <span className="font-medium text-gray-900">
                  {new Date(trend.month + '-01').toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long' 
                  })}
                </span>
                <span className="text-sm text-gray-500 ml-2">
                  ({trend.transactions} transactions)
                </span>
              </div>
              <span className="text-lg font-semibold text-gray-900">
                {formatCurrency(trend.spending)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Card Comparison */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
          <CreditCardIcon className="h-5 w-5 mr-2" />
          Card Usage Comparison
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Chart - Temporarily disabled for debugging */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-4">Spending Distribution</h4>
            <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
              <p className="text-gray-500">Card comparison chart temporarily disabled</p>
            </div>
          </div>
          
          {/* Card Details */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-4">Card Details</h4>
            <div className="space-y-4">
              {data.cardComparison.map((card) => (
                <div key={card.cardNumber} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-lg font-semibold text-blue-600">
                      {card.cardNumber}
                    </span>
                    <span className="text-sm text-gray-500">
                      {card.transactions} transactions
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Total Spending</span>
                      <span className="font-semibold">{formatCurrency(card.totalSpending)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Avg Transaction</span>
                      <span className="font-semibold">{formatCurrency(card.avgTransaction)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Period</span>
                      <span className="text-xs text-gray-500">
                        {card.period.start} to {card.period.end}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Location Analysis */}
      {data.locationAnalysis.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
            <MapPinIcon className="h-5 w-5 mr-2" />
            Spending by Location
          </h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Chart - Temporarily disabled for debugging */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-4">Top Spending Locations</h4>
              <div className="h-80 bg-gray-100 rounded-lg flex items-center justify-center">
                <p className="text-gray-500">Location analysis chart temporarily disabled</p>
              </div>
            </div>
            
            {/* Location Details */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-4">Location Breakdown</h4>
              <div className="space-y-3">
                {data.locationAnalysis.slice(0, 8).map((location, index) => (
                  <div key={location.location} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <span className="font-medium text-gray-900">{location.location}</span>
                      <span className="text-sm text-gray-500 ml-2">
                        ({location.transactions} transactions)
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-semibold text-gray-900">
                        {formatCurrency(location.spending)}
                      </span>
                      <p className="text-xs text-gray-500">
                        Avg: {formatCurrency(location.avgAmount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}