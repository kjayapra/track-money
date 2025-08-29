import React, { useState, useEffect } from 'react';
import { 
  CalendarIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

interface AnalyticsData {
  period: {
    type: string;
    current: {
      start: string;
      end: string;
      total: number;
    };
  };
}

export default function AnalyticsDebug() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('Analytics component mounted');
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      console.log('Starting analytics fetch...');
      setLoading(true);
      const response = await fetch('/api/analytics/advanced?period=month');
      console.log('Response received:', response.status);
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }
      
      const analyticsData = await response.json();
      console.log('Analytics data:', analyticsData);
      setData(analyticsData);
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

  console.log('Rendering analytics component', { loading, error, data });

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics (Debug)</h1>
          <p className="text-gray-600">Loading your analytics...</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-4">
          <p className="text-blue-700">Loading state is active</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics (Debug)</h1>
          <p className="text-gray-600">Error state</p>
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics (Debug)</h1>
        <p className="text-gray-600">Debug version - basic functionality</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <CalendarIcon className="h-5 w-5 mr-2" />
            Basic Period Info
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Period Type</h4>
            <p className="text-lg font-bold text-gray-900">{data.period.type}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Current Total</h4>
            <p className="text-lg font-bold text-gray-900">
              {formatCurrency(data.period.current.total)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded p-4">
        <p className="text-green-700">✅ Analytics component rendered successfully!</p>
        <p className="text-green-600 text-sm mt-1">
          Data loaded: {data.period.current.start} to {data.period.current.end}
        </p>
      </div>
    </div>
  );
}