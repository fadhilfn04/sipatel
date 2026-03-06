'use client';

import { useSettings } from '@/providers/settings-provider';
import { DashboardPage } from './components/dashboard';

export default function Page() {
  const { settings } = useSettings();

  // Always use Demo1 layout regardless of settings
  return <DashboardPage />;
}
