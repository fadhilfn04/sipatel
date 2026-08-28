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
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Heart,
  Search,
  TrendingUp,
  Users,
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
const danaSosialData = [
  {
    id: '1',
    recipientName: 'Ahmad Sudrajat',
    nik: '1234567890123456',
    amount: 5000000,
    date: '2026-03-11',
    status: 'approved',
    type: 'Bantuan Kesehatan',
    reference: 'DS-001',
    description: 'Bantuan operasi jantung',
  },
  {
    id: '2',
    recipientName: 'Budi Santoso',
    nik: '1234567890123457',
    amount: 3000000,
    date: '2026-03-10',
    status: 'approved',
    type: 'Bantuan Pendidikan',
    reference: 'DS-002',
    description: 'Beasiswa anak kuliah',
  },
  {
    id: '3',
    recipientName: 'Citra Dewi',
    nik: '1234567890123458',
    amount: 2000000,
    date: '2026-03-09',
    status: 'pending',
    type: 'Bantuan Kesehatan',
    reference: 'DS-003',
    description: 'Bantuan pengobatan',
  },
  {
    id: '4',
    recipientName: 'Dedi Kurniawan',
    nik: '1234567890123459',
    amount: 1500000,
    date: '2026-03-08',
    status: 'approved',
    type: 'Bantuan Sosial',
    reference: 'DS-004',
    description: 'Bantuan bencana alam',
  },
  {
    id: '5',
    recipientName: 'Eko Prasetyo',
    nik: '1234567890123460',
    amount: 2500000,
    date: '2026-03-07',
    status: 'rejected',
    type: 'Bantuan Pendidikan',
    reference: 'DS-005',
    description: 'Beasiswa tidak disetujui',
  },
  {
    id: '6',
    recipientName: 'Fajar Nugraha',
    nik: '1234567890123461',
    amount: 4000000,
    date: '2026-03-06',
    status: 'approved',
    type: 'Bantuan Kesehatan',
    reference: 'DS-006',
    description: 'Bantuan rawat inap',
  },
];

const summaryData = {
  totalFund: 450000000,
  totalDistributed: 85000000,
  remainingFund: 365000000,
  totalRecipients: 234,
  totalRecipientsThisMonth: 18,
  averageAmount: 363247,
  fundGrowth: 12.3,
};

const assistanceTypes = [
  { type: 'Bantuan Kesehatan', amount: 45000000, percentage: 52.9, count: 12 },
  { type: 'Bantuan Pendidikan', amount: 25000000, percentage: 29.4, count: 4 },
  { type: 'Bantuan Sosial', amount: 10000000, percentage: 11.8, count: 1 },
  { type: 'Bantuan Lainnya', amount: 5000000, percentage: 5.9, count: 1 },
];

const monthlyData = [
  { month: 'Jan', amount: 28000000, recipients: 15 },
  { month: 'Feb', amount: 30000000, recipients: 16 },
  { month: 'Mar', amount: 35000000, recipients: 18 },
];

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

export default function DanaSosialPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter and paginate data
  const filteredData = useMemo(() => {
    return danaSosialData.filter((assistance) => {
      const matchesSearch =
        assistance.recipientName
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        assistance.nik.includes(searchQuery) ||
        assistance.reference.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        selectedStatus === 'all' || assistance.status === selectedStatus;
      const matchesType =
        selectedType === 'all' || assistance.type === selectedType;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [searchQuery, selectedStatus, selectedType]);

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
            title="Dana Sosial"
            description="Laporan dana sosial dan bantuan"
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
                <Heart className="h-4 w-4 text-pink-600" />
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
                  Bantuan Diberikan
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summaryData.totalDistributed)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summaryData.totalRecipients} penerima manfaat
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Sisa Dana</CardTitle>
                <div className="h-4 w-4 rounded-full bg-purple-600" />
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
                  Rata-rata Bantuan
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summaryData.averageAmount)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Per penerima
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Fund Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ikhtisar Dana Sosial</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-pink-500/10 border-2 border-pink-500/20">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total Dana Sosial
                    </p>
                    <p className="text-3xl font-bold text-pink-600">
                      {formatCurrency(summaryData.totalFund)}
                    </p>
                  </div>
                  <Heart className="h-12 w-12 text-pink-600" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-green-500/10">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Total Bantuan Diberikan
                      </p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(summaryData.totalDistributed)}
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
                    className="h-full bg-pink-600 rounded-full flex items-center justify-end pr-2"
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

          {/* Assistance Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Daftar Bantuan</CardTitle>
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
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Semua Tipe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Tipe</SelectItem>
                    <SelectItem value="Bantuan Kesehatan">
                      Bantuan Kesehatan
                    </SelectItem>
                    <SelectItem value="Bantuan Pendidikan">
                      Bantuan Pendidikan
                    </SelectItem>
                    <SelectItem value="Bantuan Sosial">
                      Bantuan Sosial
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Table */}
              <div className="rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tidak</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Nama Penerima</TableHead>
                      <TableHead>NIK</TableHead>
                      <TableHead>Tipe Bantuan</TableHead>
                      <TableHead>Jumlah</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Referensi</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.length > 0 ? (
                      paginatedData.map((assistance, index) => {
                        const statusProps = getStatusProps(assistance.status);
                        const StatusIcon = statusProps.icon;
                        return (
                          <TableRow key={assistance.id}>
                            <TableCell className="font-medium">
                              {index + 1 + (currentPage - 1) * itemsPerPage}
                            </TableCell>
                            <TableCell>{formatDate(assistance.date)}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {assistance.recipientName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {assistance.description}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {assistance.nik}
                            </TableCell>
                            <TableCell>{assistance.type}</TableCell>
                            <TableCell className="font-semibold">
                              {formatCurrency(assistance.amount)}
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
                            <TableCell className="font-mono text-xs">
                              {assistance.reference}
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
                          Tidak ada data bantuan ditemukan
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

          {/* Assistance by Type */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Bantuan Berdasarkan Tipe
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {assistanceTypes.map((item) => (
                  <div key={item.type} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{item.type}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {item.count} penerima
                        </span>
                        <span className="text-muted-foreground">
                          {item.percentage}%
                        </span>
                        <span className="font-semibold">
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-pink-600 rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Monthly Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Statistik Bulanan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {monthlyData.map((data) => (
                  <div key={data.month} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{data.month}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-muted-foreground">
                          {data.recipients} penerima
                        </span>
                        <span className="font-semibold">
                          {formatCurrency(data.amount)}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-pink-600 rounded-full"
                        style={{ width: `${(data.amount / 40000000) * 100}%` }}
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
                <CardTitle className="text-lg">Informasi Penerima</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">
                      Total Penerima Manfaat
                    </span>
                    <span className="font-bold">
                      {summaryData.totalRecipients}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">
                      Penerima Bulan Ini
                    </span>
                    <span className="font-bold">
                      {summaryData.totalRecipientsThisMonth}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">
                      Rata-rata per Penerima
                    </span>
                    <span className="font-bold">
                      {formatCurrency(summaryData.averageAmount)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Status Pengajuan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10">
                    <span className="text-sm text-muted-foreground">
                      Disetujui
                    </span>
                    <span className="font-bold text-green-600">4</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10">
                    <span className="text-sm text-muted-foreground">
                      Pending
                    </span>
                    <span className="font-bold text-yellow-600">1</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10">
                    <span className="text-sm text-muted-foreground">
                      Ditolak
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
