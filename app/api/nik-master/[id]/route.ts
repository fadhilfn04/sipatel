import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/nik-master/[id] - Get single NIK master by ID
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { data: nikMaster, error } = await supabase
      .from('nik_master')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !nikMaster) {
      return NextResponse.json(
        { error: 'NIK master not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: nikMaster });
  } catch (error) {
    console.error('Error in GET /api/nik-master/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/nik-master/[id] - Update NIK master
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    // Check if NIK master exists
    const { data: existingNikMaster } = await supabase
      .from('nik_master')
      .select('id')
      .eq('id', id)
      .single();

    if (!existingNikMaster) {
      return NextResponse.json(
        { error: 'NIK master not found' },
        { status: 404 }
      );
    }

    // Update NIK master
    const { data: updatedNikMaster, error } = await supabase
      .from('nik_master')
      .update({
        nik: body.nik,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating NIK master:', error);
      return NextResponse.json(
        { error: 'Failed to update NIK master', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: updatedNikMaster,
      message: 'NIK master berhasil diupdate',
    });

  } catch (error) {
    console.error('Error in PUT /api/nik-master/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/nik-master/[id] - Delete NIK master
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Check if NIK master exists
    const { data: existingNikMaster } = await supabase
      .from('nik_master')
      .select('id')
      .eq('id', id)
      .single();

    if (!existingNikMaster) {
      return NextResponse.json(
        { error: 'NIK master not found' },
        { status: 404 }
      );
    }

    // Delete NIK master (cascade will delete related nik_kepemilikan)
    const { error } = await supabase
      .from('nik_master')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting NIK master:', error);
      return NextResponse.json(
        { error: 'Failed to delete NIK master', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'NIK master berhasil dihapus',
    });

  } catch (error) {
    console.error('Error in DELETE /api/nik-master/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
