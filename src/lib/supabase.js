import { createClient } from '@supabase/supabase-js'

let supabase = null

if (typeof window !== 'undefined') {
  const url = import.meta.env.PUBLIC_SUPABASE_URL
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.warn('❌ Supabase env missing')
  } else {
    supabase = createClient(url, key)
  }
}

export { supabase }