import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/nik-master - Get all NIK master records
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('nik_master')
      .select('*', { count: 'exact' });

    // Search filter
    if (search) {
      query = query.ilike('nik', `%${search}%`);
    }

    // Get paginated data
    const { data: nikMasters, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching nik_master:', error);
      return NextResponse.json(
        { error: 'Failed to fetch NIK master data', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: nikMasters || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/nik-master:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/nik-master - Create new NIK master (when pensioner passes away)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.nik) {
      return NextResponse.json(
        { error: 'NIK is required' },
        { status: 400 }
      );
    }

    // Check if NIK master already exists
    const { data: existingNik } = await supabase
      .from('nik_master')
      .select('id')
      .eq('nik', body.nik)
      .single();

    if (existingNik) {
      return NextResponse.json(
        { error: 'NIK master already exists' },
        { status: 409 }
      );
    }

    // Create new NIK master
    const { data: newNikMaster, error } = await supabase
      .from('nik_master')
      .insert([{
        nik: body.nik,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating NIK master:', error);
      return NextResponse.json(
        { error: 'Failed to create NIK master', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: newNikMaster,
      message: 'NIK master berhasil dibuat',
    }, { status: 201 });

  } catch (error) {
    console.error('Unexpected error in POST /api/nik-master:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
