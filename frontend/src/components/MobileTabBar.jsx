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
    <nav className="fixed bottom-0 inset-x-0 z-40 sm:hidden" style={{ background: 'rgba(13, 31, 23, 0.9)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: '1px solid rgba(82, 183, 136, 0.1)' }}>
      <div className="grid grid-cols-5">
        {tabs.map(t => {
          const active = location.pathname === t.path;
          return (
            <button
              key={t.path}
              onClick={() => navigate(t.path)}
              className={`py-3 text-xs font-medium transition-colors ${active ? 'text-agri-leaf' : 'text-gray-400 hover:text-gray-300'}`}
            >
              {active && <div className="w-1 h-1 rounded-full bg-agri-leaf mx-auto mb-1"></div>}
              {t.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
