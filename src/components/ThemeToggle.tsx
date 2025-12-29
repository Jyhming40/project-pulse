import { Moon, Sun, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme, ThemeColor } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

const colorThemes: { value: ThemeColor; label: string; colors: string[] }[] = [
  { value: 'teal', label: '專業青', colors: ['#2a9d8f', '#40b3a2', '#1a7a6f'] },
  { value: 'fire', label: '活力紅', colors: ['#FF4500', '#FF6347', '#FF0000'] },
];

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { mode, color, toggleMode, setColor, isDark } = useTheme();

  return (
    <div className={cn("flex items-center gap-1", collapsed ? "flex-col" : "")}>
      {/* Mode Toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleMode}
        className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        title={isDark ? '切換至淺色模式' : '切換至深色模式'}
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>

      {/* Color Theme Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            title="切換主題色"
          >
            <Palette className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>主題色彩</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {colorThemes.map((theme) => (
            <DropdownMenuItem
              key={theme.value}
              onClick={() => setColor(theme.value)}
              className={cn(
                "flex items-center gap-3 cursor-pointer",
                color === theme.value && "bg-accent"
              )}
            >
              <div className="flex gap-0.5">
                {theme.colors.map((c, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <span>{theme.label}</span>
              {color === theme.value && (
                <span className="ml-auto text-primary">✓</span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
