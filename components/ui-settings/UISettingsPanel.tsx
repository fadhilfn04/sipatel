'use client';

import { Settings2, RotateCcw, Type, Palette, AlignLeft, Check } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useUISettings,
  FONT_SIZES,
  FONT_FAMILIES,
  SIDEBAR_COLORS,
  type FontSize,
  type FontFamily,
  type SidebarColor,
} from '@/providers/ui-settings-provider';

export function UISettingsPanel() {
  const { uiSettings, setFontSize, setFontFamily, setSidebarColor, resetSettings } = useUISettings();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className={cn(
            'fixed bottom-6 right-6 z-50',
            'h-14 w-14 rounded-full shadow-lg',
            'bg-primary text-primary-foreground',
            'flex items-center justify-center',
            'hover:scale-110 transition-transform duration-200',
            'focus:outline-none focus:ring-4 focus:ring-primary/40',
          )}
          title="Pengaturan Tampilan"
          aria-label="Buka pengaturan tampilan"
        >
          <Settings2 className="h-6 w-6" />
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Settings2 className="h-5 w-5" />
            Pengaturan Tampilan
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            Sesuaikan tampilan untuk kenyamanan membaca
          </p>
        </SheetHeader>

        <div className="space-y-8 py-6">

          {/* Font Size */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Type className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-base">Ukuran Huruf</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(FONT_SIZES) as [FontSize, typeof FONT_SIZES[FontSize]][]).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => setFontSize(key)}
                  className={cn(
                    'relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                    uiSettings.fontSize === key
                      ? 'border-primary bg-primary/8'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50',
                  )}
                >
                  {uiSettings.fontSize === key && (
                    <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </span>
                  )}
                  <span style={{ fontSize: val.px, lineHeight: 1 }} className="font-bold text-foreground">
                    Aa
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">{val.label}</span>
                  <span className="text-xs text-muted-foreground">{val.px}</span>
                </button>
              ))}
            </div>

            {/* Live preview */}
            <div className="border rounded-xl p-4 bg-muted/30">
              <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Pratinjau Teks</p>
              <p className="font-medium">Pengajuan Dana Kematian</p>
              <p className="text-muted-foreground text-sm mt-1">
                Dokumen persyaratan perlu dilengkapi sebelum pengajuan diproses.
              </p>
            </div>
          </section>

          {/* Font Family */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <AlignLeft className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-base">Jenis Huruf</h3>
            </div>
            <div className="space-y-2">
              {(Object.entries(FONT_FAMILIES) as [FontFamily, typeof FONT_FAMILIES[FontFamily]][]).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => setFontFamily(key)}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left',
                    uiSettings.fontFamily === key
                      ? 'border-primary bg-primary/8'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50',
                  )}
                >
                  <div>
                    <p
                      className="font-medium text-base"
                      style={{ fontFamily: val.family }}
                    >
                      {val.label}
                    </p>
                    <p
                      className="text-sm text-muted-foreground mt-0.5"
                      style={{ fontFamily: val.family }}
                    >
                      Abcdefg 1234567
                    </p>
                  </div>
                  {uiSettings.fontFamily === key && (
                    <span className="h-6 w-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <Check className="h-3.5 w-3.5 text-primary-foreground" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Sidebar Color */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-base">Warna Sidebar</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(Object.entries(SIDEBAR_COLORS) as [SidebarColor, typeof SIDEBAR_COLORS[SidebarColor]][]).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => setSidebarColor(key)}
                  className={cn(
                    'relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all',
                    uiSettings.sidebarColor === key
                      ? 'border-primary'
                      : 'border-border hover:border-primary/50',
                  )}
                >
                  <div
                    className={cn(
                      'h-10 w-full rounded-lg',
                      val.preview,
                    )}
                  />
                  <span className="text-xs text-muted-foreground font-medium text-center leading-tight">
                    {val.label}
                  </span>
                  {uiSettings.sidebarColor === key && (
                    <span className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-primary-foreground" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Reset */}
          <section className="border-t pt-6">
            <Button
              variant="outline"
              className="w-full"
              onClick={resetSettings}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset ke Pengaturan Default
            </Button>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
