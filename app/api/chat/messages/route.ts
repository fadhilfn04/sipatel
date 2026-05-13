import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { supabaseAdmin } from '@/lib/supabase-storage';

function getClient() {
  if (!supabaseAdmin) throw new Error('Supabase admin client not configured.');
  return supabaseAdmin;
}

// GET /api/chat/messages — fetch recent messages
export async function GET(request: NextRequest) {
  try {
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '60'), 200);

    const { data, error } = await getClient()
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ messages: data || [] });
  } catch (error: any) {
    console.error('GET /api/chat/messages error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/chat/messages — send a message
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message } = await request.json();
    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    const { data, error } = await getClient()
      .from('chat_messages')
      .insert([{
        user_id:    session.user.id,
        user_name:  session.user.name || 'Anonymous',
        user_avatar: session.user.avatar || null,
        user_email: session.user.email || null,
        message:    message.trim(),
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ message: data }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/chat/messages error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
