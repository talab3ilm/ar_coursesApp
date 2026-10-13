// Client Supabase du front : clé anon + RLS lecture seule sur les lignes publiées.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants (voir .env.example)')
}

export const supabase = createClient(url ?? '', key ?? '', {
  auth: { persistSession: true, autoRefreshToken: true }, // session utile seulement pour /admin
})

export const storageUrl = (subjectId, courseId, file) =>
  `${url}/storage/v1/object/public/content/${subjectId}/${courseId}/${file}`
