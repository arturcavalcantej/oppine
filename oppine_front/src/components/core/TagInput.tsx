import { useState, useRef, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  disabled?: boolean;
}

export default function TagInput({
  tags,
  onChange,
  suggestions = [],
  placeholder = 'Add tags...',
  disabled = false,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on input and exclude already added tags
  const filteredSuggestions = suggestions.filter(
    (suggestion) =>
      suggestion.toLowerCase().includes(inputValue.toLowerCase()) &&
      !tags.includes(suggestion)
  );

  const addTag = useCallback(
    (tag: string) => {
      const trimmedTag = tag.trim().toLowerCase();
      if (trimmedTag && !tags.includes(trimmedTag)) {
        onChange([...tags, trimmedTag]);
      }
      setInputValue('');
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    },
    [tags, onChange]
  );

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (highlightedIndex >= 0 && filteredSuggestions[highlightedIndex]) {
        addTag(filteredSuggestions[highlightedIndex]);
      } else if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // If user types a comma, add the tag
    if (value.includes(',')) {
      const parts = value.split(',');
      parts.forEach((part, index) => {
        if (index < parts.length - 1 && part.trim()) {
          addTag(part);
        }
      });
      setInputValue(parts[parts.length - 1]);
    } else {
      setInputValue(value);
      setShowSuggestions(value.length > 0 && filteredSuggestions.length > 0);
      setHighlightedIndex(-1);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex flex-wrap gap-1.5 p-2 min-h-[46px] bg-secondary border border-border rounded-xl transition-all ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-text'
        } focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20`}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Tag Pills */}
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-sm rounded-lg bg-accent/10 text-accent border border-accent/30"
          >
            #{tag}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(tag);
                }}
                className="ml-0.5 hover:bg-accent/20 rounded p-0.5 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (inputValue && filteredSuggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          placeholder={tags.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-border rounded-xl shadow-lg overflow-hidden">
          <div className="py-1 max-h-[200px] overflow-y-auto">
            {filteredSuggestions.slice(0, 8).map((suggestion, index) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => addTag(suggestion)}
                className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                  index === highlightedIndex
                    ? 'bg-accent/10 text-accent'
                    : 'text-foreground hover:bg-secondary'
                }`}
              >
                #{suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Helper text */}
      <p className="text-xs text-muted-foreground mt-1.5">
        Press Enter or comma to add a tag
      </p>
    </div>
  );
}
