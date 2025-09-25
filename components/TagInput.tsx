'use client';
import React, { useState, KeyboardEvent } from 'react';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

const TAG_PRESETS = [
  { label: 'Cliente Caldo', color: 'bg-red-600 text-red-100' },
  { label: 'Prospect', color: 'bg-yellow-600 text-yellow-100' },
  { label: 'Fornitore', color: 'bg-blue-600 text-blue-100' },
  { label: 'Partner', color: 'bg-purple-600 text-purple-100' },
  { label: 'Lead', color: 'bg-green-600 text-green-100' },
  { label: 'Inattivo', color: 'bg-gray-600 text-gray-100' }
];

export function TagInput({ tags, onChange, placeholder = "Aggiungi tag...", className }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showPresets, setShowPresets] = useState(false);

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      onChange([...tags, trimmedTag]);
    }
    setInputValue('');
    setShowPresets(false);
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const getTagColor = (tag: string) => {
    const preset = TAG_PRESETS.find(p => p.label.toLowerCase() === tag.toLowerCase());
    return preset?.color || 'bg-neutral-700 text-neutral-200';
  };

  return (
    <div className={`relative ${className}`}>
      {/* Tag Display */}
      <div className="min-h-[42px] bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 flex flex-wrap items-center gap-2">
        {tags.map((tag, index) => (
          <span
            key={index}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${getTagColor(tag)}`}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:bg-white/20 rounded p-0.5 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        
        {/* Input */}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowPresets(true)}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[100px] bg-transparent outline-none text-white placeholder-neutral-500"
        />
      </div>

      {/* Preset Tags */}
      {showPresets && (
        <div className="absolute z-10 w-full mt-1 bg-neutral-900 border border-neutral-700 rounded-xl shadow-lg p-2">
          <div className="text-xs text-neutral-400 mb-2">Tag suggeriti:</div>
          <div className="flex flex-wrap gap-1">
            {TAG_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => addTag(preset.label)}
                disabled={tags.includes(preset.label)}
                className={`px-2 py-1 rounded-lg text-xs font-medium transition-opacity ${
                  tags.includes(preset.label) 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:opacity-80'
                } ${preset.color}`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="text-xs text-neutral-500 mt-2">
            Digita e premi Enter per creare tag personalizzati
          </div>
        </div>
      )}

      {/* Click outside to close presets */}
      {showPresets && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setShowPresets(false)}
        />
      )}
    </div>
  );
}