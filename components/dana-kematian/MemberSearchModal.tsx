'use client';

/**
 * Re-export komponen pencarian anggota.
 *
 * Komponen asli telah dipindahkan ke `components/anggota/MemberSearchModal.tsx`
 * agar dapat dipakai lintas modul (Dana Kematian, Perubahan Data Pribadi, dll).
 * File ini dipertahankan agar import lama (`./MemberSearchModal`) tetap berfungsi.
 */
export { MemberSearchModal } from '@/components/anggota/MemberSearchModal';
