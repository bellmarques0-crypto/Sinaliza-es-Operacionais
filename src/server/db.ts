import { db as supabaseDb } from './db-supabase';

// Re-exportando do Supabase
export const db = supabaseDb;

// Funções síncronas para compatibilidade (adaptadores)
export function loadDatabase() {
  return {};
}

export function saveDatabase() {
  // Não faz nada - Supabase salva automaticamente
}
