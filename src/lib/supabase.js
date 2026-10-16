import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.PUBLIC_SUPABASE_URL
const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error(
    'Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY'
  )
}

export const supabase = createClient(url, key)