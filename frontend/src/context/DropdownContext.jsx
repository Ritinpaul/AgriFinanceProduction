import React, { createContext, useContext, useState, useCallback } from 'react';

const DropdownContext = createContext(null);

export const DropdownProvider = ({ children }) => {
  const [openDropdown, setOpenDropdown] = useState(null);

  const openDropdownById = useCallback((dropdownId) => {
    try {
      setOpenDropdown(dropdownId);
    } catch (error) {
      console.error('Error opening dropdown:', error);
    }
  }, []);

  const closeDropdown = useCallback(() => {
    try {
      setOpenDropdown(null);
    } catch (error) {
      console.error('Error closing dropdown:', error);
    }
  }, []);

  const isDropdownOpen = useCallback((dropdownId) => {
    return openDropdown === dropdownId;
  }, [openDropdown]);

  // Also export a helper to check if any dropdown is open
  const hasOpenDropdown = openDropdown !== null;

  const value = {
    openDropdown,
    openDropdownById,
    closeDropdown,
    isDropdownOpen,
    hasOpenDropdown
  };

  // Validate children prop
  if (!children) {
    console.warn('DropdownProvider: No children provided');
    return null;
  }

  return (
    <DropdownContext.Provider value={value}>
      {children}
    </DropdownContext.Provider>
  );
};

export const useDropdown = () => {
  const context = useContext(DropdownContext);
  if (!context) {
    throw new Error('useDropdown must be used within DropdownProvider');
  }
  return context;
};

