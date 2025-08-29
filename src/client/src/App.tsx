import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import SimpleDashboard from './pages/SimpleDashboard';
import Transactions from './pages/Transactions';
import Upload from './pages/Upload';
import Analytics from './pages/AnalyticsWorking';
import Settings from './pages/Settings';
import Chat from './pages/Chat';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<SimpleDashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}

export default App;