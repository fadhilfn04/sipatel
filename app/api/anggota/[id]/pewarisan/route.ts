import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/anggota/[id]/pewarisan - Get inheritance history for an anggota
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // First, get the anggota's NIK
    const { data: anggota, error: anggotaError } = await supabase
      .from('anggota')
      .select('nik')
      .eq('id', id)
      .single();

    if (anggotaError || !anggota) {
      console.error('Error fetching anggota:', anggotaError);
      return NextResponse.json(
        { error: 'Anggota not found' },
        { status: 404 }
      );
    }

    // Find the nik_master with this NIK
    const { data: nikMaster, error: nikMasterError } = await supabase
      .from('nik_master')
      .select('id')
      .eq('nik', anggota.nik)
      .single();

    if (nikMasterError) {
      // No NIK master found means this NIK hasn't been inherited yet
      return NextResponse.json({
        data: [],
        message: 'No inheritance data found for this NIK',
      });
    }

    // Get all nik_kepemilikan for this nik_master
    const { data: kepemilikan, error: kepemilikanError } = await supabase
      .from('nik_kepemilikan')
      .select(`
        *,
        nik_master (
          nik
        )
      `)
      .eq('nik_id', nikMaster.id)
      .order('created_at', { ascending: false });

    if (kepemilikanError) {
      console.error('Error fetching kepemilikan:', kepemilikanError);
      return NextResponse.json(
        { error: 'Failed to fetch inheritance data', details: kepemilikanError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: kepemilikan || [],
      message: 'Inheritance data fetched successfully',
    });

  } catch (error) {
    console.error('Unexpected error in GET /api/anggota/[id]/pewarisan:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
