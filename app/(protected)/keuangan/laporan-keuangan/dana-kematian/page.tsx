'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/toolbar';
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  PiggyBank,
  Search,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Container } from '@/components/common/container';

// Mock data - replace with actual API calls
const danaKematianData = [
  {
    id: '1',
    memberName: 'Ahmad Sudrajat',
    nik: '1234567890123456',
    claimAmount: 15000000,
    date: '2026-03-11',
    status: 'approved',
    claimDate: '2026-03-10',
    paymentDate: '2026-03-11',
    reference: 'DK-001',
  },
  {
    id: '2',
    memberName: 'Budi Santoso',
    nik: '1234567890123457',
    claimAmount: 15000000,
    date: '2026-03-09',
    status: 'approved',
    claimDate: '2026-03-08',
    paymentDate: '2026-03-09',
    reference: 'DK-002',
  },
  {
    id: '3',
    memberName: 'Citra Dewi',
    nik: '1234567890123458',
    claimAmount: 15000000,
    date: '2026-03-07',
    status: 'pending',
    claimDate: '2026-03-06',
    paymentDate: null,
    reference: 'DK-003',
  },
  {
    id: '4',
    memberName: 'Dedi Kurniawan',
    nik: '1234567890123459',
    claimAmount: 15000000,
    date: '2026-03-05',
    status: 'approved',
    claimDate: '2026-03-04',
    paymentDate: '2026-03-05',
    reference: 'DK-004',
  },
  {
    id: '5',
    memberName: 'Eko Prasetyo',
    nik: '1234567890123460',
    claimAmount: 15000000,
    date: '2026-03-03',
    status: 'rejected',
    claimDate: '2026-03-02',
    paymentDate: null,
    reference: 'DK-005',
  },
  {
    id: '6',
    memberName: 'Fajar Nugraha',
    nik: '1234567890123461',
    claimAmount: 15000000,
    date: '2026-03-01',
    status: 'approved',
    claimDate: '2026-02-28',
    paymentDate: '2026-03-01',
    reference: 'DK-006',
  },
];

const summaryData = {
  totalFund: 850000000,
  totalClaims: 125000000,
  remainingFund: 725000000,
  activeMembers: 1234,
  totalClaimsThisMonth: 15,
  averageClaimAmount: 15000000,
  fundGrowth: 8.5,
};

