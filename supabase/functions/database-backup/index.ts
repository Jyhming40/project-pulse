import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TableInfo {
  table_name: string
  row_count: number
  columns: ColumnInfo[]
  primary_key?: string[]
  unique_keys?: string[][]
}

interface ColumnInfo {
  column_name: string
  data_type: string
  is_nullable: boolean
  column_default: string | null
}

interface ImportRow {
  row_index: number
  data: Record<string, any>
}

interface ImportError {
  row: number
  column?: string
  reason: string
}

interface ImportResult {
  table: string
  inserted: number
  updated: number
  skipped: number
  errors: ImportError[]
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create client with user's token to check permissions
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })
    
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid user' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if user is admin
    const { data: roleData } = await supabaseUser.from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
    if (roleData?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Use service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { action, ...params } = await req.json()
    console.log(`[database-backup] Action: ${action}`)

    switch (action) {
      case 'discover_schema': {
        const tables = await discoverSchema(supabase)
        return new Response(JSON.stringify({ tables }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'export_table': {
        const { table_name, limit = 10000, offset = 0 } = params
        const data = await exportTable(supabase, table_name, limit, offset)
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'import_batch': {
        const { table_name, rows, mode, upsert_key } = params
        const result = await importBatch(supabase, table_name, rows, mode, upsert_key)
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'validate_import': {
        const { table_name, columns } = params
        const result = await validateImport(supabase, table_name, columns)
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[database-backup] Error:', error)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function discoverSchema(supabase: any): Promise<TableInfo[]> {
  // Get all public tables
  const { data: tablesData, error: tablesError } = await supabase
    .rpc('get_public_tables_info')

  if (tablesError) {
    // Fallback: use information_schema via direct query
    console.log('[discover_schema] RPC not found, using fallback method')
    return await discoverSchemaFallback(supabase)
  }

  return tablesData
}

async function discoverSchemaFallback(supabase: any): Promise<TableInfo[]> {
  // Get list of tables using the supabase client
  const tables: TableInfo[] = []
  
  // Known tables from the schema - we'll query each one
  const knownTables = [
    'construction_status_history',
    'document_files', 
    'documents',
    'investor_contacts',
    'investor_payment_methods',
    'investor_year_counters',
    'investors',
    'partners',
    'profiles',
    'project_construction_assignments',
    'project_status_history',
    'projects',
    'system_options',
    'user_drive_tokens',
    'user_roles'
  ]

  for (const tableName of knownTables) {
    try {
      // Get row count
      const { count, error: countError } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })

      if (countError) {
        console.log(`[discover_schema] Skipping table ${tableName}: ${countError.message}`)
        continue
      }

      // Get one row to infer columns
      const { data: sampleData, error: sampleError } = await supabase
        .from(tableName)
        .select('*')
        .limit(1)

      const columns: ColumnInfo[] = []
      if (sampleData && sampleData.length > 0) {
        const sampleRow = sampleData[0]
        for (const [key, value] of Object.entries(sampleRow)) {
          columns.push({
            column_name: key,
            data_type: inferDataType(value),
            is_nullable: true,
            column_default: null
          })
        }
      }

      // Infer primary key (usually 'id')
      const primaryKey = columns.some(c => c.column_name === 'id') ? ['id'] : undefined

      tables.push({
        table_name: tableName,
        row_count: count || 0,
        columns,
        primary_key: primaryKey
      })
    } catch (err) {
      console.log(`[discover_schema] Error with table ${tableName}:`, err)
    }
  }

  return tables
}

function inferDataType(value: any): string {
  if (value === null) return 'unknown'
  if (typeof value === 'string') {
    // Check if it's a date
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'timestamp'
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return 'uuid'
    return 'text'
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'numeric'
  }
  if (typeof value === 'boolean') return 'boolean'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'object') return 'jsonb'
  return 'unknown'
}

async function exportTable(supabase: any, tableName: string, limit: number, offset: number) {
  console.log(`[export_table] Exporting ${tableName} (limit: ${limit}, offset: ${offset})`)
  
  const { data, error, count } = await supabase
    .from(tableName)
    .select('*', { count: 'exact' })
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: true, nullsFirst: true })

  if (error) {
    // Try without ordering if created_at doesn't exist
    const { data: data2, error: error2, count: count2 } = await supabase
      .from(tableName)
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1)

    if (error2) throw error2
    return { rows: data2 || [], total: count2 || 0, hasMore: (offset + limit) < (count2 || 0) }
  }

  return { 
    rows: data || [], 
    total: count || 0,
    hasMore: (offset + limit) < (count || 0)
  }
}

async function validateImport(supabase: any, tableName: string, columns: string[]) {
  // Get a sample row to check column existence
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1)

  if (error) {
    return { valid: false, error: `Table ${tableName} not found or inaccessible` }
  }

  const existingColumns = data && data.length > 0 ? Object.keys(data[0]) : []
  const missingColumns = columns.filter(c => !existingColumns.includes(c) && c !== '__row_index')
  const extraColumns = existingColumns.filter(c => !columns.includes(c))

  return {
    valid: true,
    existingColumns,
    missingColumns,
    extraColumns,
    warning: missingColumns.length > 0 ? `Some columns will be ignored: ${missingColumns.join(', ')}` : null
  }
}

