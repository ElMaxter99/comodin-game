import { NextResponse } from 'next/server';
import { hostId } from '@/lib/server/api';
import { supabaseConfigured } from '@/lib/server/supabase';

/** Modo de acceso y si hay presentador con sesión (en desarrollo no hace falta entrar). */
export async function GET() {
  const supabase = supabaseConfigured();
  return NextResponse.json({ mode: supabase ? 'supabase' : 'dev', host: supabase ? !!(await hostId()) : true }, { headers: { 'Cache-Control': 'no-store' } });
}
