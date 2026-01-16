import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, X, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useFrequentProjects } from "@/hooks/useFrequentProjects";

export interface ProjectOption {
  id: string;
  project_name: string;
  project_code: string;
  created_at: string;
}

interface ProjectMultiSelectProps {
  projects: ProjectOption[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  maxSelection?: number;
  excludeIds?: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function ProjectMultiSelect({
  projects,
  selectedIds,
  onSelectionChange,
  maxSelection = 10,
  excludeIds = [],
  placeholder = "選擇要比較的案件...",
  disabled = false,
  className,
}: ProjectMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { sortByComparisonFrequency, recordComparisonSelection, getComparisonFrequency } = useFrequentProjects();

  const availableProjects = useMemo(() => {
    return projects.filter((p) => !excludeIds.includes(p.id));
  }, [projects, excludeIds]);

  // Sort by frequency, then filter by search query
  const filteredProjects = useMemo(() => {
    const sorted = sortByComparisonFrequency(availableProjects);
    if (!searchQuery) return sorted.slice(0, 50);
    const query = searchQuery.toLowerCase();
    return sorted
      .filter(
        (p) =>
          p.project_name.toLowerCase().includes(query) ||
          p.project_code.toLowerCase().includes(query)
      )
      .slice(0, 50);
  }, [availableProjects, searchQuery, sortByComparisonFrequency]);

  // Check if a project is frequently used
  const isFrequent = (projectId: string) => {
    return getComparisonFrequency(projectId) > 0;
  };
  const selectedProjects = useMemo(() => {
    return projects.filter((p) => selectedIds.includes(p.id));
  }, [projects, selectedIds]);

  const handleSelect = (projectId: string) => {
    if (selectedIds.includes(projectId)) {
      onSelectionChange(selectedIds.filter((id) => id !== projectId));
    } else if (selectedIds.length < maxSelection) {
      recordComparisonSelection(projectId);
      onSelectionChange([...selectedIds, projectId]);
    }
  };

  const handleRemove = (projectId: string) => {
    onSelectionChange(selectedIds.filter((id) => id !== projectId));
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className="text-muted-foreground">
              {placeholder} ({selectedIds.length}/{maxSelection})
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="輸入案件名稱或代碼..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>找不到符合的案件</CommandEmpty>
              <CommandGroup>
                {filteredProjects.map((project) => {
                  const isSelected = selectedIds.includes(project.id);
                  const canSelect = isSelected || selectedIds.length < maxSelection;
                  return (
                    <CommandItem
                      key={project.id}
                      value={project.id}
                      onSelect={() => handleSelect(project.id)}
                      disabled={!canSelect}
                      className={cn(!canSelect && "opacity-50")}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col flex-1">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{project.project_name}</span>
                          {isFrequent(project.id) && (
                            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {project.project_code} · {project.created_at.split("T")[0]}
                        </span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedProjects.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedProjects.map((project) => (
            <Badge
              key={project.id}
              variant="secondary"
              className="text-xs py-1 px-2"
            >
              {project.project_name}
              <button
                type="button"
                className="ml-1 hover:text-destructive"
                onClick={() => handleRemove(project.id)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
