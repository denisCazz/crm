import React, { useEffect, useState, useRef } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onFocus?: () => void;
  autoFocus?: boolean;
}

export function SearchBar({ 
  value, 
  onChange, 
  placeholder = "Cerca per nome, indirizzo o note…", 
  className = "",
  onFocus,
  autoFocus = false
}: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(localValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [localValue, onChange]);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const clearSearch = () => {
    setLocalValue("");
    onChange("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      clearSearch();
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search Icon */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">
        🔍
      </div>
      
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        placeholder={placeholder}
        className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl pl-10 pr-20 py-2.5 
                 outline-none focus:ring-2 focus:ring-neutral-600 focus:border-transparent
                 transition-all duration-200 placeholder-neutral-500"
      />
      
      {/* Clear Button */}
      {localValue && (
        <button
          onClick={clearSearch}
          className="absolute right-12 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200
                   transition-colors duration-200 p-1"
          title="Cancella ricerca"
        >
          ✕
        </button>
      )}
      
      {/* Keyboard Hint */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 text-xs pointer-events-none">
        {typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘K' : 'Ctrl+K'}
      </div>
    </div>
  );
}

// Hook per gestire il focus della search bar con keyboard shortcuts
export function useSearchFocus() {
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const focusSearch = () => {
    if (searchRef.current) {
      searchRef.current.focus();
      setSearchFocused(true);
    }
  };

  const blurSearch = () => {
    if (searchRef.current) {
      searchRef.current.blur();
      setSearchFocused(false);
    }
  };

  return {
    searchRef,
    searchFocused,
    focusSearch,
    blurSearch
  };
}