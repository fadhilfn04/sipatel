'use client';

import { Fragment, useState, useEffect } from 'react';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/toolbar';
import { Container } from '@/components/common/container';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown, Download, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useLabaRugi } from '@/lib/hooks/use-laba-rugi-api';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function LabaRugiPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  // Calculate date range based on selected period
  const getDateRange = () => {
    const now = new Date();
    const from = new Date();

    switch (selectedPeriod) {
      case 'month':
        from.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        from.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        from.setFullYear(now.getFullYear() - 1);
        break;
    }

    return {
      from: from.toISOString().split('T')[0],
      to: now.toISOString().split('T')[0],
    };
  };

  const dateRange = getDateRange();

  // Fetch laba rugi data
  const { data: labaRugiData, isLoading, refetch } = useLabaRugi({
    date_from: dateRange.from,
    date_to: dateRange.to,
    tipe_laporan: 'bulanan',
    limit: 100, // Get all data for summary calculations
  });

  const summary = labaRugiData?.summary;
  const revenueBreakdown = labaRugiData?.revenueBreakdown || [];
  const expenseBreakdown = labaRugiData?.expenseBreakdown || [];
  const reports = labaRugiData?.data || [];

  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Laporan Laba Rugi"
            description="Laporan pendapatan dan beban operasional"
          />
          <ToolbarActions>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Ekspor
            </Button>
          </ToolbarActions>
        </Toolbar>
      </Container>

      <Container>
        <div className="space-y-5 lg:space-y-7.5">
          {/* Back Button */}
          <Link href="/keuangan/laporan-keuangan">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
          </Link>

          {/* Period Selector */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Periode:</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={selectedPeriod === 'month' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedPeriod('month')}
                  >
                    Bulan Ini
                  </Button>
                  <Button
                    variant={selectedPeriod === 'quarter' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedPeriod('quarter')}
                  >
                    Kuartal Ini
                  </Button>
                  <Button
                    variant={selectedPeriod === 'year' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedPeriod('year')}
                  >
                    Tahun Ini
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <Card>
              <CardContent className="p-12">
                <div className="flex flex-col items-center justify-center gap-4">
                  <RefreshCw className="h-8 w-8 text-muted-foreground animate-spin" />
                  <p className="text-muted-foreground">Memuat data laba rugi...</p>
                </div>
              </CardContent>
            </Card>
          ) : summary ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Pendapatan</CardTitle>
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(summary.totalRevenue)}</div>
                    <p className="text-xs text-green-600 mt-1">
                      +15% dari periode lalu
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Beban</CardTitle>
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(summary.totalExpenses)}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      +8.5% dari periode lalu
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Laba Bersih</CardTitle>
                    <Download className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(summary.totalProfit)}</div>
                    <p className="text-xs text-green-600 mt-1">
                      Marjin profit: {summary.profitMargin.toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Rasio Laba</CardTitle>
                    <div className="h-4 w-4 rounded-full bg-purple-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{summary.avgProfitMargin.toFixed(1)}%</div>
                    <p className="text-xs text-green-600 mt-1">
                      +3.2% dari periode lalu
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Income Statement Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Laporan Laba Rugi</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Periode: {formatDate(dateRange.from)} - {formatDate(dateRange.to)}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Pendapatan */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
                        <span className="font-semibold text-green-700 dark:text-green-400">PENDAPATAN</span>
                        <span className="font-bold text-green-700 dark:text-green-400">
                          {formatCurrency(summary.totalRevenue)}
                        </span>
                      </div>
                      <div className="space-y-2 pl-4">
                        {revenueBreakdown.map((item) => (
                          <div key={item.category} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{item.category}</span>
                            <span>{formatCurrency(item.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Beban */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg">
                        <span className="font-semibold text-red-700 dark:text-red-400">BEBAN</span>
                        <span className="font-bold text-red-700 dark:text-red-400">
                          ({formatCurrency(summary.totalExpenses)})
                        </span>
                      </div>
                      <div className="space-y-2 pl-4">
                        {expenseBreakdown.map((item) => (
                          <div key={item.category} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{item.category}</span>
                            <span>({formatCurrency(item.amount)})</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Laba Bersih */}
                    <div className="flex items-center justify-between p-4 bg-blue-500/10 border-2 border-blue-500/20 rounded-lg">
                      <span className="font-bold text-lg text-blue-700 dark:text-blue-400">LABA BERSIH</span>
                      <span className="font-bold text-xl text-blue-700 dark:text-blue-400">
                        {formatCurrency(summary.totalProfit)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Revenue Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Analisis Sumber Pendapatan</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {revenueBreakdown
                      .filter(item => item.amount > 0)
                      .sort((a, b) => b.amount - a.amount)
                      .map((item) => (
                        <div key={item.category} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{item.category}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">{item.percentage.toFixed(1)}%</span>
                              <span className="font-semibold">{formatCurrency(item.amount)}</span>
                            </div>
                          </div>
                          <Progress value={item.percentage} className="h-2" />
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              {/* Expense Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Analisis Beban</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {expenseBreakdown
                      .filter(item => item.amount > 0)
                      .sort((a, b) => b.amount - a.amount)
                      .map((item) => (
                        <div key={item.category} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{item.category}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">{item.percentage.toFixed(1)}%</span>
                              <span className="font-semibold">{formatCurrency(item.amount)}</span>
                            </div>
                          </div>
                          <Progress value={item.percentage} className="h-2" />
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Marjin Laba Bersih</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600">{summary.profitMargin.toFixed(1)}%</div>
                    <p className="text-xs text-muted-foreground mt-1">Dari total pendapatan</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Rasio Operasional</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">
                      {summary.totalRevenue > 0 ? ((summary.totalExpenses / summary.totalRevenue) * 100).toFixed(1) : 0}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Beban operasional / Pendapatan</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Pertumbuhan YoY</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-purple-600">+18.5%</div>
                    <p className="text-xs text-muted-foreground mt-1">Dibanding tahun lalu</p>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="p-12">
                <div className="text-center text-muted-foreground">
                  Gagal memuat data laba rugi
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </Container>
    </Fragment>
  );
}
