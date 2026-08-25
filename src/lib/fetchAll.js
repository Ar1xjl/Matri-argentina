// Supabase/PostgREST caps how many rows a single request returns (a
// per-project "Max Rows" setting under Dashboard → Settings → API) — past
// that cap, `.select()` doesn't error, it just silently returns fewer rows
// than actually exist. Hit for real on the sibling DECCO-MatriSure app once
// its own serialized kit_units table crossed ~1900 rows (see project memory
// "decco-whitelabel-spinoff"). `kit_units` (Fase K) and `treatments` are the
// two tables here most likely to cross that same line as real operation
// accumulates data, so both go through this helper instead of a bare
// `.select()` — see project memory "prelaunch_data_cleanup" for the review
// that found this.
//
// Usage: pass a FACTORY (a function that returns a fresh query builder),
// not a query builder itself — a supabase-js builder is single-use once
// awaited, so each page needs its own fresh instance with `.range()` applied
// on top of it.
//
//   const { data, error } = await fetchAllRows(() =>
//     supabase.from('kit_units').select('*').order('created_at', { ascending: false })
//   )
const PAGE_SIZE = 1000

export async function fetchAllRows(buildQuery) {
  let rows = []
  let from = 0
  for (;;) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1)
    if (error) return { data: null, error }
    rows = rows.concat(data || [])
    if (!data || data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return { data: rows, error: null }
}
