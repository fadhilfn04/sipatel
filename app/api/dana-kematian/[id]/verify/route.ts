import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DanaKematian } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    const body = await request.json();
    const {
      approved,
      rejectionReason,
      rejectionCategory,
      notes,
      verifiedBy,
      verifiedAt,
      benefitAmount,
      documentVerifications,
      eligibilityChecks
    } = body;

    // Get current claim
    const { data: claim, error: fetchError } = await supabase
      .from('dana_kematian')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !claim) {
      return NextResponse.json(
        { error: 'Claim not found' },
        { status: 404 }
      );
    }

    // Verify claim is in correct status
    if (claim.status_proses !== 'proses_pusat') {
      return NextResponse.json(
        { error: 'Claim is not in verification status' },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (approved) {
      // Approve the claim
      updateData.status_proses = 'verified';
      updateData.waktu_3 = verifiedAt || new Date().toISOString();
      updateData.is_validated_pp = true;
      updateData.is_approved = true;

      if (benefitAmount) {
        updateData.besaran_dana_kematian = benefitAmount;
      }

      // Update document verification flags
      if (documentVerifications) {
        Object.entries(documentVerifications).forEach(([docKey, verification]: [string, any]) => {
          const verifiedField = `${docKey.replace('file_', 'dokumen_')}_verified`;
          updateData[verifiedField] = verification.verified;
        });
      }

      // Add verification notes
      if (notes) {
        updateData.pusat_catatan_verifikasi = notes;
      }

    } else if (rejectionCategory === 'document' && !rejectionReason.includes('perbaikan')) {
      // Return to PC for corrections
      updateData.status_proses = 'pending_dokumen';
      updateData.waktu_3 = verifiedAt || new Date().toISOString();
      updateData.pusat_catatan_verifikasi = notes || 'Dokumen dikembalikan untuk perbaikan';
      updateData.can_resubmit = true;
      updateData.resubmission_deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    } else {
      // Reject the claim
      updateData.status_proses = 'ditolak';
      updateData.waktu_3 = verifiedAt || new Date().toISOString();
      updateData.rejection_reason = rejectionReason || notes;
      updateData.rejection_category = rejectionCategory;
      updateData.can_resubmit = rejectionCategory !== 'fraud';
    }

    // Update the claim
    const { data: updatedClaim, error: updateError } = await supabase
      .from('dana_kematian')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating claim:', updateError);
      return NextResponse.json(
        { error: 'Failed to update claim' },
        { status: 500 }
      );
    }

    // Log the verification action
    const { error: logError } = await supabase
      .from('riwayat_proses_dakem')
      .insert({
        dana_kematian_id: params.id,
        status_dari: 'proses_pusat',
        status_ke: approved ? 'verified' : rejectionCategory === 'document' ? 'pending_dokumen' : 'ditolak',
        aksi: approved ? 'pp_verified' : rejectionCategory === 'document' ? 'pp_returned_to_pc' : 'pp_rejected',
        pelaku: verifiedBy || 'PP Validator',
        pelaku_role: 'pusat',
        catatan: notes || rejectionReason,
        data_sebelumnya: { status_proses: claim.status_proses },
        data_setelahnya: { status_proses: updateData.status_proses }
      });

    if (logError) {
      console.error('Error logging verification:', logError);
    }

    return NextResponse.json({
      success: true,
      claim: updatedClaim,
      message: approved
        ? 'Pengajuan berhasil diverifikasi dan disetujui'
        : rejectionCategory === 'document'
        ? 'Pengajuan dikembalikan ke PC untuk perbaikan'
        : 'Pengajuan ditolak'
    });

  } catch (error) {
    console.error('Error in verification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve claim for verification
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    const { data: claim, error } = await supabase
      .from('dana_kematian')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !claim) {
      return NextResponse.json(
        { error: 'Claim not found' },
        { status: 404 }
      );
    }

    // Get verification history
    const { data: history } = await supabase
      .from('riwayat_proses_dakem')
      .select('*')
      .eq('dana_kematian_id', params.id)
      .order('waktu_timestamp', { ascending: false })
      .limit(10);

    return NextResponse.json({
      claim,
      history
    });

  } catch (error) {
    console.error('Error retrieving claim:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}