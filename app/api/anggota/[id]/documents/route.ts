import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requirePermission, unauthorizedResponse } from '@/lib/rbac-server';
import { PERMISSIONS } from '@/lib/rbac';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Check permission
  const user = await requirePermission(PERMISSIONS.VIEW_KEANGGOTAAN);
  if (!user) {
    return unauthorizedResponse();
  }

  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const documentType = searchParams.get('type');

    if (!documentType) {
      return NextResponse.json(
        { error: 'Document type is required' },
        { status: 400 }
      );
    }

    // Valid document types
    const validDocumentTypes = ['e_ktp', 'kartu_keluarga', 'npwp', 'nomor_sk_pensiun'];
    if (!validDocumentTypes.includes(documentType)) {
      return NextResponse.json(
        { error: 'Invalid document type' },
        { status: 400 }
      );
    }

    // Fetch anggota data
    const { data: anggota, error } = await supabase
      .from('anggota')
      .select(documentType)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !anggota) {
      return NextResponse.json(
        { error: 'Anggota not found' },
        { status: 404 }
      );
    }

    const documentValue = anggota[documentType as keyof typeof anggota];

    if (!documentValue) {
      return NextResponse.json(
        { error: 'Document not available for this member' },
        { status: 404 }
      );
    }

    // Return document information
    return NextResponse.json({
      documentType,
      documentNumber: documentValue,
      anggotaId: id,
      generatedAt: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Error in GET /api/anggota/[id]/documents:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}