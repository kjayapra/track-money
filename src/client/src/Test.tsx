import React from 'react';

export default function Test() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold text-blue-600">
        ✅ React App is Working!
      </h1>
      <p className="text-lg text-gray-700 mt-4">
        If you can see this, the frontend is loading correctly.
      </p>
      <div className="mt-6 p-4 bg-green-100 border border-green-300 rounded-lg">
        <p className="text-green-800">
          🎉 Frontend server is running on http://localhost:5173
        </p>
      </div>
    </div>
  );
}