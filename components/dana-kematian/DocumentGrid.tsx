'use client';

import { useMemo } from 'react';
import { FileText, ScrollText, Users, UserCircle, Heart, AlertTriangle, FilePlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { DocumentCard } from './DocumentCard';
import {
  DocumentType,
  DocumentMetadata,
  getDocumentTypes,
  getDocumentCompletion,
} from '@/lib/config/dana-kematian-documents';

interface DocumentGridProps {
  documents: Array<{
    documentType: DocumentType;
    fileUrl: string | null;
    isVerified: boolean;
    metadata?: DocumentMetadata[string];
  }>;
  onFileChange: (documentId: string, url: string) => void;
  onMetadataChange: (documentId: string, metadata: DocumentMetadata[string]) => void;
  onVerify?: (documentId: string) => void;
  canVerify?: boolean;
  disabled?: boolean;
  spouseAlive?: boolean;
  bothDeceased?: boolean;
  compact?: boolean;
  showCategoryHeaders?: boolean;
}

export function DocumentGrid({
  documents,
  onFileChange,
  onMetadataChange,
  onVerify,
  canVerify = false,
  disabled = false,
  spouseAlive = false,
  bothDeceased = false,
  compact = false,
  showCategoryHeaders = true,
}: DocumentGridProps) {
  // Group documents by category
  const groupedDocuments = useMemo(() => {
    const wajib = documents.filter((d) => d.documentType.category === 'wajib');
    const kondisional = documents.filter((d) => d.documentType.category === 'kondisional');
    const pendukung = documents.filter((d) => d.documentType.category === 'pendukung');

    return { wajib, kondisional, pendukung };
  }, [documents]);

  // Calculate completion stats
  const completionStats = useMemo(() => {
    const docs = documents.map((d) => ({
      fileUrl: d.fileUrl,
      isVerified: d.isVerified,
    }));
    return getDocumentCompletion(docs);
  }, [documents]);

  const renderDocumentCard = (doc: typeof documents[0]) => (
    <div
      key={doc.documentType.id}
      className={compact ? '' : 'min-h-[200px]'}
    >
      <DocumentCard
        documentType={doc.documentType}
        fileUrl={doc.fileUrl}
        isVerified={doc.isVerified}
        metadata={doc.metadata}
        onFileChange={(url) => onFileChange(doc.documentType.id, url)}
        onMetadataChange={(metadata) => onMetadataChange(doc.documentType.id, metadata)}
        onVerify={onVerify ? () => onVerify(doc.documentType.id) : undefined}
        canVerify={canVerify}
        disabled={disabled}
        compact={compact}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      {!compact && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Progress Dokumen</CardTitle>
              <Badge variant={completionStats.percentage === 100 ? 'success' : 'secondary'}>
                {completionStats.uploaded}/{completionStats.total} Dokumen
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={completionStats.percentage} className="h-2" />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{completionStats.percentage}% lengkap</span>
              <span>
                {completionStats.verified} terverifikasi
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Required Documents */}
      {showCategoryHeaders && groupedDocuments.wajib.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold">Dokumen Wajib</h3>
              <p className="text-xs text-muted-foreground">
                Dokumen yang harus dilengkapi untuk semua pengajuan
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupedDocuments.wajib.map(renderDocumentCard)}
          </div>
        </div>
      )}

      {/* Conditional Documents */}
      {showCategoryHeaders && groupedDocuments.kondisional.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100 text-yellow-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold">Dokumen Kondisional</h3>
              <p className="text-xs text-muted-foreground">
                Dokumen yang diperlukan berdasarkan kondisi tertentu
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupedDocuments.kondisional.map(renderDocumentCard)}
          </div>
        </div>
      )}

      {/* Supporting Documents */}
      {groupedDocuments.pendukung.length > 0 && (
        <div className="space-y-3">
          {showCategoryHeaders && (
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-600">
                <FilePlus className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold">Dokumen Pendukung</h3>
                <p className="text-xs text-muted-foreground">
                  Dokumen tambahan yang dapat dilengkapi sesuai kebutuhan
                </p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupedDocuments.pendukung.map(renderDocumentCard)}
          </div>
        </div>
      )}

      {/* Empty State */}
      {documents.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Tidak ada dokumen yang ditampilkan</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface CompactDocumentGridProps {
  documents: Array<{
    documentType: DocumentType;
    fileUrl: string | null;
    isVerified: boolean;
  }>;
  onDocumentClick?: (documentId: string) => void;
}

/**
 * Compact version for dashboard/list views
 */
export function CompactDocumentGrid({
  documents,
  onDocumentClick,
}: CompactDocumentGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
      {documents.map((doc) => {
        const Icon = doc.documentType.icon;
        const isUploaded = !!doc.fileUrl;
        const isVerified = doc.isVerified;

        return (
          <Card
            key={doc.documentType.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              isVerified ? 'border-green-200' : isUploaded ? 'border-blue-200' : ''
            }`}
            onClick={() => onDocumentClick?.(doc.documentType.id)}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div
                  className={`p-1.5 rounded ${
                    isVerified
                      ? 'bg-green-100 text-green-600'
                      : isUploaded
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{doc.documentType.label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {isVerified ? 'Terverifikasi' : isUploaded ? 'Terupload' : 'Belum'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
