import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocumentArrowUpIcon, CheckCircleIcon, XCircleIcon, ClockIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

interface UploadedFile {
  id: string;
  original_name: string;
  file_size: number;
  transactions_count: number;
  processed_count: number;
  duplicate_count: number;
  status: 'processing' | 'completed' | 'failed';
  uploaded_at: string;
  processed_at: string | null;
  error_message: string | null;
}

interface Source {
  id: string;
  name: string;
  type: 'credit_card' | 'bank_account';
  last_four?: string;
  bank_name?: string;
  created_at: string;
}

export default function Upload() {
  const navigate = useNavigate();
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [recentFiles, setRecentFiles] = useState<UploadedFile[]>([]);
  const [loadingRecentFiles, setLoadingRecentFiles] = useState(true);
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [showNewSourceForm, setShowNewSourceForm] = useState(false);
  const [newSource, setNewSource] = useState({
    name: '',
    type: 'credit_card' as 'credit_card' | 'bank_account',
    lastFour: '',
    bankName: ''
  });

  useEffect(() => {
    fetchRecentFiles();
    fetchSources();
  }, []);

  const fetchRecentFiles = async () => {
    try {
      setLoadingRecentFiles(true);
      const response = await fetch('/api/uploaded-files');
      if (response.ok) {
        const data = await response.json();
        setRecentFiles(data.uploadedFiles);
      }
    } catch (error) {
      console.error('Error fetching recent files:', error);
    } finally {
      setLoadingRecentFiles(false);
    }
  };

  const fetchSources = async () => {
    try {
      const response = await fetch('/api/sources');
      if (response.ok) {
        const data = await response.json();
        setSources(data.sources);
        if (data.sources.length > 0 && !selectedSourceId) {
          setSelectedSourceId(data.sources[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching sources:', error);
    }
  };

  const createNewSource = async () => {
    if (!newSource.name.trim()) {
      alert('Please enter a name for the source');
      return;
    }

    try {
      const response = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSource.name,
          type: newSource.type,
          lastFour: newSource.lastFour || null,
          bankName: newSource.bankName || null
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSources(prev => [data.source, ...prev]);
        setSelectedSourceId(data.source.id);
        setShowNewSourceForm(false);
        setNewSource({
          name: '',
          type: 'credit_card',
          lastFour: '',
          bankName: ''
        });
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create source');
      }
    } catch (error) {
      console.error('Error creating source:', error);
      alert('Failed to create source');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (files: File[]) => {
    const validFiles = files.filter(file => 
      file.type === 'application/pdf' || 
      file.type === 'text/csv' ||
      file.type === 'application/vnd.ms-excel'
    );
    
    setUploadedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processFiles = async () => {
    if (uploadedFiles.length === 0) return;
    
    if (!selectedSourceId) {
      alert('Please select a source for the transactions');
      return;
    }
    
    setProcessing(true);
    
    try {
      for (const file of uploadedFiles) {
        const formData = new FormData();
        formData.append('statement', file);
        formData.append('sourceId', selectedSourceId);
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('File processed successfully:', result);
        } else {
          console.error('Upload failed:', response.statusText);
        }
      }
      
      // Clear uploaded files after processing
      setUploadedFiles([]);
      
      // Refresh recent files list
      await fetchRecentFiles();
      
      // Show success message and redirect to dashboard
      alert(`Successfully processed ${uploadedFiles.length} file(s)! Redirecting to dashboard...`);
      
      // Redirect to dashboard to see the uploaded data
      setTimeout(() => {
        navigate('/');
      }, 1000);
      
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload Statements</h1>
        <p className="text-gray-600">Upload your credit card statements for analysis</p>
      </div>

      {/* Upload Area */}
      <div className="card">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
          <div className="mt-4">
            <label htmlFor="file-upload" className="cursor-pointer">
              <span className="text-lg font-medium text-gray-900">
                Drop files here or{' '}
                <span className="text-blue-600 hover:text-blue-500">browse</span>
              </span>
              <input
                id="file-upload"
                name="file-upload"
                type="file"
                className="sr-only"
                multiple
                accept=".pdf,.csv,.xlsx"
                onChange={handleChange}
              />
            </label>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Supports PDF, CSV, and Excel files up to 10MB each
          </p>
        </div>
      </div>

      {/* Source Selection */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Select Transaction Source</h3>
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <select
              value={selectedSourceId}
              onChange={(e) => setSelectedSourceId(e.target.value)}
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a source...</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name} ({source.type.replace('_', ' ')})
                  {source.last_four && ` - ****${source.last_four}`}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowNewSourceForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              Add New
            </button>
          </div>
          
          {showNewSourceForm && (
            <div className="bg-gray-50 p-4 rounded-lg border">
              <h4 className="text-md font-medium text-gray-900 mb-3">Create New Source</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={newSource.name}
                    onChange={(e) => setNewSource(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Chase Freedom Card, Wells Fargo Checking"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={newSource.type}
                    onChange={(e) => setNewSource(prev => ({ ...prev, type: e.target.value as 'credit_card' | 'bank_account' }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="credit_card">Credit Card</option>
                    <option value="bank_account">Bank Account</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Four Digits</label>
                    <input
                      type="text"
                      value={newSource.lastFour}
                      onChange={(e) => setNewSource(prev => ({ ...prev, lastFour: e.target.value }))}
                      placeholder="1234"
                      maxLength={4}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={newSource.bankName}
                      onChange={(e) => setNewSource(prev => ({ ...prev, bankName: e.target.value }))}
                      placeholder="Chase, Wells Fargo, etc."
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={createNewSource}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                  >
                    Create Source
                  </button>
                  <button
                    onClick={() => setShowNewSourceForm(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Uploaded Files</h3>
          <div className="space-y-3">
            {uploadedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <DocumentArrowUpIcon className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="text-red-600 hover:text-red-800"
                >
                  <XCircleIcon className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
          
          <div className="mt-6">
            <button
              onClick={processFiles}
              disabled={processing}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                  Processing...
                </>
              ) : (
                'Process Files'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Recent Uploads */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Uploads</h3>
        
        {loadingRecentFiles ? (
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className="h-5 w-5 bg-gray-300 rounded mr-3"></div>
                  <div>
                    <div className="h-4 bg-gray-300 rounded w-32 mb-1"></div>
                    <div className="h-3 bg-gray-300 rounded w-24"></div>
                  </div>
                </div>
                <div className="h-4 bg-gray-300 rounded w-16"></div>
              </div>
            ))}
          </div>
        ) : recentFiles.length > 0 ? (
          <div className="space-y-3">
            {recentFiles.slice(0, 10).map((file) => {
              const getStatusIcon = () => {
                switch (file.status) {
                  case 'completed':
                    return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
                  case 'failed':
                    return <XCircleIcon className="h-5 w-5 text-red-600" />;
                  case 'processing':
                    return <ClockIcon className="h-5 w-5 text-yellow-600" />;
                  default:
                    return <DocumentTextIcon className="h-5 w-5 text-gray-400" />;
                }
              };

              const getBgColor = () => {
                switch (file.status) {
                  case 'completed':
                    return 'bg-green-50';
                  case 'failed':
                    return 'bg-red-50';
                  case 'processing':
                    return 'bg-yellow-50';
                  default:
                    return 'bg-gray-50';
                }
              };

              const getStatusText = () => {
                switch (file.status) {
                  case 'completed':
                    return `${file.processed_count} processed${file.duplicate_count > 0 ? `, ${file.duplicate_count} duplicates` : ''}`;
                  case 'failed':
                    return file.error_message || 'Processing failed';
                  case 'processing':
                    return 'Processing...';
                  default:
                    return 'Unknown status';
                }
              };

              return (
                <div key={file.id} className={`flex items-center justify-between p-3 rounded-lg ${getBgColor()}`}>
                  <div className="flex items-center">
                    {getStatusIcon()}
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">{file.original_name}</p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.file_size)} • {formatDate(file.uploaded_at)}
                      </p>
                      <p className="text-xs text-gray-600">{getStatusText()}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium capitalize ${
                    file.status === 'completed' ? 'text-green-600' :
                    file.status === 'failed' ? 'text-red-600' :
                    file.status === 'processing' ? 'text-yellow-600' : 'text-gray-600'
                  }`}>
                    {file.status}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p>No files uploaded yet</p>
            <p className="text-sm">Upload your first statement to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}