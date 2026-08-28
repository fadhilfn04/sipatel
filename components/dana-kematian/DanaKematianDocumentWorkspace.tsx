'use client';

import { useState, useEffect, useMemo } from 'react';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DanaKematian, CreateDanaKematianInput } from '@/lib/supabase';
import { DocumentGrid } from './DocumentGrid';
import { WorkflowTimeline } from './WorkflowTimeline';
import { ActionReminders } from './ActionReminders';
import {
  DOCUMENT_TYPES,
  DocumentMetadata,
  getDocumentTypes,
} from '@/lib/config/dana-kematian-documents';

interface DanaKematianDocumentWorkspaceProps {
  claim: DanaKematian | null;
  formData: CreateDanaKematianInput;
  onFormDataChange: (data: CreateDanaKematianInput) => void;
  onSave?: () => void;
  isSaving?: boolean;
  mode: 'create' | 'edit' | 'view';
  userRole?: 'cabang' | 'pusat' | 'admin';
  disabled?: boolean;
}

export function DanaKematianDocumentWorkspace({
  claim,
  formData,
  onFormDataChange,
  onSave,
  isSaving = false,
  mode = 'edit',
  userRole = 'cabang',
  disabled = false,
}: DanaKematianDocumentWorkspaceProps) {
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [activeDocumentTab, setActiveDocumentTab] = useState<'semua' | 'wajib' | 'kondisional' | 'pendukung'>('semua');
  const [documentMetadata, setDocumentMetadata] = useState<DocumentMetadata>({});
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Initialize document metadata from claim or form data
  useEffect(() => {
    if (claim?.document_metadata) {
      setDocumentMetadata(claim.document_metadata as DocumentMetadata);
    }
  }, [claim]);

  // Auto-save functionality
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mode !== 'view' && Object.keys(documentMetadata).length > 0) {
        handleAutoSave();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [documentMetadata, mode]);

  const handleAutoSave = async () => {
    setAutoSaveStatus('saving');
    try {
      // Update form data with document metadata
      onFormDataChange({
        ...formData,
        document_metadata: documentMetadata,
      });
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    } catch (error) {
      setAutoSaveStatus('error');
      console.error('Auto-save failed:', error);
    }
  };

  // Determine conditional document visibility
  const spouseAlive = useMemo(() => {
    // Check if we should show Surat Nikah
    // This is a business rule - you may need to adjust based on your logic
    return formData.spouse_alive !== false;
  }, [formData.spouse_alive]);

  const bothDeceased = useMemo(() => {
    // Check if both husband and wife are deceased
    // This is a business rule - you may need to adjust based on your logic
    return formData.both_deceased === true;
  }, [formData.both_deceased]);

  // Get document types based on conditions
  const visibleDocumentTypes = useMemo(() => {
    return getDocumentTypes({
      category: activeDocumentTab === 'semua' ? 'all' : activeDocumentTab,
      spouseAlive,
      bothDeceased,
    });
  }, [activeDocumentTab, spouseAlive, bothDeceased]);

  // Map document types to their current state
  const documents = useMemo(() => {
    return visibleDocumentTypes.map((docType) => ({
      documentType: docType,
      fileUrl: (formData as any)[docType.fileKey] || null,
      isVerified: claim ? (claim as any)[docType.verifiedKey] || false : false,
      metadata: documentMetadata[docType.id] || {},
    }));
  }, [visibleDocumentTypes, formData, claim, documentMetadata]);

  const handleFileChange = (documentId: string, url: string) => {
    const docType = DOCUMENT_TYPES.find((d) => d.id === documentId);
    if (!docType) return;

    onFormDataChange({
      ...formData,
      [docType.fileKey]: url,
    });
  };

  const handleMetadataChange = (documentId: string, metadata: DocumentMetadata[string]) => {
    setDocumentMetadata((prev) => ({
      ...prev,
      [documentId]: metadata,
    }));
  };

  const handleVerify = (documentId: string) => {
    const docType = DOCUMENT_TYPES.find((d) => d.id === documentId);
    if (!docType) return;

    // Toggle verification status
    const currentValue = (claim as any)?.[docType.verifiedKey] || false;
    onFormDataChange({
      ...formData,
      [docType.verifiedKey]: !currentValue,
    });
  };

  const handleActionClick = (actionId: string) => {
    // Handle action reminder clicks
    console.log('Action clicked:', actionId);
    // You can add specific logic here based on the action
  };

  const canVerify = userRole === 'pusat' || userRole === 'admin';

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="shrink-0 border-b px-4 py-3 flex items-center justify-between bg-card">
        <div>
          <h2 className="text-lg font-semibold">Workspace Dokumen</h2>
          <p className="text-xs text-muted-foreground">
            {mode === 'view' ? 'Mode lihat dokumen' : 'Kelola dokumen pengajuan'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {autoSaveStatus === 'saved' && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Tersimpan
            </span>
          )}
          {autoSaveStatus === 'saving' && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              Menyimpan...
            </span>
          )}
          {autoSaveStatus === 'error' && (
            <span className="text-xs text-red-600 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              Gagal menyimpan
            </span>
          )}
          {onSave && mode !== 'view' && (
            <Button size="sm" onClick={onSave} disabled={isSaving || disabled} className="gap-2">
              <Save className="h-4 w-4" />
              Simpan
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Progress */}
        {leftPanelOpen && (
          <div className="w-72 shrink-0 border-r overflow-y-auto bg-card p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">Progres</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLeftPanelOpen(false)}
                  className="h-7 w-7 p-0"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>

              {claim && <WorkflowTimeline claim={claim} vertical compact />}

              {/* Quick Stats */}
              {claim && (
                <div className="space-y-2 pt-4 border-t">
                  <div className="text-xs font-medium text-muted-foreground">Status Proses</div>
                  <div className="text-sm font-medium capitalize">
                    {claim.status_proses.replace('_', ' ')}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!leftPanelOpen && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLeftPanelOpen(true)}
            className="h-8 w-8 p-0 rounded-l-none border-l-0"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        )}

        {/* Center Panel - Documents */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            <Tabs value={activeDocumentTab} onValueChange={(v) => setActiveDocumentTab(v as any)}>
              <TabsList className="mb-6">
                <TabsTrigger value="semua">Semua</TabsTrigger>
                <TabsTrigger value="wajib">Wajib</TabsTrigger>
                <TabsTrigger value="kondisional">Kondisional</TabsTrigger>
                <TabsTrigger value="pendukung">Pendukung</TabsTrigger>
              </TabsList>

              <TabsContent value={activeDocumentTab}>
                <DocumentGrid
                  documents={documents}
                  onFileChange={handleFileChange}
                  onMetadataChange={handleMetadataChange}
                  onVerify={canVerify && mode !== 'view' ? handleVerify : undefined}
                  canVerify={canVerify && mode !== 'view'}
                  disabled={disabled || mode === 'view'}
                  spouseAlive={spouseAlive}
                  bothDeceased={bothDeceased}
                  showCategoryHeaders={activeDocumentTab === 'semua'}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Right Panel - Actions */}
        {rightPanelOpen && (
          <div className="w-80 shrink-0 border-l overflow-y-auto bg-card p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">Tindakan & Notifikasi</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRightPanelOpen(false)}
                  className="h-7 w-7 p-0"
                >
                  <PanelRightClose className="h-4 w-4" />
                </Button>
              </div>

              {claim && (
                <ActionReminders
                  claim={claim}
                  userRole={userRole}
                  onActionClick={handleActionClick}
                />
              )}

              {/* Conditional Settings */}
              {mode !== 'view' && (
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="text-xs font-medium text-muted-foreground">Pengaturan Dokumen</h4>

                  <div className="space-y-2">
                    <label className="text-sm">Status Pasangan</label>
                    <select
                      className="w-full px-3 py-2 text-sm border rounded-md"
                      value={formData.spouse_alive === false ? 'deceased' : 'alive'}
                      onChange={(e) => {
                        onFormDataChange({
                          ...formData,
                          spouse_alive: e.target.value === 'alive',
                        });
                      }}
                      disabled={disabled}
                    >
                      <option value="alive">Masih hidup (perlu Surat Nikah)</option>
                      <option value="deceased">Sudah meninggal</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm">Kedua Pasangan</label>
                    <select
                      className="w-full px-3 py-2 text-sm border rounded-md"
                      value={formData.both_deceased === true ? 'both' : 'not_both'}
                      onChange={(e) => {
                        onFormDataChange({
                          ...formData,
                          both_deceased: e.target.value === 'both',
                        });
                      }}
                      disabled={disabled}
                    >
                      <option value="not_both">Tidak keduanya meninggal</option>
                      <option value="both">Keduanya sudah meninggal</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!rightPanelOpen && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRightPanelOpen(true)}
            className="h-8 w-8 p-0 rounded-r-none border-r-0"
          >
            <PanelRightOpen className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
