import React, { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, EyeIcon, DocumentTextIcon, FunnelIcon, XMarkIcon, PencilIcon, CheckIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface Transaction {
  id: string;
  description: string;
  merchantName: string;
  amount: number;
  date: string;
  originalText: string;
  createdAt: string;
  cardNumber: string;
  transactionType: string;
  location: string;
  memo: string;
  referenceId: string;
  statementPeriod: string;
  category: {
    name: string;
    icon: string;
    color: string;
  };
  source?: {
    id: string;
    name: string;
    type: string;
    lastFour?: string;
    bankName?: string;
  } | null;
}

interface TransactionsResponse {
  transactions: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface FilterOptions {
  categories: Array<{
    id: string;
    name: string;
    icon: string;
    color: string;
  }>;
  cardNumbers: string[];
  dateRange: {
    minDate: string | null;
    maxDate: string | null;
  };
  transactionTypes: string[];
}

export default function Transactions() {
  const [data, setData] = useState<TransactionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  
  // Filter options from backend
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [loadingFilters, setLoadingFilters] = useState(true);
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCard, setSelectedCard] = useState('');
  const [transactionType, setTransactionType] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [dateRangePreset, setDateRangePreset] = useState('');
  
  // Manual recategorization states
  const [editingTransaction, setEditingTransaction] = useState<string | null>(null);
  const [newCategoryId, setNewCategoryId] = useState('');
  const [updatingCategory, setUpdatingCategory] = useState(false);

  useEffect(() => {
    fetchTransactions();
    if (currentPage === 1) { // Only fetch filter options once
      fetchFilterOptions();
    }
  }, [currentPage, searchTerm, dateFrom, dateTo, selectedCategory, selectedCard, transactionType, amountMin, amountMax]);

  // Reset page to 1 when any filter changes
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [searchTerm, dateFrom, dateTo, selectedCategory, selectedCard, transactionType, amountMin, amountMax]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      
      // Build query parameters
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', '20');
      
      if (searchTerm) params.append('search', searchTerm);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedCard) params.append('cardNumber', selectedCard);
      if (transactionType) params.append('transactionType', transactionType);
      if (amountMin) params.append('amountMin', amountMin);
      if (amountMax) params.append('amountMax', amountMax);
      
      const response = await fetch(`/api/transactions?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }
      
      const transactionData = await response.json();
      setData(transactionData);
    } catch (err) {
      console.error('Transactions fetch error:', err);
      setError('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      setLoadingFilters(true);
      const response = await fetch('/api/transactions/filter-options');
      
      if (!response.ok) {
        throw new Error('Failed to fetch filter options');
      }
      
      const options = await response.json();
      console.log('Filter options from backend:', options);
      setFilterOptions(options);
    } catch (err) {
      console.error('Filter options fetch error:', err);
    } finally {
      setLoadingFilters(false);
    }
  };

  const updateTransactionCategory = async (transactionId: string, categoryId: string) => {
    try {
      setUpdatingCategory(true);
      const response = await fetch(`/api/transactions/${transactionId}/category`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ categoryId }),
      });

      if (!response.ok) {
        throw new Error('Failed to update transaction category');
      }

      // Refresh transactions to show updated category
      await fetchTransactions();
      setEditingTransaction(null);
      setNewCategoryId('');
    } catch (err) {
      console.error('Category update error:', err);
      alert('Failed to update category. Please try again.');
    } finally {
      setUpdatingCategory(false);
    }
  };

  // All filtering is now done on the backend
  const transactions = data?.transactions || [];

  // Date range presets
  const setDateRangePresetHandler = (preset: string) => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
    const sevenDaysAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
    
    setDateRangePreset(preset);
    
    switch (preset) {
      case 'last-7-days':
        setDateFrom(sevenDaysAgo.toISOString().split('T')[0]);
        setDateTo(today.toISOString().split('T')[0]);
        break;
      case 'last-30-days':
        setDateFrom(thirtyDaysAgo.toISOString().split('T')[0]);
        setDateTo(today.toISOString().split('T')[0]);
        break;
      case 'this-month':
        setDateFrom(startOfMonth.toISOString().split('T')[0]);
        setDateTo(today.toISOString().split('T')[0]);
        break;
      case 'this-year':
        setDateFrom(startOfYear.toISOString().split('T')[0]);
        setDateTo(today.toISOString().split('T')[0]);
        break;
      case 'custom':
        // User will set custom dates
        break;
      default:
        setDateFrom('');
        setDateTo('');
    }
  };

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSelectedCategory('');
    setSelectedCard('');
    setTransactionType('');
    setAmountMin('');
    setAmountMax('');
    setSearchTerm('');
    setDateRangePreset('');
  };

  const hasActiveFilters = dateFrom || dateTo || selectedCategory || selectedCard || 
                          transactionType || amountMin || amountMax || searchTerm;

  const formatCurrency = (amount: number) => {
    const abs = Math.abs(amount);
    const sign = amount < 0 ? '-' : '+';
    return `${sign}$${abs.toFixed(2)}`;
  };

  const startEditingCategory = (transaction: Transaction) => {
    setEditingTransaction(transaction.id);
    const currentCategory = filterOptions?.categories.find(c => c.name === transaction.category.name);
    setNewCategoryId(currentCategory?.id || '');
  };

  const cancelEditingCategory = () => {
    setEditingTransaction(null);
    setNewCategoryId('');
  };

  const saveNewCategory = () => {
    if (editingTransaction && newCategoryId) {
      updateTransactionCategory(editingTransaction, newCategoryId);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-600">Loading your transactions...</p>
        </div>
        <div className="animate-pulse">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-4 mb-4">
              <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-300 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-600">Error loading transactions</p>
        </div>
        <div className="bg-red-50 border border-red-300 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
          <button 
            onClick={fetchTransactions}
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
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <p className="text-gray-600">
          {hasActiveFilters ? (
            <>
              Showing {((data?.pagination.page || 1) - 1) * 20 + 1}-{Math.min((data?.pagination.page || 1) * 20, data?.pagination.total || 0)} of {data?.pagination.total || 0} filtered transactions
              <span className="text-blue-600 font-medium"> (filtered)</span>
            </>
          ) : (
            <>
              {transactions.length} of {data?.pagination.total} transactions
            </>
          )}
        </p>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border rounded-lg flex items-center space-x-2 ${
              showFilters || hasActiveFilters
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FunnelIcon className="h-5 w-5" />
            <span>Filters</span>
            {hasActiveFilters && (
              <span className="bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                •
              </span>
            )}
          </button>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
            >
              <XMarkIcon className="h-5 w-5" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            {/* Date Range with Presets */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: '', label: 'All Time' },
                      { value: 'last-7-days', label: 'Last 7 Days' },
                      { value: 'last-30-days', label: 'Last 30 Days' },
                      { value: 'this-month', label: 'This Month' },
                      { value: 'this-year', label: 'This Year' },
                      { value: 'custom', label: 'Custom' },
                    ].map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => setDateRangePresetHandler(preset.value)}
                        className={`px-3 py-1 text-sm rounded-full border ${
                          dateRangePreset === preset.value
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  
                  {(dateRangePreset === 'custom' || dateRangePreset === '') && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">From</label>
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          max={filterOptions?.dateRange.maxDate || undefined}
                          min={filterOptions?.dateRange.minDate || undefined}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">To</label>
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          max={filterOptions?.dateRange.maxDate || undefined}
                          min={dateFrom || filterOptions?.dateRange.minDate || undefined}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount Range</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Min ($)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={amountMin}
                      onChange={(e) => setAmountMin(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Max ($)</label>
                    <input
                      type="number"
                      placeholder="999999"
                      value={amountMax}
                      onChange={(e) => setAmountMax(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                {loadingFilters ? (
                  <div className="animate-pulse h-10 bg-gray-200 rounded-md"></div>
                ) : (
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Categories</option>
                    {filterOptions?.categories.map(category => (
                      <option key={category.id} value={category.name}>
                        {category.icon} {category.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Card Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Card</label>
                {loadingFilters ? (
                  <div className="animate-pulse h-10 bg-gray-200 rounded-md"></div>
                ) : (
                  <select
                    value={selectedCard}
                    onChange={(e) => setSelectedCard(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Cards</option>
                    {filterOptions?.cardNumbers.map(card => (
                      <option key={card} value={card}>****{card}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Transaction Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                {loadingFilters ? (
                  <div className="animate-pulse h-10 bg-gray-200 rounded-md"></div>
                ) : (
                  <select
                    value={transactionType}
                    onChange={(e) => setTransactionType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Types</option>
                    {filterOptions?.transactionTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transactions List */}
      <div className="space-y-3">
        {transactions.length === 0 ? (
          <div className="text-center py-12">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No transactions found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {hasActiveFilters ? 'Try adjusting your filters.' : 'Upload some statements to get started.'}
            </p>
          </div>
        ) : (
          transactions.map((transaction) => (
            <div key={transaction.id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200">
              {/* Main Transaction Row */}
              <div className="flex items-center justify-between p-4">
                {/* Left Section - Icon, Merchant Info */}
                <div className="flex items-center space-x-4 flex-1">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                      <span className="text-2xl">{transaction.category.icon}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-gray-900 truncate">
                          {transaction.merchantName || transaction.description}
                        </h3>
                        {transaction.merchantName && transaction.description !== transaction.merchantName && (
                          <p className="text-sm text-gray-600 truncate mt-1">
                            {transaction.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Middle Section - Category & Metadata */}
                <div className="flex items-center space-x-6 px-4">
                  {editingTransaction === transaction.id ? (
                    <div className="flex items-center space-x-2">
                      <select
                        value={newCategoryId}
                        onChange={(e) => setNewCategoryId(e.target.value)}
                        className="text-sm px-3 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={updatingCategory}
                      >
                        <option value="">Select category...</option>
                        {filterOptions?.categories.map(category => (
                          <option key={category.id} value={category.id}>
                            {category.icon} {category.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={saveNewCategory}
                        disabled={!newCategoryId || updatingCategory}
                        className="p-1 text-green-600 hover:text-green-800 disabled:opacity-50"
                      >
                        <CheckIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={cancelEditingCategory}
                        disabled={updatingCategory}
                        className="p-1 text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        <XCircleIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <span
                          className="inline-flex px-3 py-1 text-sm rounded-full font-medium"
                          style={{ 
                            backgroundColor: `${transaction.category.color}20`,
                            color: transaction.category.color 
                          }}
                        >
                          {transaction.category.name}
                        </span>
                        <button
                          onClick={() => startEditingCategory(transaction)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          title="Edit category"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-900">
                      {new Date(transaction.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                    {transaction.source ? (
                      <div className="text-xs text-gray-500 mt-1">
                        {transaction.source.name}
                        {transaction.source.lastFour && ` ••••${transaction.source.lastFour}`}
                      </div>
                    ) : transaction.cardNumber && (
                      <div className="text-xs text-gray-500 mt-1">••••{transaction.cardNumber}</div>
                    )}
                  </div>
                </div>

                {/* Right Section - Amount & Actions */}
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className={`text-xl font-bold ${
                      transaction.amount < 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {formatCurrency(transaction.amount)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {transaction.amount < 0 ? 'Expense' : 'Income'}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedTransaction(transaction)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors"
                    title="View details"
                  >
                    <EyeIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(Math.min(data.pagination.totalPages, currentPage + 1))}
              disabled={currentPage === data.pagination.totalPages}
              className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing page <span className="font-medium">{currentPage}</span> of{' '}
                <span className="font-medium">{data.pagination.totalPages}</span>
                {hasActiveFilters && <span className="text-blue-600"> (filtered)</span>}
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(data.pagination.totalPages, currentPage + 1))}
                  disabled={currentPage === data.pagination.totalPages}
                  className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Transaction Details</h3>
              <button
                onClick={() => setSelectedTransaction(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Merchant</label>
                <p className="text-sm text-gray-900">{selectedTransaction.merchantName}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <p className="text-sm text-gray-900">{selectedTransaction.description}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Amount</label>
                <p className={`text-sm font-semibold ${
                  selectedTransaction.amount < 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {formatCurrency(selectedTransaction.amount)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Date</label>
                <p className="text-sm text-gray-900">{new Date(selectedTransaction.date).toLocaleDateString()}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Card</label>
                <p className="text-sm text-gray-900">****{selectedTransaction.cardNumber}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <span className={`inline-flex px-2 py-1 text-xs rounded-full font-medium ${selectedTransaction.category.color}`}>
                  {selectedTransaction.category.icon} {selectedTransaction.category.name}
                </span>
              </div>
              {selectedTransaction.location && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Location</label>
                  <p className="text-sm text-gray-900">{selectedTransaction.location}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">Original Text</label>
                <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded font-mono">
                  {selectedTransaction.originalText}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}