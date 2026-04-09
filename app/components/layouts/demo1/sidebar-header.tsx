'use client';

import Link from 'next/link';
import { ChevronFirst } from 'lucide-react';
import { toAbsoluteUrl } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { useSettings } from '@/providers/settings-provider';
import { Button } from '@/components/ui/button';

export function SidebarHeader() {
  const { settings, storeOption } = useSettings();

  const handleToggleClick = () => {
    storeOption(
      'layouts.demo1.sidebarCollapse',
      !settings.layouts.demo1.sidebarCollapse,
    );
  };

  return (
    <div className="sidebar-header hidden lg:flex items-center relative justify-between px-3 lg:px-6 shrink-0">
      <Link href="/" className="flex items-center gap-3">
        <div className="dark:hidden flex items-center gap-3">
          <img
            src={toAbsoluteUrl('/media/app/logo-p2tel.png')}
            className="default-logo h-[50px] max-w-none"
            alt="Default Logo"
          />
          <img
            src={toAbsoluteUrl('/media/app/logo-p2tel.png')}
            className="small-logo h-[35px] max-w-none"
            alt="Mini Logo"
          />
        </div>

        <div className="hidden dark:flex items-center gap-3">
          <img
            src={toAbsoluteUrl('/media/app/logo-p2tel.png')}
            className="default-logo h-[50px] max-w-none"
            alt="Default Dark Logo"
          />
          <img
            src={toAbsoluteUrl('/media/app/logo-p2tel.png')}
            className="small-logo h-[35px] max-w-none"
            alt="Mini Logo"
          />
        </div>

        {!settings.layouts.demo1.sidebarCollapse && (
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-semibold">SIPATEL</span>
            <span className="text-xs text-muted-foreground">
              Sistem Informasi P2TEL
            </span>
          </div>
        )}
      </Link>
      <Button
        onClick={handleToggleClick}
        size="sm"
        mode="icon"
        variant="outline"
        className={cn(
          'size-7 absolute start-full top-2/4 rtl:translate-x-2/4 -translate-x-2/4 -translate-y-2/4',
          settings.layouts.demo1.sidebarCollapse
            ? 'ltr:rotate-180'
            : 'rtl:rotate-180',
        )}
      >
        <ChevronFirst className="size-4!" />
      </Button>
    </div>
  );
}