const contributionData = [
  { month: 'Jan', amount: 85000000, claims: 12 },
  { month: 'Feb', amount: 87500000, claims: 14 },
  { month: 'Mar', amount: 90000000, claims: 15 },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const getStatusProps = (status: string) => {
  const statusMap: Record<
    string,
    {
      variant: 'success' | 'destructive' | 'warning' | 'secondary';
      label: string;
      icon: any;
    }
  > = {
    approved: { variant: 'success', label: 'Disetujui', icon: CheckCircle },
    pending: { variant: 'warning', label: 'Pending', icon: Clock },
    rejected: { variant: 'destructive', label: 'Ditolak', icon: XCircle },
  };
  return (
    statusMap[status] || { variant: 'secondary', label: status, icon: FileText }
  );
};

export default function DanaKematianPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter and paginate data
  const filteredData = useMemo(() => {
    return danaKematianData.filter((claim) => {
      const matchesSearch =
        claim.memberName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        claim.nik.includes(searchQuery) ||
        claim.reference.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        selectedStatus === 'all' || claim.status === selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, selectedStatus]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Dana Kematian"
            description="Laporan dana kematian anggota"
          />
          <ToolbarActions>
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-2" />
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

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Dana
                </CardTitle>
                <PiggyBank className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summaryData.totalFund)}
                </div>
                <p className="text-xs text-green-600 mt-1">
                  +{summaryData.fundGrowth}% dari bulan lalu
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Klaim Dibayar
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summaryData.totalClaims)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summaryData.totalClaimsThisMonth} klaim bulan ini
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Sisa Dana</CardTitle>
                <div className="h-4 w-4 rounded-full bg-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summaryData.remainingFund)}
                </div>
                <p className="text-xs text-green-600 mt-1">
                  {(
                    (summaryData.remainingFund / summaryData.totalFund) *
                    100
                  ).toFixed(1)}
                  % dari total dana
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Rata-rata Klaim
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summaryData.averageClaimAmount)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Per klaim</p>
              </CardContent>
            </Card>
          </div>

          {/* Fund Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ikhtisar Dana Kematian</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-blue-500/10 border-2 border-blue-500/20">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total Dana Kematian
                    </p>
                    <p className="text-3xl font-bold text-blue-600">
                      {formatCurrency(summaryData.totalFund)}
                    </p>
                  </div>
                  <PiggyBank className="h-12 w-12 text-blue-600" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-green-500/10">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Total Klaim Dibayar
                      </p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(summaryData.totalClaims)}
                      </p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-purple-500/10">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Sisa Dana Tersedia
                      </p>
                      <p className="text-2xl font-bold text-purple-600">
                        {formatCurrency(summaryData.remainingFund)}
                      </p>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-purple-600" />
                  </div>
                </div>

                <div className="h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-600 rounded-full flex items-center justify-end pr-2"
                    style={{
                      width: `${(summaryData.remainingFund / summaryData.totalFund) * 100}%`,
                    }}
                  >
                    <span className="text-xs font-semibold text-white">
                      {(
                        (summaryData.remainingFund / summaryData.totalFund) *
                        100
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Claims Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Daftar Klaim</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari nama, NIK, atau referensi..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select
                  value={selectedStatus}
                  onValueChange={setSelectedStatus}
                >
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="approved">Disetujui</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="rejected">Ditolak</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Table */}
              <div className="rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tidak</TableHead>
                      <TableHead>Tanggal Klaim</TableHead>
                      <TableHead>Nama Anggota</TableHead>
                      <TableHead>NIK</TableHead>
                      <TableHead>Jumlah Klaim</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tanggal Bayar</TableHead>
                      <TableHead>Referensi</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.length > 0 ? (
                      paginatedData.map((claim, index) => {
                        const statusProps = getStatusProps(claim.status);
                        const StatusIcon = statusProps.icon;
                        return (
                          <TableRow key={claim.id}>
                            <TableCell className="font-medium">
                              {index + 1 + (currentPage - 1) * itemsPerPage}
                            </TableCell>
                            <TableCell>{formatDate(claim.claimDate)}</TableCell>
                            <TableCell className="font-medium">
                              {claim.memberName}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {claim.nik}
                            </TableCell>
                            <TableCell className="font-semibold">
                              {formatCurrency(claim.claimAmount)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={statusProps.variant}
                                className="gap-1.5"
                              >
                                <StatusIcon className="h-3 w-3" />
                                {statusProps.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {formatDate(claim.paymentDate)}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {claim.reference}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className="h-24 text-center text-muted-foreground"
                        >
                          Tidak ada data klaim ditemukan
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Menampilkan {(currentPage - 1) * itemsPerPage + 1} -{' '}
                    {Math.min(currentPage * itemsPerPage, filteredData.length)}{' '}
                    dari {filteredData.length} data
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="text-sm">
                      Halaman {currentPage} dari {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                      }
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monthly Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Statistik Bulanan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {contributionData.map((data) => (
                  <div key={data.month} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{data.month}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-muted-foreground">
                          {data.claims} klaim
                        </span>
                        <span className="font-semibold">
                          {formatCurrency(data.amount)}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${(data.amount / 100000000) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Additional Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informasi Keanggotaan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">
                      Total Anggota Aktif
                    </span>
                    <span className="font-bold">
                      {summaryData.activeMembers}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">
                      Kontribusi per Anggota
                    </span>
                    <span className="font-bold">
                      {formatCurrency(
                        summaryData.totalFund / summaryData.activeMembers,
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Rasio Klaim</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10">
                    <span className="text-sm text-muted-foreground">
                      Klaim Disetujui
                    </span>
                    <span className="font-bold text-green-600">4</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10">
                    <span className="text-sm text-muted-foreground">
                      Klaim Pending
                    </span>
                    <span className="font-bold text-yellow-600">1</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10">
                    <span className="text-sm text-muted-foreground">
                      Klaim Ditolak
                    </span>
                    <span className="font-bold text-red-600">1</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Container>
    </Fragment>
  );
}
