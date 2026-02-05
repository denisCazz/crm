import { NextRequest, NextResponse } from 'next/server';
import { requestPasswordReset } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email è obbligatoria' },
        { status: 400 }
      );
    }

    const result = await requestPasswordReset(email);

    // TODO: Invia email con link di reset
    // Il link dovrebbe essere: /reset-password?token=${result.token}
    
    // Per sicurezza, rispondi sempre con successo anche se l'email non esiste
    return NextResponse.json({
      message: 'Se l\'email esiste nel nostro sistema, riceverai le istruzioni per il reset.',
      // In sviluppo, puoi includere il token per testing
      ...(process.env.NODE_ENV === 'development' && result.token ? { token: result.token } : {}),
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
