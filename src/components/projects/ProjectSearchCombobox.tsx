import { useState, useMemo, useEffect } from "react";
import { Check, ChevronsUpDown, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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

interface ProjectSearchComboboxProps {
  projects: ProjectOption[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function ProjectSearchCombobox({
  projects,
  value,
  onValueChange,
  placeholder = "搜尋或選擇案件...",
  disabled = false,
  className,
}: ProjectSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { sortByBaselineFrequency, recordBaselineSelection, getBaselineFrequency } = useFrequentProjects();

  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === value);
  }, [projects, value]);

  // Sort projects by frequency, then filter by search query
  const filteredProjects = useMemo(() => {
    const sorted = sortByBaselineFrequency(projects);
    if (!searchQuery) return sorted.slice(0, 50);
    const query = searchQuery.toLowerCase();
    return sorted
      .filter(
        (p) =>
          p.project_name.toLowerCase().includes(query) ||
          p.project_code.toLowerCase().includes(query)
      )
      .slice(0, 50);
  }, [projects, searchQuery, sortByBaselineFrequency]);

  // Check if a project is frequently used (top 5)
  const isFrequent = (projectId: string) => {
    return getBaselineFrequency(projectId) > 0;
  };

  const handleSelect = (projectId: string) => {
    if (projectId !== value) {
      recordBaselineSelection(projectId);
    }
    onValueChange(projectId === value ? null : projectId);
    setOpen(false);
    setSearchQuery("");
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          {selectedProject ? (
            <span className="truncate">
              {selectedProject.project_name} ({selectedProject.project_code})
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
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
              {filteredProjects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={project.id}
                  onSelect={() => handleSelect(project.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === project.id ? "opacity-100" : "opacity-0"
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
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
