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
  ordinal_position: number
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
    const dbUrl = Deno.env.get('SUPABASE_DB_URL')
    
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

    // Check if user is admin using service role to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()
    
    if (roleError) {
      console.error('[database-backup] Role check error:', roleError.message)
    }
    
    if (roleData?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Use service role client for all database operations (RLS bypass)
    const supabase = supabaseAdmin

    const { action, ...params } = await req.json()
    console.log(`[database-backup] Action: ${action}, User: ${user.id}`)

    switch (action) {
      case 'discover_schema': {
        const tables = await discoverSchema(supabase)
        return new Response(JSON.stringify({ tables }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'export_table': {
        const { table_name, limit = 2000, offset = 0 } = params
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

// Known public tables
const KNOWN_TABLES = [
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

async function discoverSchema(supabase: any): Promise<TableInfo[]> {
  console.log('[discover_schema] Starting schema discovery...')
  const tables: TableInfo[] = []

  for (const tableName of KNOWN_TABLES) {
    try {
      // 1. Get columns from information_schema pattern (using a known working approach)
      const columns = await getTableColumns(supabase, tableName)
      
      // 2. Get exact row count using service role (bypasses RLS)
      const { count, error: countError } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })

      if (countError) {
        console.log(`[discover_schema] Count error for ${tableName}: ${countError.message}`)
        continue
      }

      const rowCount = count ?? 0
      console.log(`[discover_schema] ${tableName}: ${rowCount} rows, ${columns.length} columns`)

      // Determine primary key
      const primaryKey = columns.some(c => c.column_name === 'id') ? ['id'] : undefined

      tables.push({
        table_name: tableName,
        row_count: rowCount,
        columns,
        primary_key: primaryKey
      })
    } catch (err) {
      console.error(`[discover_schema] Error with table ${tableName}:`, err)
    }
  }

  console.log(`[discover_schema] Discovered ${tables.length} tables`)
  return tables
}

async function getTableColumns(supabase: any, tableName: string): Promise<ColumnInfo[]> {
  // Since we can't query information_schema directly via PostgREST,
  // we need to get column info from a sample row OR from the types we know
  
  // First try to get a sample row
  const { data: sampleData, error: sampleError } = await supabase
    .from(tableName)
    .select('*')
    .limit(1)

  if (!sampleError && sampleData && sampleData.length > 0) {
    // Infer columns from sample row
    const sampleRow = sampleData[0]
    const columns: ColumnInfo[] = []
    let position = 1
    
    for (const [key, value] of Object.entries(sampleRow)) {
      columns.push({
        column_name: key,
        data_type: inferDataType(value),
        is_nullable: true,
        column_default: null,
        ordinal_position: position++
      })
    }
    return columns
  }

  // If table is empty, use hardcoded column definitions
  return getKnownTableColumns(tableName)
}

// Hardcoded column definitions for when tables are empty
function getKnownTableColumns(tableName: string): ColumnInfo[] {
  const tableColumns: Record<string, string[]> = {
    'construction_status_history': ['id', 'project_id', 'status', 'changed_by', 'changed_at', 'note'],
    'document_files': ['id', 'document_id', 'original_name', 'storage_path', 'mime_type', 'file_size', 'uploaded_by', 'uploaded_at'],
    'documents': ['id', 'project_id', 'doc_type', 'doc_status', 'submitted_at', 'issued_at', 'due_at', 'owner_user_id', 'note', 'created_at', 'updated_at', 'created_by'],
    'investor_contacts': ['id', 'investor_id', 'contact_name', 'title', 'department', 'phone', 'mobile', 'email', 'line_id', 'role_tags', 'is_primary', 'is_active', 'note', 'created_at', 'updated_at', 'created_by'],
    'investor_payment_methods': ['id', 'investor_id', 'method_type', 'bank_name', 'bank_code', 'branch_name', 'account_name', 'account_number', 'is_default', 'note', 'created_at', 'updated_at', 'created_by'],
    'investor_year_counters': ['id', 'year', 'investor_code', 'last_seq', 'created_at', 'updated_at'],
    'investors': ['id', 'investor_code', 'company_name', 'investor_type', 'owner_name', 'owner_title', 'tax_id', 'address', 'phone', 'email', 'contact_person', 'note', 'created_at', 'updated_at', 'created_by'],
    'partners': ['id', 'name', 'partner_type', 'contact_person', 'contact_phone', 'email', 'address', 'is_active', 'note', 'created_at', 'updated_at', 'created_by'],
    'profiles': ['id', 'email', 'full_name', 'avatar_url', 'created_at', 'updated_at'],
    'project_construction_assignments': ['id', 'project_id', 'partner_id', 'construction_work_type', 'assignment_status', 'planned_start_date', 'planned_end_date', 'actual_start_date', 'actual_end_date', 'note', 'created_at', 'updated_at', 'created_by'],
    'project_status_history': ['id', 'project_id', 'status', 'changed_by', 'changed_at', 'note', 'attachment_path'],
    'projects': ['id', 'project_code', 'project_name', 'status', 'investor_id', 'capacity_kwp', 'actual_installed_capacity', 'city', 'district', 'address', 'coordinates', 'land_owner', 'land_owner_contact', 'contact_person', 'contact_phone', 'installation_type', 'grid_connection_type', 'power_phase_type', 'power_voltage', 'pole_status', 'construction_status', 'feeder_code', 'taipower_pv_id', 'fiscal_year', 'intake_year', 'seq', 'site_code_display', 'approval_date', 'drive_folder_id', 'drive_folder_url', 'folder_status', 'folder_error', 'note', 'created_at', 'updated_at', 'created_by'],
    'system_options': ['id', 'category', 'value', 'label', 'sort_order', 'is_active', 'created_at', 'updated_at', 'created_by'],
    'user_drive_tokens': ['id', 'user_id', 'access_token', 'refresh_token', 'token_expires_at', 'google_email', 'google_error', 'created_at', 'updated_at'],
    'user_roles': ['id', 'user_id', 'role', 'created_at']
  }

  const cols = tableColumns[tableName] || ['id']
  return cols.map((col, idx) => ({
    column_name: col,
    data_type: 'text',
    is_nullable: true,
    column_default: null,
    ordinal_position: idx + 1
  }))
}

function inferDataType(value: any): string {
  if (value === null) return 'text'
  if (typeof value === 'string') {
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
  return 'text'
}

async function exportTable(supabase: any, tableName: string, limit: number, offset: number) {
  console.log(`[export_table] Exporting ${tableName} (limit: ${limit}, offset: ${offset})`)
  
  // 1. Get EXACT total count first (using service role bypasses RLS)
  const { count: totalCount, error: countError } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true })
  
  if (countError) {
    console.error(`[export_table] Count error for ${tableName}:`, countError.message)
    throw countError
  }

  const total = totalCount ?? 0
  console.log(`[export_table] Total rows in ${tableName}: ${total}`)

  // 2. If table is empty, return immediately
  if (total === 0) {
    console.log(`[export_table] Table ${tableName} is empty`)
    return { 
      rows: [], 
      total_count: 0,
      hasMore: false
    }
  }

  // 3. Export with consistent ordering (CRITICAL for pagination)
  // Try ordering by 'id' first (most tables have this), then fall back to created_at
  let data: any[] = []
  let error: any = null

  // Try ordering by id first
  const result = await supabase
    .from(tableName)
    .select('*')
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1)
  
  data = result.data
  error = result.error

  if (error) {
    // If id ordering fails, try without explicit ordering
    console.log(`[export_table] Retrying ${tableName} without id ordering: ${error.message}`)
    const result2 = await supabase
      .from(tableName)
      .select('*')
      .range(offset, offset + limit - 1)

    if (result2.error) {
      console.error(`[export_table] Export error for ${tableName}:`, result2.error.message)
      throw result2.error
    }
    data = result2.data
  }

  const rows = data || []
  
  // 4. Calculate hasMore using EXACT formula: offset + fetched < total
  const hasMore = (offset + rows.length) < total
  
  console.log(`[export_table] Fetched ${rows.length} rows from ${tableName} (offset: ${offset}, total: ${total}, hasMore: ${hasMore})`)

  return { 
    rows, 
    total_count: total,
    hasMore
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

  // If table is empty, use known columns
  const existingColumns = data && data.length > 0 
    ? Object.keys(data[0]) 
    : getKnownTableColumns(tableName).map(c => c.column_name)
    
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
