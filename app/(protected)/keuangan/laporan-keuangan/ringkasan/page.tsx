'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/toolbar';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Calendar,
  DollarSign,
  Download,
  PiggyBank,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useRingkasanKeuangan } from '@/lib/hooks/use-ringkasan-keuangan-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Container } from '@/components/common/container';

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

export default function RingkasanKeuanganPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<
    'today' | 'week' | 'month' | 'year'
  >('month');

  // Calculate date range based on selected period
  const getDateRange = () => {
    const now = new Date();
    const from = new Date();

    switch (selectedPeriod) {
      case 'today':
        from.setHours(0, 0, 0, 0);
        break;
      case 'week':
        from.setDate(now.getDate() - 7);
        break;
      case 'month':
        from.setMonth(now.getMonth() - 1);
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

  // Fetch financial summary
  const {
    data: summaryData,
    isLoading,
    refetch,
  } = useRingkasanKeuangan({
    date_from: dateRange.from,
    date_to: dateRange.to,
  });

  const handleRefresh = () => {
    refetch();
  };

  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Ringkasan Keuangan"
            description="Ikhtisar kondisi keuangan organisasi"
          />
          <ToolbarActions>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
              />
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
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Periode:</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={selectedPeriod === 'today' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedPeriod('today')}
                  >
                    Hari Ini
                  </Button>
                  <Button
                    variant={selectedPeriod === 'week' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedPeriod('week')}
                  >
                    Minggu Ini
                  </Button>
                  <Button
                    variant={selectedPeriod === 'month' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedPeriod('month')}
                  >
                    Bulan Ini
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
                  <p className="text-muted-foreground">
                    Memuat data keuangan...
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : summaryData ? (
            <>
              {/* Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Pemasukan
                    </CardTitle>
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(summaryData.overview.totalRevenue)}
                    </div>
                    <p className="text-xs text-green-600 mt-1">
                      {summaryData.overview.revenueGrowth >= 0 ? '+' : ''}
                      {summaryData.overview.revenueGrowth}% dari periode lalu
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Pengeluaran
                    </CardTitle>
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(summaryData.overview.totalExpenses)}
                    </div>
                    <p className="text-xs text-red-600 mt-1">
                      {summaryData.overview.expenseGrowth >= 0 ? '+' : ''}
                      {summaryData.overview.expenseGrowth}% dari periode lalu
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">
                      Laba Bersih
                    </CardTitle>
                    <DollarSign className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(summaryData.overview.netProfit)}
                    </div>
                    <p className="text-xs text-green-600 mt-1">
                      {summaryData.overview.profitGrowth >= 0 ? '+' : ''}
                      {summaryData.overview.profitGrowth}% dari periode lalu
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">
                      Saldo Kas
                    </CardTitle>
                    <Wallet className="h-4 w-4 text-purple-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(summaryData.overview.cashBalance)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Per {formatDate(dateRange.to)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Revenue & Expense Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
                {/* Revenue Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Breakdown Pemasukan
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {summaryData.revenueBreakdown.map((item) => (
                      <div key={item.category} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{item.category}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                              {item.percentage.toFixed(1)}%
                            </span>
                            <span className="font-semibold">
                              {formatCurrency(item.amount)}
                            </span>
                          </div>
                        </div>
                        <Progress value={item.percentage} className="h-2" />
                      </div>
                    ))}
                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">Total Pemasukan</span>
                        <span className="font-bold text-lg">
                          {formatCurrency(summaryData.overview.totalRevenue)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Expense Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Breakdown Pengeluaran
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {summaryData.expenseBreakdown.map((item) => (
                      <div key={item.category} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{item.category}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                              {item.percentage.toFixed(1)}%
                            </span>
                            <span className="font-semibold">
                              {formatCurrency(item.amount)}
                            </span>
                          </div>
                        </div>
                        <Progress value={item.percentage} className="h-2" />
                      </div>
                    ))}
                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">Total Pengeluaran</span>
                        <span className="font-bold text-lg">
                          {formatCurrency(summaryData.overview.totalExpenses)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Transactions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Transaksi Terakhir</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {summaryData.recentTransactions.length > 0 ? (
                      summaryData.recentTransactions.map((transaction) => (
                        <div
                          key={transaction.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div
                              className={`p-2 rounded-lg ${
                                transaction.type === 'income'
                                  ? 'bg-green-500/10 text-green-600'
                                  : 'bg-red-500/10 text-red-600'
                              }`}
                            >
                              {transaction.type === 'income' ? (
                                <ArrowDownLeft className="h-4 w-4" />
                              ) : (
                                <ArrowUpRight className="h-4 w-4" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {transaction.description}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{transaction.category}</span>
                                <span>•</span>
                                <span>{formatDate(transaction.date)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right ml-3">
                            <p
                              className={`font-semibold ${
                                transaction.type === 'income'
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {transaction.type === 'income' ? '+' : '-'}
                              {formatCurrency(transaction.amount)}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        Tidak ada transaksi terbaru
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Dana Kematian & Dana Sosial Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
                {/* Dana Kematian */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <PiggyBank className="h-5 w-5 text-rose-600" />
                      Dana Kematian
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 rounded-lg bg-rose-500/10 border border-rose-500/20">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Total Dana
                          </p>
                          <p className="text-2xl font-bold text-rose-600">
                            {formatCurrency(summaryData.danaKematian.total)}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-green-500/10">
                          <p className="text-xs text-muted-foreground">
                            Klaim Dibayar
                          </p>
                          <p className="text-lg font-semibold text-green-600">
                            {formatCurrency(summaryData.danaKematian.klaimPaid)}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-blue-500/10">
                          <p className="text-xs text-muted-foreground">
                            Sisa Dana
                          </p>
                          <p className="text-lg font-semibold text-blue-600">
                            {formatCurrency(summaryData.danaKematian.remaining)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Dana Sosial */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-pink-600" />
                      Dana Sosial
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 rounded-lg bg-pink-500/10 border border-pink-500/20">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Total Dana
                          </p>
                          <p className="text-2xl font-bold text-pink-600">
                            {formatCurrency(summaryData.danaSosial.total)}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-green-500/10">
                          <p className="text-xs text-muted-foreground">
                            Bantuan Diberikan
                          </p>
                          <p className="text-lg font-semibold text-green-600">
                            {formatCurrency(
                              summaryData.danaSosial.bantuanGiven,
                            )}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-purple-500/10">
                          <p className="text-xs text-muted-foreground">
                            Sisa Dana
                          </p>
                          <p className="text-lg font-semibold text-purple-600">
                            {formatCurrency(summaryData.danaSosial.remaining)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Statistik Cepat</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                      <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                        <Calendar className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Periode Ini
                        </p>
                        <p className="text-lg font-bold">
                          {formatCurrency(summaryData.overview.netProfit)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                      <div className="p-2 rounded-lg bg-green-500/10 text-green-600">
                        <PiggyBank className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Total Dana
                        </p>
                        <p className="text-lg font-bold">
                          {formatCurrency(
                            summaryData.danaKematian.total +
                              summaryData.danaSosial.total,
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                      <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600">
                        <Wallet className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Rasio Laba
                        </p>
                        <p className="text-lg font-bold">
                          {(
                            (summaryData.overview.netProfit /
                              summaryData.overview.totalRevenue) *
                            100
                          ).toFixed(1)}
                          %
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-12">
                <div className="text-center text-muted-foreground">
                  Gagal memuat data ringkasan keuangan
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </Container>
    </Fragment>
  );
}
