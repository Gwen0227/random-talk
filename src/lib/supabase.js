import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.PUBLIC_SUPABASE_URL
const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  console.warn('❌ Supabase env missing')
}

export const supabase = createClient(url, key)