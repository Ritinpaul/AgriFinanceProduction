import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const tabs = [
  { path: '/', label: 'Home' },
  { path: '/onramp', label: 'On-Ramp' },
  { path: '/liquidity', label: 'Liquidity' },
  { path: '/loans', label: 'Loans' },
  { path: '/loan-requests', label: 'Requests' }
];

export default function MobileTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-gray-900 border-t border-gray-700 sm:hidden">
      <div className="grid grid-cols-5">
        {tabs.map(t => {
          const active = location.pathname === t.path;
          return (
            <button
              key={t.path}
              onClick={() => navigate(t.path)}
              className={`py-2 text-xs ${active ? 'text-green-400' : 'text-gray-300'}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}


