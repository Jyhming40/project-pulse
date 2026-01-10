import { useState, useEffect, useRef } from 'react';
import { Search, X, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SearchInputWithHistoryProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  storageKey?: string;
  maxHistory?: number;
  className?: string;
}

export function SearchInputWithHistory({
  value,
  onChange,
  placeholder = '搜尋...',
  storageKey = 'search-history',
  maxHistory = 6,
  className,
}: SearchInputWithHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load history from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setHistory(parsed.slice(0, maxHistory));
        }
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, [storageKey, maxHistory]);

  // Save history to localStorage
  const saveHistory = (newHistory: string[]) => {
    setHistory(newHistory);
    localStorage.setItem(storageKey, JSON.stringify(newHistory));
  };

  // Add search term to history
  const addToHistory = (term: string) => {
    if (!term.trim()) return;
    const trimmed = term.trim();
    // Remove duplicates and add to front
    const newHistory = [trimmed, ...history.filter(h => h !== trimmed)].slice(0, maxHistory);
    saveHistory(newHistory);
  };

  // Remove single item from history
  const removeFromHistory = (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newHistory = history.filter(h => h !== term);
    saveHistory(newHistory);
  };

  // Handle input key down
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value.trim()) {
      addToHistory(value);
      setIsOpen(false);
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Handle selecting from history
  const handleSelectHistory = (term: string) => {
    onChange(term);
    addToHistory(term);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 pointer-events-none" />
      <Input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        className="pl-10 pr-8"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* History Dropdown */}
      {isOpen && history.length > 0 && !value && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-[100] overflow-hidden">
          <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border flex items-center gap-1">
            <Clock className="h-3 w-3" />
            最近搜尋
          </div>
          <ul className="max-h-[200px] overflow-auto">
            {history.map((term, index) => (
              <li key={`${storageKey}-${index}`}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectHistory(term)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleSelectHistory(term);
                    }
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center justify-between group cursor-pointer"
                >
                  <span className="truncate flex-1">{term}</span>
                  <button
                    type="button"
                    onClick={(e) => removeFromHistory(term, e)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity ml-2 shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
