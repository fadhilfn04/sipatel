'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, User, MapPin, BadgeCheck, Loader2, X } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Anggota } from '@/lib/supabase';

interface MemberSearchModalProps {
  open: boolean;
  onClose: () => void;
  onMemberSelect: (member: Anggota) => void;
}

type SearchMode = 'nik' | 'nama';

export function MemberSearchModal({
  open,
  onClose,
  onMemberSelect,
}: MemberSearchModalProps) {
  const [searchMode, setSearchMode] = useState<SearchMode>('nik');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Anggota[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSearchResults([]);
      setSearchError('');
      setSelectedMemberId(null);
      setSearchMode('nik');
    }
  }, [open]);

  // Search function that calls the API directly
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchError('');
      setIsSearching(false);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const delayTimer = setTimeout(async () => {
      setIsSearching(true);
      setSearchError('');

      try {
        // Use large limit to ensure we get all matching results from DB
        const params = new URLSearchParams();
        params.set('search', query);
        params.set('limit', '100');
        params.set('page', '1');

        const response = await fetch(`/api/anggota?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Gagal mencari data anggota');
        }

        const result = await response.json();
        const allResults: Anggota[] = result.data || [];

        let filteredResults: Anggota[];

        if (searchMode === 'nik') {
          // Exact match on NIK for NIK search mode
          filteredResults = allResults.filter(
            m => m.nik.trim() === query
          );
          // If no exact match, try includes as fallback
          if (filteredResults.length === 0) {
            filteredResults = allResults.filter(
              m => m.nik.includes(query)
            );
          }
        } else {
          // Name search: filter by nama_anggota containing the query
          const queryLower = query.toLowerCase();
          filteredResults = allResults.filter(m =>
            m.nama_anggota.toLowerCase().includes(queryLower)
          );
        }

        if (filteredResults.length === 0) {
          setSearchError(
            searchMode === 'nik'
              ? 'Data anggota dengan NIK tersebut tidak ditemukan'
              : 'Tidak ada data anggota yang cocok'
          );
        }

        setSearchResults(filteredResults);
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return; // Ignore aborted requests
        }
        setSearchError('Gagal menghubungi server. Silakan coba lagi.');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400); // Debounce delay

    return () => {
      clearTimeout(delayTimer);
      controller.abort();
    };
  }, [searchQuery, searchMode]);

  // Handle member selection from results
  const handleMemberClick = (member: Anggota) => {
    setSelectedMemberId(member.id);
  };

  // Handle confirm selection
  const handleConfirmSelection = () => {
    if (selectedMemberId) {
      const member = searchResults.find(m => m.id === selectedMemberId);
      if (member) {
        onMemberSelect(member);
        onClose();
      }
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, member: Anggota) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleMemberClick(member);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pegawai':
        return 'primary' as const;
      case 'istri':
      case 'suami':
        return 'secondary' as const;
      case 'anak':
        return 'outline' as const;
      case 'meninggal':
        return 'destructive' as const;
      default:
        return 'primary' as const;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Search className="h-6 w-6" />
            Cari Data Anggota
          </DialogTitle>
          <DialogDescription>
            Pilih metode pencarian untuk menemukan data anggota.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex-1 flex flex-col overflow-hidden">
          {/* Search Mode Toggle */}
          <div className="flex gap-4 mb-4 shrink-0">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="searchMode"
                value="nik"
                checked={searchMode === 'nik'}
                onChange={(e) => setSearchMode(e.target.value as SearchMode)}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm font-medium">Cari berdasarkan NIK</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="searchMode"
                value="nama"
                checked={searchMode === 'nama'}
                onChange={(e) => setSearchMode(e.target.value as SearchMode)}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm font-medium">Cari berdasarkan Nama</span>
            </label>
          </div>

          {/* Search Input */}
          <div className="relative mb-4 shrink-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder={
                searchMode === 'nik'
                  ? 'Masukkan NIK anggota'
                  : 'Ketik nama anggota'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Loading State */}
          {isSearching && (
            <div className="flex items-center justify-center py-8 shrink-0">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Mencari data...</span>
            </div>
          )}

          {/* Error State */}
          {searchError && !isSearching && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4 shrink-0">
              <p className="text-sm text-destructive font-medium">{searchError}</p>
              <p className="text-xs text-destructive/70 mt-1">
                {searchMode === 'nik'
                  ? 'Pastikan NIK yang dimasukkan sudah benar'
                  : 'Coba gunakan kata kunci lain yang lebih spesifik'}
              </p>
            </div>
          )}

          {/* Search Results - Table View for Both NIK and Name Search */}
          {searchResults.length > 0 && !isSearching && (
            <div className="flex-1 overflow-y-auto border rounded-lg">
              <table className="w-full">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Pilih
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      NIK
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Nama Anggota
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Cabang
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {searchResults.map((member) => (
                    <tr
                      key={member.id}
                      onClick={() => handleMemberClick(member)}
                      onKeyDown={(e) => handleKeyDown(e, member)}
                      className={`hover:bg-muted/50 cursor-pointer transition-colors ${
                        selectedMemberId === member.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                      }`}
                      tabIndex={0}
                      role="button"
                      aria-selected={selectedMemberId === member.id}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="radio"
                          checked={selectedMemberId === member.id}
                          onChange={() => handleMemberClick(member)}
                          className="w-4 h-4 text-blue-600"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-mono">{member.nik}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{member.nama_anggota}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{member.nama_cabang}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={getStatusBadgeVariant(member.status_anggota)}>
                          {member.status_anggota.replace('_', ' ')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty State */}
          {!isSearching && !searchError && searchResults.length === 0 && searchQuery && (
            <div className="flex flex-col items-center justify-center py-12 shrink-0">
              <Search className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground font-medium">
                {searchMode === 'nik'
                  ? 'Tidak ditemukan data dengan NIK tersebut'
                  : 'Tidak ditemukan data dengan nama tersebut'}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {searchMode === 'nik'
                  ? 'Pastikan NIK yang dimasukkan sudah benar'
                  : 'Coba gunakan kata kunci lain yang lebih umum'}
              </p>
            </div>
          )}
        </DialogBody>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-4 border-t shrink-0">
          <div className="text-sm text-muted-foreground">
            {searchResults.length > 0 && (
              <span>Ditemukan {searchResults.length} data</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            {selectedMemberId && (
              <Button type="button" onClick={handleConfirmSelection}>
                Pilih Anggota
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

