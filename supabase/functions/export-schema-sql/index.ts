import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const sql = (query: string) =>
      supabase.rpc("exec_sql_readonly", { query_text: query }).then((r) => {
        if (r.error) throw new Error(`SQL error: ${r.error.message}`);
        return r.data;
      });

    // We'll build SQL directly using pg_catalog queries via supabase's postgres
    // Since we can't call rpc without a function, let's use direct REST queries
    // Actually, let's query information_schema tables via supabase client

    const lines: string[] = [];
    const push = (s: string) => lines.push(s);

    push("-- ============================================================");
    push("-- MQT Solar 完整資料庫結構匯出 (Schema-Only SQL Dump)");
    push(`-- 匯出時間: ${new Date().toISOString()}`);
    push("-- ============================================================");
    push("");

    // 1. Extensions
    push("-- ===================== EXTENSIONS =====================");
    push("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";");
    push("CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";");
    push("");

    // 2. Enum types - query from types table
    push("-- ===================== ENUM TYPES =====================");
    const { data: enumData } = await supabase
      .from("pg_catalog.pg_type" as any)
      .select("*");

    // Use direct SQL via edge function approach - query pg_enum
    // Since we can't query pg_catalog directly, let's hardcode from the data we already collected
    const enums: Record<string, string[]> = {};
    const enumRaw = [
      { type: "app_role", vals: ["admin", "staff", "viewer"] },
      { type: "audit_action", vals: ["DELETE", "RESTORE", "PURGE", "ARCHIVE", "UNARCHIVE", "CREATE", "UPDATE", "DB_RESET", "DB_EXPORT", "DB_IMPORT", "BRANDING_UPDATE"] },
      { type: "construction_status", vals: ["已開工", "尚未開工", "已掛錶", "待掛錶", "暫緩", "取消"] },
      { type: "contact_role_tag", vals: ["主要聯絡人", "財務", "工程", "法務", "行政", "業務", "其他"] },
      { type: "deletion_mode", vals: ["soft_delete", "archive", "hard_delete", "disable_only"] },
      { type: "doc_status", vals: ["未開始", "進行中", "已完成", "退件補正"] },
      { type: "doc_type", vals: ["台電審查意見書", "能源署同意備案", "結構簽證", "躉售合約", "報竣掛表", "設備登記", "土地契約", "其他"] },
      { type: "folder_status", vals: ["pending", "created", "failed"] },
      { type: "grid_connection_type", vals: ["高壓併低壓側", "低壓", "併內線－躉售", "併內線－自發自用"] },
      { type: "installation_type", vals: ["畜牧舍", "農業設施", "農棚", "地面型", "農舍", "住宅", "廠辦", "特目用建物", "特登工廠", "集合住宅", "其他設施", "新建物（農業）", "新建物（其他）"] },
      { type: "investor_type", vals: ["自有投資", "租賃投資", "SPC", "個人", "其他"] },
      { type: "milestone_type", vals: ["admin", "engineering"] },
      { type: "payment_method_type", vals: ["銀行轉帳", "支票", "現金", "信用卡", "其他"] },
      { type: "pole_status", vals: ["已立桿", "未立桿", "基礎完成", "無須", "需移桿", "亭置式"] },
      { type: "power_phase_type", vals: ["單相三線式", "三相三線式", "三相四線式"] },
      { type: "power_voltage", vals: ["220V", "220V / 380V", "380V", "440V", "480V"] },
      { type: "project_status", vals: ["開發中", "土地確認", "結構簽證", "台電送件", "台電審查", "能源署送件", "同意備案", "工程施工", "報竣掛表", "設備登記", "運維中", "暫停", "取消"] },
    ];

    for (const e of enumRaw) {
      const vals = e.vals.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
      push(`CREATE TYPE public.${e.type} AS ENUM (${vals});`);
    }
    push("");

    // 3. Tables - query columns from information_schema
    push("-- ===================== TABLES =====================");

    // Fetch all columns
    const { data: columns } = await supabase
      .from("information_schema.columns" as any)
      .select("table_name, column_name, ordinal_position, udt_name, is_nullable, column_default, data_type, character_maximum_length")
      .eq("table_schema", "public")
      .order("table_name")
      .order("ordinal_position");

    // Since we can't query information_schema via supabase client directly,
    // we'll use the approach of generating SQL from the data we already collected.
    // The edge function will return the pre-built SQL.

    // Actually, let me just output a comprehensive response with all schema info
    // Let me query via postgres directly using the DB URL

    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      return new Response(JSON.stringify({ error: "SUPABASE_DB_URL not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use Deno's postgres client
    const { Client } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
    const client = new Client(dbUrl);
    await client.connect();

    try {
      // ---- ENUMS ----
      const enumResult = await client.queryArray(`
        SELECT t.typname, string_agg(e.enumlabel, '|' ORDER BY e.enumsortorder)
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'public'
        GROUP BY t.typname ORDER BY t.typname
      `);

      const sqlParts: string[] = [];
      sqlParts.push("-- ============================================================");
      sqlParts.push("-- MQT Solar 完整資料庫結構匯出 (Schema-Only SQL Dump)");
      sqlParts.push(`-- 匯出時間: ${new Date().toISOString()}`);
      sqlParts.push("-- 可直接在新 Supabase 專案執行此 SQL 以重建完整結構");
      sqlParts.push("-- ============================================================");
      sqlParts.push("");
      sqlParts.push("-- ===================== ENUM / CUSTOM TYPES =====================");
      for (const row of enumResult.rows) {
        const typeName = row[0] as string;
        const labels = (row[1] as string).split("|");
        const vals = labels.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
        sqlParts.push(`DO $$ BEGIN CREATE TYPE public.${typeName} AS ENUM (${vals}); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
      }
      sqlParts.push("");

      // ---- TABLES ----
      sqlParts.push("-- ===================== TABLES =====================");
      const tablesResult = await client.queryArray(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);

      for (const tRow of tablesResult.rows) {
        const tableName = tRow[0] as string;
        const colsResult = await client.queryArray(`
          SELECT column_name, udt_name, is_nullable, column_default, data_type, character_maximum_length
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = '${tableName}'
          ORDER BY ordinal_position
        `);

        sqlParts.push(`CREATE TABLE IF NOT EXISTS public.${tableName} (`);
        const colDefs: string[] = [];
        for (const col of colsResult.rows) {
          const colName = col[0] as string;
          let udtName = col[1] as string;
          const isNullable = col[2] as string;
          const colDefault = col[3] as string | null;
          const dataType = col[4] as string;
          const charMaxLen = col[5] as number | null;

          // Map udt_name to SQL type
          let sqlType: string;
          if (dataType === "ARRAY") {
            sqlType = udtName.replace(/^_/, "") + "[]";
          } else if (dataType === "USER-DEFINED") {
            sqlType = `public.${udtName}`;
          } else if (udtName === "uuid") {
            sqlType = "uuid";
          } else if (udtName === "text") {
            sqlType = "text";
          } else if (udtName === "bool") {
            sqlType = "boolean";
          } else if (udtName === "int4") {
            sqlType = "integer";
          } else if (udtName === "int8") {
            sqlType = "bigint";
          } else if (udtName === "float8") {
            sqlType = "double precision";
          } else if (udtName === "numeric") {
            sqlType = "numeric";
          } else if (udtName === "timestamptz") {
            sqlType = "timestamp with time zone";
          } else if (udtName === "timestamp") {
            sqlType = "timestamp without time zone";
          } else if (udtName === "date") {
            sqlType = "date";
          } else if (udtName === "jsonb") {
            sqlType = "jsonb";
          } else if (udtName === "json") {
            sqlType = "json";
          } else if (udtName === "varchar") {
            sqlType = charMaxLen ? `character varying(${charMaxLen})` : "character varying";
          } else {
            sqlType = udtName;
          }

          let def = `  ${colName} ${sqlType}`;
          if (colDefault !== null) def += ` DEFAULT ${colDefault}`;
          if (isNullable === "NO") def += " NOT NULL";
          colDefs.push(def);
        }
        sqlParts.push(colDefs.join(",\n"));
        sqlParts.push(");");
        sqlParts.push("");
      }

      // ---- PRIMARY KEYS ----
      sqlParts.push("-- ===================== PRIMARY KEYS =====================");
      const pkResult = await client.queryArray(`
        SELECT tc.table_name, tc.constraint_name,
          string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position)
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
        GROUP BY tc.table_name, tc.constraint_name
        ORDER BY tc.table_name
      `);
      for (const row of pkResult.rows) {
        sqlParts.push(`ALTER TABLE public.${row[0]} ADD CONSTRAINT ${row[1]} PRIMARY KEY (${row[2]});`);
      }
      sqlParts.push("");

      // ---- UNIQUE CONSTRAINTS ----
      sqlParts.push("-- ===================== UNIQUE CONSTRAINTS =====================");
      const uqResult = await client.queryArray(`
        SELECT conrelid::regclass, conname, pg_get_constraintdef(oid)
        FROM pg_constraint
        WHERE connamespace = 'public'::regnamespace AND contype = 'u'
        ORDER BY conrelid::regclass::text, conname
      `);
      for (const row of uqResult.rows) {
        sqlParts.push(`ALTER TABLE ${row[0]} ADD CONSTRAINT ${row[1]} ${row[2]};`);
      }
      sqlParts.push("");

      // ---- CHECK CONSTRAINTS ----
      sqlParts.push("-- ===================== CHECK CONSTRAINTS =====================");
      const ckResult = await client.queryArray(`
        SELECT conrelid::regclass, conname, pg_get_constraintdef(oid)
        FROM pg_constraint
        WHERE connamespace = 'public'::regnamespace AND contype = 'c'
        ORDER BY conrelid::regclass::text, conname
      `);
      for (const row of ckResult.rows) {
        sqlParts.push(`ALTER TABLE ${row[0]} ADD CONSTRAINT ${row[1]} ${row[2]};`);
      }
      sqlParts.push("");

      // ---- FOREIGN KEYS ----
      sqlParts.push("-- ===================== FOREIGN KEYS =====================");
      const fkResult = await client.queryArray(`
        SELECT conrelid::regclass, conname, pg_get_constraintdef(oid)
        FROM pg_constraint
        WHERE connamespace = 'public'::regnamespace AND contype = 'f'
        ORDER BY conrelid::regclass::text, conname
      `);
      for (const row of fkResult.rows) {
        sqlParts.push(`ALTER TABLE ${row[0]} ADD CONSTRAINT ${row[1]} ${row[2]};`);
      }
      sqlParts.push("");

      // ---- INDEXES ----
      sqlParts.push("-- ===================== INDEXES (non-PK, non-unique constraint) =====================");
      const idxResult = await client.queryArray(`
        SELECT indexdef FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname NOT IN (
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_schema = 'public' AND constraint_type IN ('PRIMARY KEY', 'UNIQUE')
          )
        ORDER BY tablename, indexname
      `);
      for (const row of idxResult.rows) {
        sqlParts.push(`${row[0]};`);
      }
      sqlParts.push("");

      // ---- VIEWS ----
      sqlParts.push("-- ===================== VIEWS =====================");
      const viewResult = await client.queryArray(`
        SELECT viewname, definition FROM pg_views WHERE schemaname = 'public' ORDER BY viewname
      `);
      for (const row of viewResult.rows) {
        sqlParts.push(`CREATE OR REPLACE VIEW public.${row[0]} AS`);
        sqlParts.push(`${row[1]}`);
        sqlParts.push("");
      }

      // ---- FUNCTIONS ----
      sqlParts.push("-- ===================== FUNCTIONS (RPC) =====================");
      const funcResult = await client.queryArray(`
        SELECT pg_get_functiondef(p.oid)
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        ORDER BY p.proname
      `);
      for (const row of funcResult.rows) {
        sqlParts.push(`${row[0]};`);
        sqlParts.push("");
      }

      // ---- TRIGGERS ----
      sqlParts.push("-- ===================== TRIGGERS =====================");
      const trigResult = await client.queryArray(`
        SELECT pg_get_triggerdef(trg.oid)
        FROM pg_trigger trg
        JOIN pg_class tbl ON trg.tgrelid = tbl.oid
        JOIN pg_namespace ns ON tbl.relnamespace = ns.oid
        WHERE ns.nspname = 'public' AND NOT trg.tgisinternal
        ORDER BY tbl.relname, trg.tgname
      `);
      for (const row of trigResult.rows) {
        sqlParts.push(`${row[0]};`);
      }
      sqlParts.push("");

      // ---- RLS ----
      sqlParts.push("-- ===================== ROW LEVEL SECURITY =====================");
      // Enable RLS
      for (const tRow of tablesResult.rows) {
        sqlParts.push(`ALTER TABLE public.${tRow[0]} ENABLE ROW LEVEL SECURITY;`);
      }
      sqlParts.push("");

      // RLS Policies
      sqlParts.push("-- ===================== RLS POLICIES =====================");
      const polResult = await client.queryArray(`
        SELECT
          schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
        FROM pg_policies
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname
      `);
      for (const row of polResult.rows) {
        const schema = row[0];
        const table = row[1];
        const name = row[2];
        const permissive = row[3] === "PERMISSIVE" ? "PERMISSIVE" : "RESTRICTIVE";
        const roles = row[4];
        const cmd = row[5];
        const qual = row[6];
        const withCheck = row[7];

        let sql = `CREATE POLICY "${name}" ON ${schema}.${table}\n  AS ${permissive}\n  FOR ${cmd}\n  TO ${roles}`;
        if (qual) sql += `\n  USING (${qual})`;
        if (withCheck) sql += `\n  WITH CHECK (${withCheck})`;
        sql += ";";
        sqlParts.push(sql);
        sqlParts.push("");
      }

      // ---- STORAGE ----
      sqlParts.push("-- ===================== STORAGE BUCKETS =====================");
      const bucketResult = await client.queryArray(`
        SELECT name, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY name
      `);
      for (const row of bucketResult.rows) {
        const bName = row[0];
        const isPublic = row[1];
        sqlParts.push(`INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)`);
        sqlParts.push(`  VALUES ('${bName}', '${bName}', ${isPublic}, ${row[2] ?? "NULL"}, ${row[3] ? `'${JSON.stringify(row[3])}'` : "NULL"})`);
        sqlParts.push(`  ON CONFLICT (id) DO NOTHING;`);
      }
      sqlParts.push("");

      // Storage policies
      sqlParts.push("-- ===================== STORAGE POLICIES =====================");
      const storagPolResult = await client.queryArray(`
        SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
        FROM pg_policies WHERE schemaname = 'storage'
        ORDER BY tablename, policyname
      `);
      for (const row of storagPolResult.rows) {
        const table = row[0];
        const name = row[1];
        const permissive = row[2] === "PERMISSIVE" ? "PERMISSIVE" : "RESTRICTIVE";
        const roles = row[3];
        const cmd = row[4];
        const qual = row[5];
        const withCheck = row[6];

        let s = `CREATE POLICY "${name}" ON storage.${table}\n  AS ${permissive}\n  FOR ${cmd}\n  TO ${roles}`;
        if (qual) s += `\n  USING (${qual})`;
        if (withCheck) s += `\n  WITH CHECK (${withCheck})`;
        s += ";";
        sqlParts.push(s);
        sqlParts.push("");
      }

      // ---- Realtime publication ----
      sqlParts.push("-- ===================== REALTIME PUBLICATION =====================");
      const pubResult = await client.queryArray(`
        SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public' ORDER BY tablename
      `);
      for (const row of pubResult.rows) {
        sqlParts.push(`ALTER PUBLICATION supabase_realtime ADD TABLE public.${row[0]};`);
      }
      sqlParts.push("");

      // ---- Auth trigger (handle_new_user) ----
      sqlParts.push("-- ===================== AUTH TRIGGER =====================");
      sqlParts.push("-- NOTE: This trigger is on auth.users and must be created after profiles & user_roles tables exist");
      sqlParts.push("CREATE OR REPLACE TRIGGER on_auth_user_created");
      sqlParts.push("  AFTER INSERT ON auth.users");
      sqlParts.push("  FOR EACH ROW");
      sqlParts.push("  EXECUTE FUNCTION public.handle_new_user();");
      sqlParts.push("");

      // ---- TABLE SUMMARY ----
      sqlParts.push("-- ===================== TABLE SUMMARY (FOR AUDIT) =====================");
      const summaryResult = await client.queryArray(`
        SELECT t.table_name,
          (SELECT count(*) FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.table_name = t.table_name) as col_count
        FROM information_schema.tables t
        WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name
      `);
      sqlParts.push(`-- 共 ${summaryResult.rows.length} 張資料表`);
      for (const row of summaryResult.rows) {
        sqlParts.push(`-- ${row[0]}: ${row[1]} 欄位`);
      }

      await client.end();

      const fullSql = sqlParts.join("\n");

      return new Response(fullSql, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="mqtsolar-schema-dump-${new Date().toISOString().slice(0, 10)}.sql"`,
        },
      });
    } catch (err) {
      await client.end();
      throw err;
    }
  } catch (error: any) {
    console.error("Schema export error:", error);
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
