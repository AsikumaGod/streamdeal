// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Auth helpers ─────────────────────────────────────────────

export async function signInWithEmail(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
    },
  })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

// ── Deals helpers ─────────────────────────────────────────────

export async function fetchDeals() {
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('is_published', true)
    .order('is_hot', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// ── Watchlist helpers ─────────────────────────────────────────

export async function fetchWatchlist(userId) {
  const { data, error } = await supabase
    .from('watchlist')
    .select('deal_id')
    .eq('user_id', userId)
  if (error) throw error
  return new Set(data.map((r) => r.deal_id))
}

export async function addToWatchlist(userId, dealId) {
  const { error } = await supabase
    .from('watchlist')
    .insert({ user_id: userId, deal_id: dealId })
  if (error) throw error
}

export async function removeFromWatchlist(userId, dealId) {
  const { error } = await supabase
    .from('watchlist')
    .delete()
    .eq('user_id', userId)
    .eq('deal_id', dealId)
  if (error) throw error
}
