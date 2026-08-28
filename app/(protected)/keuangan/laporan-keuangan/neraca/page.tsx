'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/toolbar';
import {
  ArrowLeft,
  Building2,
  Download,
  Landmark,
  RefreshCw,
  Scale,
  Wallet,
} from 'lucide-react';
import { useNeraca } from '@/lib/hooks/use-neraca-api';
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

export default function NeracaPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<
    'month' | 'quarter' | 'year'
  >('month');

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

  // Fetch neraca data
  const {
    data: neracaData,
    isLoading,
    refetch,
  } = useNeraca({
    date_from: dateRange.from,
    date_to: dateRange.to,
    tipe_laporan: 'bulanan',
    limit: 100,
  });

  const summary = neracaData?.summary;
  const assetBreakdown = neracaData?.assetBreakdown || [];
  const latestBalance = neracaData?.latestBalance;

  const handleRefresh = () => {
    refetch();
  };

  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Neraca (Balance Sheet)"
            description="Laporan posisi keuangan dan ekuitas"
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
                    variant={
                      selectedPeriod === 'quarter' ? 'primary' : 'outline'
                    }
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
                  <p className="text-muted-foreground">Memuat data neraca...</p>
                </div>
              </CardContent>
            </Card>
          ) : summary ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Aset
                    </CardTitle>
                    <Scale className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(summary.totalAssets)}
                    </div>
                    <p className="text-xs text-green-600 mt-1">
                      +8.5% dari periode lalu
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Kewajiban
                    </CardTitle>
                    <Landmark className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(summary.totalLiabilities)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Dari periode terpilih
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Ekuitas
                    </CardTitle>
                    <Wallet className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(summary.totalEquity)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Dari periode terpilih
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">
                      Rasio Solvabilitas
                    </CardTitle>
                    <Building2 className="h-4 w-4 text-purple-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {summary.debtToAssetRatio.toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ekuitas / Total Aset
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Balance Sheet Statement */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
                {/* Assets */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Scale className="h-5 w-5 text-blue-600" />
                      Aset
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Latest Balance */}
                    {latestBalance && (
                      <div className="space-y-4">
                        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                          <p className="text-sm text-muted-foreground mb-2">
                            Saldo Terakhir
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-lg">
                              Total Aset
                            </span>
                            <span className="font-bold text-xl text-blue-600">
                              {formatCurrency(latestBalance.totalAset)}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 rounded-lg bg-muted/50">
                            <p className="text-xs text-muted-foreground">
                              Kewajiban
                            </p>
                            <p className="font-semibold">
                              {formatCurrency(latestBalance.totalKewajiban)}
                            </p>
                          </div>
                          <div className="p-3 rounded-lg bg-muted/50">
                            <p className="text-xs text-muted-foreground">
                              Ekuitas
                            </p>
                            <p className="font-semibold">
                              {formatCurrency(latestBalance.totalEkuitas)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Asset Breakdown */}
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Komposisi Aset</p>
                      {assetBreakdown
                        .filter((item) => item.amount > 0)
                        .map((item) => (
                          <div key={item.category} className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">
                                {item.category}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">
                                  {item.percentage.toFixed(1)}%
                                </span>
                                <span className="font-semibold">
                                  {formatCurrency(item.amount)}
                                </span>
                              </div>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-600 rounded-full"
                                style={{ width: `${item.percentage}%` }}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Liabilities & Equity */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Landmark className="h-5 w-5 text-red-600" />
                      Kewajiban & Ekuitas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Financial Ratios */}
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <span className="text-sm text-muted-foreground">
                          Rasio Hutang terhadap Aset
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">
                            {summary.debtToAssetRatio.toFixed(1)}%
                          </span>
                          <Badge
                            variant={
                              summary.debtToAssetRatio < 30
                                ? 'success'
                                : summary.debtToAssetRatio < 50
                                  ? 'warning'
                                  : 'destructive'
                            }
                          >
                            {summary.debtToAssetRatio < 30
                              ? 'Rendah'
                              : summary.debtToAssetRatio < 50
                                ? 'Sedang'
                                : 'Tinggi'}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <span className="text-sm text-muted-foreground">
                          Rasio Hutang terhadap Ekuitas
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">
                            {summary.debtToEquityRatio.toFixed(1)}%
                          </span>
                          <Badge
                            variant={
                              summary.debtToEquityRatio < 50
                                ? 'success'
                                : summary.debtToEquityRatio < 100
                                  ? 'warning'
                                  : 'destructive'
                            }
                          >
                            {summary.debtToEquityRatio < 50
                              ? 'Rendah'
                              : summary.debtToEquityRatio < 100
                                ? 'Sedang'
                                : 'Tinggi'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Balance Summary */}
                    {latestBalance && (
                      <div className="p-4 rounded-lg border border-border">
                        <p className="text-sm font-medium mb-3">
                          Ringkasan Neraca
                        </p>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              Total Aset
                            </span>
                            <span className="font-semibold">
                              {formatCurrency(latestBalance.totalAset)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              Total Kewajiban
                            </span>
                            <span className="font-semibold text-red-600">
                              {formatCurrency(latestBalance.totalKewajiban)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              Total Ekuitas
                            </span>
                            <span className="font-semibold text-green-600">
                              {formatCurrency(latestBalance.totalEkuitas)}
                            </span>
                          </div>
                          <div className="mt-3 pt-3 border-t">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm">
                                TOTAL KEWAJIBAN & EKUITAS
                              </span>
                              <span className="font-bold text-sm">
                                {formatCurrency(
                                  latestBalance.totalKewajiban +
                                    latestBalance.totalEkuitas,
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Key Financial Ratios */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Rasio Keuangan Utama
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">
                          Rasio Likuiditas
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-blue-600">
                          {latestBalance?.totalAset &&
                          latestBalance.totalKewajiban > 0
                            ? (
                                latestBalance.totalAset /
                                latestBalance.totalKewajiban
                              ).toFixed(2)
                            : '0.00'}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Aset Lancar / Kewajiban Lancar
                        </p>
                        <Badge variant="success" className="mt-2">
                          Sehat
                        </Badge>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">
                          Rasio Hutang terhadap Aset
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-green-600">
                          {summary.debtToAssetRatio.toFixed(1)}%
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Total Kewajiban / Total Aset
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">
                          Rasio Hutang terhadap Ekuitas
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-purple-600">
                          {summary.debtToEquityRatio.toFixed(1)}%
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Total Kewajiban / Total Ekuitas
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-12">
                <div className="text-center text-muted-foreground">
                  Gagal memuat data neraca
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </Container>
    </Fragment>
  );
}
