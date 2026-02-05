import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token non fornito' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const result = await getSessionFromToken(token);

    if (!result) {
      return NextResponse.json(
        { error: 'Sessione non valida o scaduta' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: result.user,
      session: result.session,
    });
  } catch (error) {
    console.error('Session verification error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
