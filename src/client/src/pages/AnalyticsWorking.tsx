import React, { useState, useEffect } from 'react';
import { 
  CreditCardIcon,
  CalendarIcon,
  ChartBarIcon,
  HomeIcon as TrendingUpIcon,
  ExclamationTriangleIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

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
      avgAmount: number | null;
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

interface AnomaliesData {
  averageAmount: number;
  threshold: number;
  largeTransactions: Array<{
    id: string;
    description: string;
    merchant_name: string;
    amount: number;
    date: string;
    card_number: string;
    category_name: string;
    category_icon: string;
    category_color: string;
  }>;
  duplicateTransactions: Array<{
    id: string;
    description: string;
    merchant_name: string;
    amount: number;
    date: string;
    card_number: string;
    category_name: string;
    category_icon: string;
    category_color: string;
    duplicate_count: number;
  }>;
  frequentTransactions: Array<{
    merchant_name: string;
    transaction_count: number;
    avg_amount: number;
    total_spent: number;
    category_name: string;
    category_icon: string;
    category_color: string;
  }>;
  categorySpikes: Array<{
    category_name: string;
    category_icon: string;
    category_color: string;
    current_month: number;
    last_month: number;
    increasePercent: number;
  }>;
}

export default function AnalyticsWorking() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('month');
  const [recategorizing, setRecategorizing] = useState(false);
  
  // Anomalies data
  const [anomaliesData, setAnomaliesData] = useState<AnomaliesData | null>(null);
  const [loadingAnomalies, setLoadingAnomalies] = useState(true);
  const [showAnomalies, setShowAnomalies] = useState(false);

  useEffect(() => {
    fetchAnalytics();
    fetchAnomalies();
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

  const recategorizeTransactions = async () => {
    try {
      setRecategorizing(true);
      const response = await fetch('/api/recategorize-transactions', {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to recategorize transactions');
      }
      
      const result = await response.json();
      alert(`Recategorization complete! ${result.updatedCount} transactions updated.`);
      
      // Refresh analytics data to show updated categories
      await fetchAnalytics();
    } catch (err) {
      console.error('Recategorization error:', err);
      alert('Failed to recategorize transactions. Please try again.');
    } finally {
      setRecategorizing(false);
    }
  };

  const fetchAnomalies = async () => {
    try {
      setLoadingAnomalies(true);
      const response = await fetch('/api/analytics/anomalies');
      
      if (!response.ok) {
        throw new Error('Failed to fetch anomalies');
      }
      
      const anomalies = await response.json();
      setAnomaliesData(anomalies);
    } catch (err) {
      console.error('Anomalies fetch error:', err);
      // Don't show error for anomalies, just keep loading state
    } finally {
      setLoadingAnomalies(false);
    }
  };

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
  
  const formatPercentage = (percentage: number) => {
    const abs = Math.abs(percentage);
    const sign = percentage >= 0 ? '+' : '-';
    return `${sign}${abs.toFixed(1)}%`;
  };

  const getChangeColor = (percentage: number) => {
    if (percentage > 0) return 'text-red-600';
    if (percentage < 0) return 'text-green-600';
    return 'text-gray-600';
  };

  const getChangeIcon = (percentage: number) => {
    if (percentage > 0) return <span className="text-red-600">↑</span>;
    if (percentage < 0) return <span className="text-green-600">↓</span>;
    return null;
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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600">
            Detailed spending analysis with {data.period.type}ly comparisons
          </p>
        </div>
        
        <div className="flex flex-col space-y-3">
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
          
          {/* Recategorize Button */}
          <button
            onClick={recategorizeTransactions}
            disabled={recategorizing}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {recategorizing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                Updating...
              </>
            ) : (
              'Update Categories'
            )}
          </button>
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
        
        <div className="space-y-3">
          {data.monthlyTrends.map((trend) => (
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

      {/* Anomalies Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <ExclamationTriangleIcon className="h-5 w-5 mr-2 text-orange-500" />
            Spending Anomalies
          </h3>
          <button
            onClick={() => setShowAnomalies(!showAnomalies)}
            className="px-3 py-1 text-sm bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200"
          >
            {showAnomalies ? 'Hide Details' : 'View Details'}
          </button>
        </div>

        {loadingAnomalies ? (
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded w-full"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        ) : anomaliesData ? (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-orange-50 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {anomaliesData.largeTransactions.length}
                </div>
                <div className="text-sm text-gray-600">Large Transactions</div>
                <div className="text-xs text-gray-500">
                  &gt;{formatCurrency(anomaliesData.threshold)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {anomaliesData.duplicateTransactions.length}
                </div>
                <div className="text-sm text-gray-600">Potential Duplicates</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {anomaliesData.frequentTransactions.length}
                </div>
                <div className="text-sm text-gray-600">Frequent Merchants</div>
                <div className="text-xs text-gray-500">
                  &gt;5 times/month
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {anomaliesData.categorySpikes.length}
                </div>
                <div className="text-sm text-gray-600">Category Spikes</div>
                <div className="text-xs text-gray-500">
                  &gt;50% increase
                </div>
              </div>
            </div>

            {showAnomalies && (
              <div className="space-y-6">
                {/* Large Transactions */}
                {anomaliesData.largeTransactions.length > 0 && (
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center">
                      <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                      Large Transactions (over {formatCurrency(anomaliesData.threshold)})
                    </h4>
                    <div className="space-y-2">
                      {anomaliesData.largeTransactions.slice(0, 5).map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <span className="text-lg">{tx.category_icon}</span>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {tx.merchant_name || tx.description}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(tx.date).toLocaleDateString()} • ****{tx.card_number}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold text-red-600">
                              {formatCurrency(Math.abs(tx.amount))}
                            </span>
                            <p className="text-xs text-gray-500">{tx.category_name}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Duplicate Transactions */}
                {anomaliesData.duplicateTransactions.length > 0 && (
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center">
                      <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                      Potential Duplicate Transactions
                    </h4>
                    <div className="space-y-2">
                      {anomaliesData.duplicateTransactions.slice(0, 5).map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <span className="text-lg">{tx.category_icon}</span>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {tx.merchant_name || tx.description}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(tx.date).toLocaleDateString()} • ****{tx.card_number}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold text-yellow-600">
                              {formatCurrency(Math.abs(tx.amount))}
                            </span>
                            <p className="text-xs text-gray-500">
                              {tx.duplicate_count} similar transactions
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Frequent Transactions */}
                {anomaliesData.frequentTransactions.length > 0 && (
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                      Frequent Merchants (Last 30 Days)
                    </h4>
                    <div className="space-y-2">
                      {anomaliesData.frequentTransactions.slice(0, 5).map((merchant) => (
                        <div key={merchant.merchant_name} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <span className="text-lg">{merchant.category_icon}</span>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {merchant.merchant_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {merchant.transaction_count} transactions • Avg: {formatCurrency(merchant.avg_amount)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold text-blue-600">
                              {formatCurrency(merchant.total_spent)}
                            </span>
                            <p className="text-xs text-gray-500">{merchant.category_name}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Category Spikes */}
                {anomaliesData.categorySpikes.length > 0 && (
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center">
                      <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                      Category Spending Spikes
                    </h4>
                    <div className="space-y-2">
                      {anomaliesData.categorySpikes.map((spike) => (
                        <div key={spike.category_name} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <span className="text-lg">{spike.category_icon}</span>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {spike.category_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                Last month: {formatCurrency(spike.last_month)} → This month: {formatCurrency(spike.current_month)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold text-purple-600">
                              +{spike.increasePercent}%
                            </span>
                            <p className="text-xs text-gray-500">
                              +{formatCurrency(spike.current_month - spike.last_month)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {anomaliesData.largeTransactions.length === 0 && 
                 anomaliesData.duplicateTransactions.length === 0 && 
                 anomaliesData.frequentTransactions.length === 0 && 
                 anomaliesData.categorySpikes.length === 0 && (
                  <div className="text-center py-6 text-gray-500">
                    <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                    <p>No anomalies detected</p>
                    <p className="text-sm">Your spending patterns look normal</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p>Unable to analyze anomalies</p>
            <p className="text-sm">Please try again later</p>
          </div>
        )}
      </div>

    </div>
  );
}