async function importBatch(
  supabase: any, 
  tableName: string, 
  rows: ImportRow[], 
  mode: 'insert' | 'upsert' | 'skip',
  upsertKey?: string
): Promise<ImportResult> {
  console.log(`[import_batch] Importing ${rows.length} rows to ${tableName} (mode: ${mode})`)
  
  const result: ImportResult = {
    table: tableName,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: []
  }

  // Process rows in smaller chunks for better error handling
  const chunkSize = 100
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    
    for (const row of chunk) {
      try {
        // Clean the data - remove __row_index and empty strings for nullable fields
        const cleanData = { ...row.data }
        delete cleanData.__row_index
        
        // Convert empty strings to null for non-text fields
        for (const [key, value] of Object.entries(cleanData)) {
          if (value === '') {
            cleanData[key] = null
          }
          // Parse dates in ISO format
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            cleanData[key] = value
          }
        }

        if (mode === 'insert') {
          const { error } = await supabase.from(tableName).insert(cleanData)
          if (error) {
            if (error.code === '23505') { // Unique constraint violation
              result.errors.push({
                row: row.row_index,
                reason: `Duplicate key: ${error.message}`
              })
            } else {
              result.errors.push({
                row: row.row_index,
                reason: error.message
              })
            }
          } else {
            result.inserted++
          }
        } else if (mode === 'upsert') {
          if (!upsertKey) {
            result.errors.push({
              row: row.row_index,
              reason: 'Upsert key not specified'
            })
            continue
          }
          
          const { error } = await supabase
            .from(tableName)
            .upsert(cleanData, { onConflict: upsertKey })
          
          if (error) {
            result.errors.push({
              row: row.row_index,
              reason: error.message
            })
          } else {
            result.updated++ // Count as updated for upsert
          }
        } else if (mode === 'skip') {
          // Check if record exists
          const keyValue = cleanData[upsertKey || 'id']
          if (keyValue) {
            const { data: existing } = await supabase
              .from(tableName)
              .select('id')
              .eq(upsertKey || 'id', keyValue)
              .maybeSingle()
            
            if (existing) {
              result.skipped++
              continue
            }
          }
          
          const { error } = await supabase.from(tableName).insert(cleanData)
          if (error) {
            if (error.code === '23505') {
              result.skipped++
            } else {
              result.errors.push({
                row: row.row_index,
                reason: error.message
              })
            }
          } else {
            result.inserted++
          }
        }
      } catch (err: unknown) {
        const errMessage = err instanceof Error ? err.message : 'Unknown error'
        result.errors.push({
          row: row.row_index,
          reason: errMessage
        })
      }
    }
  }

  console.log(`[import_batch] Result: inserted=${result.inserted}, updated=${result.updated}, skipped=${result.skipped}, errors=${result.errors.length}`)
  return result
}
