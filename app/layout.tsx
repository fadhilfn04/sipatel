import { ReactNode, Suspense } from 'react';
import { Inter } from 'next/font/google';
import { cn } from '@/lib/utils';
import { SettingsProvider } from '@/providers/settings-provider';
import { TooltipsProvider } from '@/providers/tooltips-provider';
import { Toaster } from '@/components/ui/sonner';
import { Metadata } from 'next';
import { AuthProvider } from '@/providers/auth-provider';
import { I18nProvider } from '@/providers/i18n-provider';
import { ModulesProvider } from '@/providers/modules-provider';
import { QueryProvider } from '@/providers/query-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { UISettingsProvider } from '@/providers/ui-settings-provider';
import { UISettingsPanel } from '@/components/ui-settings/UISettingsPanel';

const inter = Inter({ subsets: ['latin'] });

import '@/css/styles.css';
import '@/components/keenicons/assets/styles.css';

export const metadata: Metadata = {
  title: {
    template: '%s | SIPATEL',
    default: 'SIPATEL', // a default is required when creating a template
  }
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html className="h-full" suppressHydrationWarning>
      <body
        className={cn(
          'antialiased flex h-full text-base text-foreground bg-background',
          inter.className,
        )}
      >
        <QueryProvider>
          <AuthProvider>
            <SettingsProvider>
              <UISettingsProvider>
                <ThemeProvider>
                  <I18nProvider>
                    <TooltipsProvider>
                      <ModulesProvider>
                        <Suspense>{children}</Suspense>
                        <UISettingsPanel />
                        <Toaster />
                      </ModulesProvider>
                    </TooltipsProvider>
                  </I18nProvider>
                </ThemeProvider>
              </UISettingsProvider>
            </SettingsProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
