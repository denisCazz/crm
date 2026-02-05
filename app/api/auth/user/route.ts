import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromToken, updateUser } from '@/lib/auth';

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
        { error: 'Sessione non valida' },
        { status: 401 }
      );
    }

    return NextResponse.json({ user: result.user });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token non fornito' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const sessionResult = await getSessionFromToken(token);

    if (!sessionResult) {
      return NextResponse.json(
        { error: 'Sessione non valida' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const result = await updateUser(sessionResult.user.id, body);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ user: result.user });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
