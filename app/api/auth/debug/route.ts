import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';
import { dbQuery } from '@/lib/mysql';

// ENDPOINT DI DEBUG - RIMUOVERE IN PRODUZIONE!
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e password richiesti' },
        { status: 400 }
      );
    }

    // Cerca utente
    const rows = await dbQuery<any>(
      `SELECT id, email, password_hash, is_active FROM users WHERE email = :email LIMIT 1`,
      { email: email.toLowerCase() }
    );
    const user = rows[0];
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found',
        details: 'Utente non trovato nel database',
      });
    }

    // Genera hash della password inserita
    const inputHash = hashPassword(password);

    // Confronta
    const match = inputHash === user.password_hash;

    return NextResponse.json({
      success: true,
      debug: {
        userExists: !!user,
        userId: user.id,
        email: user.email,
        isActive: user.is_active,
        passwordMatch: match,
        inputPasswordHash: inputHash.substring(0, 20) + '...',
        storedPasswordHash: user.password_hash.substring(0, 20) + '...',
        hashesEqual: match,
      },
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: 'Errore interno', details: String(error) },
      { status: 500 }
    );
  }
}
