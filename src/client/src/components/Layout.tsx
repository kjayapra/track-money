import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  CreditCardIcon,
  DocumentArrowUpIcon,
  ChartBarIcon,
  ChatBubbleBottomCenterTextIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Transactions', href: '/transactions', icon: CreditCardIcon },
  { name: 'Upload', href: '/upload', icon: DocumentArrowUpIcon },
  { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
  { name: 'AI Chat', href: '/chat', icon: ChatBubbleBottomCenterTextIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
];

interface LayoutProps {
  children: React.ReactNode;
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white shadow-sm">
          <div className="flex flex-col h-screen">
            <div className="flex items-center px-6 py-4 border-b border-gray-200">
              <h1 className="text-xl font-bold text-gray-900">Credit Tracker</h1>
            </div>
            <nav className="flex-1 px-4 py-4 space-y-2">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={classNames(
                      isActive
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                        : 'text-gray-700 hover:bg-gray-50',
                      'group flex items-center px-3 py-2 text-sm font-medium rounded-md'
                    )}
                  >
                    <item.icon
                      className={classNames(
                        isActive ? 'text-blue-500' : 'text-gray-400',
                        'mr-3 h-5 w-5'
                      )}
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1">
          <main className="p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}