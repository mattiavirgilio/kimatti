import { NextRequest, NextResponse } from 'next/server';
import Retell from 'retell-sdk';

export async function POST(request: NextRequest) {
  try {
    const RETELL_API_KEY = process.env.RETELL_API_KEY;
    
    if (!RETELL_API_KEY) {
      return NextResponse.json(
        { error: 'RETELL_API_KEY ist nicht konfiguriert' },
        { status: 500 }
      );
    }

    const retellClient = new Retell({
      apiKey: RETELL_API_KEY,
    });

    const response = await retellClient.call.createWebCall({
      agent_id: process.env.RETELL_AGENT_ID!,
    });
    
    return NextResponse.json({
      access_token: response.access_token,
      call_id: response.call_id,
    });

  } catch (error) {
    console.error('Fehler beim Erstellen des Web Calls:', error);
    return NextResponse.json(
      { error: 'Fehler beim Erstellen des Web Calls' },
      { status: 500 }
    );
  }
}