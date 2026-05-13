'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSettings } from '@/providers/settings-provider';
import { useUISettings, SIDEBAR_COLORS } from '@/providers/ui-settings-provider';
import { SidebarHeader } from './sidebar-header';
import { SidebarMenu } from './sidebar-menu';

export function Sidebar() {
  const { settings } = useSettings();
  const { uiSettings } = useUISettings();
  const pathname = usePathname();

  const colorConfig = SIDEBAR_COLORS[uiSettings.sidebarColor];
  const useCustomColor = uiSettings.sidebarColor !== 'default';
  const themeDark =
    settings.layouts.demo1.sidebarTheme === 'dark' ||
    pathname.includes('dark-sidebar') ||
    (useCustomColor && colorConfig.dark);

  return (
    <div
      className={cn(
        'sidebar lg:border-e lg:border-border lg:fixed lg:top-0 lg:bottom-0 lg:z-20 lg:flex flex-col items-stretch shrink-0',
        useCustomColor ? '' : 'bg-background',
        themeDark && 'dark',
      )}
      style={useCustomColor ? { backgroundColor: colorConfig.bg } : undefined}
    >
      <SidebarHeader />
      <div className="overflow-hidden">
        <div className="w-(--sidebar-default-width)">
          <SidebarMenu />
        </div>
      </div>
    </div>
  );
}
