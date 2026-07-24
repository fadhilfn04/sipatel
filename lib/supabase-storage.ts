import { createClient } from '@supabase/supabase-js';

// Create admin client with service role key for storage operations
// This bypasses RLS since we're using Prisma for auth, not Supabase auth
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn('Supabase service role key not configured. File uploads may fail.');
}

export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : null;

// Folder structure in dana-kematian bucket
export type DanaKematianFolder =
  | 'sk-pensiun'
  | 'surat-kematian'
  | 'surat-pernyataan-ahli-waris'
  | 'kartu-keluarga'
  | 'e-ktp'
  | 'surat-nikah'
  | 'surat-keterangan'
  | 'dokumen-pendukung'
  | 'bukti-penyerahan'
  | 'laporan-periode';

// Folder structure in anggota bucket
export type AnggotaFolder =
  | 'gambar-kondisi-tempat-tinggal'
  | 'e-ktp'
  | 'kartu-keluarga'
  | 'npwp'
  | 'dokumen-lainnya';

// File validation config
const FILE_CONFIG = {
  maxSize: 5 * 1024 * 1024, // 5MB
  allowedTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
} as const;

export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > FILE_CONFIG.maxSize) {
    return {
      valid: false,
      error: `File size must be less than ${FILE_CONFIG.maxSize / 1024 / 1024}MB`,
    };
  }

  // Check file type
  if (!FILE_CONFIG.allowedTypes.includes(file.type as any)) {
    return {
      valid: false,
      error: 'Only PDF and image files (JPEG, PNG) are allowed',
    };
  }

  return { valid: true };
}

export async function uploadToSupabaseStorage(
  file: File,
  folder: DanaKematianFolder
): Promise<string> {
  try {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not configured. Please set SUPABASE_SERVICE_ROLE_KEY environment variable.');
    }

    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const filename = `${timestamp}-${randomString}-${file.name}`;
    const filePath = `${folder}/${filename}`;

    console.log('Uploading file:', { filename: file.name, size: file.size, folder, filePath });

    // Upload to Supabase storage using admin client (bypasses RLS)
    const { data, error } = await supabaseAdmin.storage
      .from('dana-kematian')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Supabase storage error:', error);
      throw new Error(error.message);
    }

    // Get public URL
    const { data: publicUrlData } = supabaseAdmin.storage
      .from('dana-kematian')
      .getPublicUrl(filePath);

    console.log('File uploaded successfully:', { path: filePath, url: publicUrlData.publicUrl });
    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}

export async function uploadToSupabaseStorageGeneric(
  file: File,
  bucket: 'dana-kematian' | 'anggota',
  folder: string
): Promise<string> {
  try {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not configured. Please set SUPABASE_SERVICE_ROLE_KEY environment variable.');
    }

    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const filename = `${timestamp}-${randomString}-${file.name}`;
    const filePath = `${folder}/${filename}`;

    console.log('Uploading file:', { filename: file.name, size: file.size, bucket, folder, filePath });

    // Upload to Supabase storage using admin client (bypasses RLS)
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Supabase storage error:', error);
      throw new Error(error.message);
    }

    // Get public URL
    const { data: publicUrlData } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(filePath);

    console.log('File uploaded successfully:', { path: filePath, url: publicUrlData.publicUrl });
    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}

export async function deleteFromSupabaseStorage(fileUrl: string, bucket: 'dana-kematian' | 'anggota' = 'dana-kematian'): Promise<void> {
  try {
    if (!supabaseAdmin) {
      console.warn('Supabase admin client not configured');
      return;
    }

    if (!fileUrl) {
      console.warn('No file URL provided for deletion');
      return;
    }

    // Extract file path from URL
    // Supabase public URL format: https://xxx.supabase.co/storage/v1/object/public/bucket-name/folder/file.ext
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split('/');
    const bucketIndex = pathParts.indexOf(bucket);

    if (bucketIndex === -1 || bucketIndex + 1 >= pathParts.length) {
      console.warn('Invalid Supabase storage URL:', fileUrl);
      return;
    }

    const filePath = pathParts.slice(bucketIndex + 1).join('/');

    console.log('Deleting file:', { bucket, filePath });

    // Delete from Supabase storage using admin client
    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .remove([filePath]);

    if (error) {
      console.error('Supabase storage deletion error:', error);
      throw new Error(error.message);
    }

    console.log('File deleted successfully:', { bucket, path: filePath });
  } catch (error) {
    console.error('Delete failed:', error);
    throw error;
  }
}

export function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
}

export function isPdfFile(filename: string): boolean {
  return getFileExtension(filename).toLowerCase() === 'pdf';
}

export function isImageFile(filename: string): boolean {
  const ext = getFileExtension(filename).toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
}
