import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.PUBLIC_SUPABASE_URL
const key = import.meta.env.PUBLIC_SUPABASE_KEY

if (!url || !key) {
  console.error('❌ Supabase env missing')
  throw new Error('Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_KEY')
}

export const supabase = createClient(url, key)