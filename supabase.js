// supabase.js
const supabaseUrl = 'YOUR_SUPABASE_URL'
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'

const supabase = supabase.createClient(supabaseUrl, supabaseKey)

export default supabase