import { Anggota, KategoriAnggotaEnum, StatusAnggotaEnum } from '@/lib/supabase';

/**
 * Get the unified category that combines kategori_anggota and status_anggota
 * This provides backward compatibility while using the merged field
 */
export function getUnifiedCategory(anggota: Anggota): KategoriAnggotaEnum {
  // Priority 1: If kategori_anggota is already a status-like value, use it
  if (['pegawai', 'istri', 'suami', 'anak'].includes(anggota.kategori_anggota)) {
    return anggota.kategori_anggota;
  }

  // Priority 2: If status_anggota has a value that can be used as category, use it
  if (['pegawai', 'istri', 'suami', 'anak'].includes(anggota.status_anggota)) {
    return anggota.status_anggota as KategoriAnggotaEnum;
  }

  // Priority 3: Default to original kategori_anggota
  return anggota.kategori_anggota;
}

/**
 * Get display properties for the unified category
 */
export function getUnifiedCategoryProps(category: KategoriAnggotaEnum): {
  variant: 'success' | 'destructive' | 'warning' | 'secondary';
  label: string;
  description: string;
} {
  const categoryMap: Record<string, { variant: 'success' | 'destructive' | 'warning' | 'secondary'; label: string; description: string }> = {
    // Original categories
    biasa: { variant: 'success', label: 'Biasa', description: 'Anggota biasa' },
    luar_biasa: { variant: 'warning', label: 'Luar Biasa', description: 'Anggota luar biasa' },
    kehormatan: { variant: 'warning', label: 'Kehormatan', description: 'Anggota kehormatan' },
    bukan_anggota: { variant: 'secondary', label: 'Bukan Anggota', description: 'Bukan anggota' },

    // Merged status values (now serving as categories)
    pegawai: { variant: 'success', label: 'Pegawai', description: 'Status Pegawai' },
    istri: { variant: 'warning', label: 'Istri', description: 'Status Istri' },
    suami: { variant: 'warning', label: 'Suami', description: 'Status Suami' },
    anak: { variant: 'secondary', label: 'Anak', description: 'Status Anak' },
  };

  return categoryMap[category] || { variant: 'secondary', label: category, description: category };
}

/**
 * Check if a member should be considered active based on unified category
 */
export function isMemberActive(anggota: Anggota): boolean {
  const unifiedCategory = getUnifiedCategory(anggota);
  const activeCategories = ['biasa', 'luar_biasa', 'kehormatan', 'pegawai'];
  return activeCategories.includes(unifiedCategory) && anggota.status_anggota !== 'meninggal';
}

/**
 * Get the legacy status for backward compatibility
 * @deprecated Use getUnifiedCategory instead
 */
export function getLegacyStatus(anggota: Anggota): StatusAnggotaEnum {
  return anggota.status_anggota;
}