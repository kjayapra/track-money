import React from 'react';

export default function AnalyticsSimple() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600">Your spending analytics will appear here</p>
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Coming Soon</h2>
        <p className="text-gray-600">
          Analytics features are being developed. This page will show:
        </p>
        <ul className="mt-2 list-disc list-inside text-gray-600">
          <li>Period-over-period spending comparisons</li>
          <li>Category breakdown and trends</li>
          <li>Card usage analysis</li>
          <li>Location-based spending patterns</li>
          <li>Monthly spending trends</li>
        </ul>
      </div>
    </div>
  );
}