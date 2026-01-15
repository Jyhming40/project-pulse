import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AGENCY_CODE_TO_LABEL,
  AGENCY_CODES,
  DOC_TYPE_DEFINITIONS,
  getDocTypesByAgency,
  getDocTypeLabelByCode,
  type AgencyCode,
} from '@/lib/docTypeMapping';

interface GroupedDocTypeSelectProps {
  value: string;
  onValueChange: (code: string, agencyCode: AgencyCode) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function GroupedDocTypeSelect({
  value,
  onValueChange,
  placeholder = '選擇文件類型',
  disabled = false,
  className,
}: GroupedDocTypeSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const groupedDocTypes = useMemo(() => getDocTypesByAgency(), []);

  // 過濾搜尋結果
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedDocTypes;

    const lowerQuery = searchQuery.toLowerCase();
    const result: Record<AgencyCode, typeof DOC_TYPE_DEFINITIONS> = {
      TPC: [],
      MOEA: [],
      LOCAL_GOV: [],
      BUILDING: [],
      ENGINEER: [],
      LAND: [],
      CONSTRUCTION: [],
      FIRE: [],
      INSURANCE: [],
      OTHER: [],
    };

    AGENCY_CODES.forEach(agencyCode => {
      const agencyLabel = AGENCY_CODE_TO_LABEL[agencyCode];
      const matchesAgency = agencyLabel.toLowerCase().includes(lowerQuery);

      const filtered = groupedDocTypes[agencyCode].filter(def => {
        return (
          matchesAgency ||
          def.label.toLowerCase().includes(lowerQuery) ||
          def.code.toLowerCase().includes(lowerQuery)
        );
      });

      result[agencyCode] = filtered;
    });

    return result;
  }, [groupedDocTypes, searchQuery]);

  // 檢查是否有任何結果
  const hasResults = useMemo(() => {
    return AGENCY_CODES.some(code => filteredGroups[code].length > 0);
  }, [filteredGroups]);

  const selectedLabel = value ? getDocTypeLabelByCode(value) : '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('justify-between font-normal', className)}
        >
          <span className="truncate">
            {selectedLabel || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[320px] p-0 bg-popover border shadow-lg z-50" 
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder="搜尋文件類型..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <CommandList className="max-h-[300px] overflow-y-auto overscroll-contain" style={{ scrollbarGutter: 'stable' }}>
            {!hasResults && (
              <CommandEmpty>找不到符合的文件類型</CommandEmpty>
            )}
            {AGENCY_CODES.map(agencyCode => {
              const items = filteredGroups[agencyCode];
              if (items.length === 0) return null;

              return (
                <CommandGroup
                  key={agencyCode}
                  heading={
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {AGENCY_CODE_TO_LABEL[agencyCode]}
                    </span>
                  }
                >
                  {items.map(def => (
                    <CommandItem
                      key={def.code}
                      value={def.code}
                      onSelect={() => {
                        onValueChange(def.code, def.agencyCode);
                        setOpen(false);
                        setSearchQuery('');
                      }}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === def.code ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {def.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
