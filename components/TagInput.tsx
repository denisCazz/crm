'use client';
import React, { useState, KeyboardEvent } from 'react';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

const TAG_PRESETS = [
  { label: 'Cliente Caldo', color: 'bg-danger/80 text-white' },
  { label: 'Prospect', color: 'bg-warning/80 text-white' },
  { label: 'Fornitore', color: 'bg-primary/80 text-white' },
  { label: 'Partner', color: 'bg-secondary/80 text-white' },
  { label: 'Lead', color: 'bg-success/80 text-white' },
  { label: 'Inattivo', color: 'bg-muted/50 text-foreground' }
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
    return preset?.color || 'bg-surface-elevated text-foreground';
  };

  return (
    <div className={`relative ${className}`}>
      {/* Tag Display */}
      <div className="input-field min-h-[42px] flex flex-wrap items-center gap-2 !py-2">
        {tags.map((tag, index) => (
          <span
            key={index}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${getTagColor(tag)} animate-scale-in`}
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
          className="flex-1 min-w-[100px] bg-transparent outline-none text-foreground placeholder-muted"
        />
      </div>

      {/* Preset Tags */}
      {showPresets && (
        <div className="dropdown-menu animate-slide-down">
          <div className="text-xs text-muted px-3 py-2">Tag suggeriti:</div>
          <div className="flex flex-wrap gap-1.5 px-3 pb-2">
            {TAG_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => addTag(preset.label)}
                disabled={tags.includes(preset.label)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  tags.includes(preset.label) 
                    ? 'opacity-40 cursor-not-allowed' 
                    : 'hover:scale-105 hover:shadow-lg'
                } ${preset.color}`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="divider my-0" />
          <div className="text-xs text-muted px-3 py-2">
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