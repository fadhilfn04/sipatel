'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileUpload } from '@/components/ui/FileUpload';
import { DocumentStatusBadge, getDocumentStatus } from '@/components/ui/DocumentStatusBadge';
import {
  DocumentType,
  DocumentMetadata,
  getDocumentStatus as getDocStatus,
  validateDocumentMetadata,
} from '@/lib/config/dana-kematian-documents';

interface DocumentCardProps {
  documentType: DocumentType;
  fileUrl: string | null;
  isVerified: boolean;
  metadata?: DocumentMetadata[string];
  onFileChange: (url: string) => void;
  onMetadataChange: (metadata: DocumentMetadata[string]) => void;
  onVerify?: () => void;
  canVerify?: boolean;
  disabled?: boolean;
  compact?: boolean;
}

export function DocumentCard({
  documentType,
  fileUrl,
  isVerified,
  metadata = {},
  onFileChange,
  onMetadataChange,
  onVerify,
  canVerify = false,
  disabled = false,
  compact = false,
}: DocumentCardProps) {
  const [expanded, setExpanded] = useState(!fileUrl);
  const [metadataErrors, setMetadataErrors] = useState<string[]>([]);

  const Icon = documentType.icon;
  const status = getDocStatus(fileUrl, isVerified);

  const handleMetadataChange = (fieldId: string, value: string) => {
    const newMetadata = { ...metadata, [fieldId]: value };
    onMetadataChange(newMetadata);

    // Validate and show errors
    const validation = validateDocumentMetadata(documentType, newMetadata);
    setMetadataErrors(validation.errors);
  };

  const isConditional = documentType.category === 'kondisional';
  const isOptional = documentType.category === 'pendukung';

  return (
    <Card
      className={`overflow-hidden transition-all duration-200 ${
        status === 'verified' ? 'border-green-200 bg-green-50/30' : ''
      } ${status === 'uploaded' ? 'border-blue-200 bg-blue-50/30' : ''}`}
    >
      <CardHeader
        className={compact ? 'py-3 px-4' : 'py-4 px-5'}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div
              className={`p-2 rounded-lg ${
                status === 'verified'
                  ? 'bg-green-100 text-green-600'
                  : status === 'uploaded'
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              <Icon className="h-5 w-5" />
            </div>

            <div className="flex-1 min-w-0">
              <CardTitle className={`font-semibold flex items-center gap-2 ${compact ? 'text-sm' : 'text-base'}`}>
                {documentType.label}
                {isConditional && (
                  <Badge variant="warning" size="xs">
                    Kondisional
                  </Badge>
                )}
                {isOptional && (
                  <Badge variant="secondary" size="xs">
                    Opsional
                  </Badge>
                )}
              </CardTitle>
              <p className={`text-muted-foreground mt-1 ${compact ? 'text-xs' : 'text-sm'}`}>
                {documentType.description}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {documentType.condition.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DocumentStatusBadge status={status} compact />
            {documentType.fields.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="h-8 w-8 p-0"
              >
                {expanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className={compact ? 'pt-0 px-4 pb-3' : 'pt-0 px-5 pb-4'}>
        {/* Document Metadata Fields */}
        {documentType.fields.length > 0 && expanded && (
          <div className="space-y-3 mb-4 p-4 bg-muted/50 rounded-lg border">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Informasi Dokumen
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {documentType.fields.map((field) => {
                const error = metadataErrors.find((e) => e.includes(field.label));

                return (
                  <div key={field.id} className="space-y-1">
                    <label className="text-sm font-medium">
                      {field.label}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </label>

                    {field.type === 'select' ? (
                      <Select
                        value={metadata[field.id] || ''}
                        onValueChange={(value) => handleMetadataChange(field.id, value)}
                        disabled={disabled}
                      >
                        <SelectTrigger className={error ? 'border-destructive' : ''}>
                          <SelectValue placeholder={field.placeholder} />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options?.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : field.type === 'date' ? (
                      <Input
                        type="date"
                        value={metadata[field.id] || ''}
                        onChange={(e) => handleMetadataChange(field.id, e.target.value)}
                        disabled={disabled}
                        className={error ? 'border-destructive' : ''}
                      />
                    ) : (
                      <Input
                        type="text"
                        placeholder={field.placeholder}
                        value={metadata[field.id] || ''}
                        onChange={(e) => handleMetadataChange(field.id, e.target.value)}
                        disabled={disabled}
                        className={error ? 'border-destructive' : ''}
                      />
                    )}

                    {error && <p className="text-xs text-destructive">{error}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* File Upload */}
        <div className="space-y-2">
          <FileUpload
            label={fileUrl ? 'Dokumen Terupload' : 'Upload Dokumen'}
            value={fileUrl || ''}
            onChange={onFileChange}
            bucket="dana-kematian"
            folder={documentType.id}
            disabled={disabled}
          />
        </div>

        {/* Verification Status */}
        {isVerified && (
          <div className="flex items-center gap-2 text-sm text-green-600 mt-3 p-2 bg-green-50 rounded-md">
            <CheckCircle2 className="h-4 w-4" />
            <span>Dokumen telah diverifikasi</span>
          </div>
        )}

        {/* Verify Button (for admin/verifier) */}
        {canVerify && fileUrl && !isVerified && (
          <div className="flex items-center gap-2 mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onVerify}
              disabled={disabled}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Verifikasi Dokumen
            </Button>
          </div>
        )}

        {/* Validation Warning */}
        {fileUrl && !isVerified && documentType.required && !disabled && !canVerify && (
          <div className="flex items-center gap-2 text-sm text-yellow-600 mt-3 p-2 bg-yellow-50 rounded-md">
            <AlertCircle className="h-4 w-4" />
            <span>Menunggu verifikasi</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
