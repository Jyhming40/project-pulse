export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      construction_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          note: string | null
          project_id: string
          status: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          note?: string | null
          project_id: string
          status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          note?: string | null
          project_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "construction_status_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      document_files: {
        Row: {
          document_id: string
          file_size: number | null
          id: string
          mime_type: string | null
          original_name: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          document_id: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          original_name: string
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          document_id?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          original_name?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_files_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          created_by: string | null
          doc_status: string
          doc_type: string
          due_at: string | null
          id: string
          issued_at: string | null
          note: string | null
          owner_user_id: string | null
          project_id: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          doc_status?: string
          doc_type: string
          due_at?: string | null
          id?: string
          issued_at?: string | null
          note?: string | null
          owner_user_id?: string | null
          project_id: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          doc_status?: string
          doc_type?: string
          due_at?: string | null
          id?: string
          issued_at?: string | null
          note?: string | null
          owner_user_id?: string | null
          project_id?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_contacts: {
        Row: {
          contact_name: string
          created_at: string
          created_by: string | null
          department: string | null
          email: string | null
          id: string
          investor_id: string
          is_active: boolean | null
          is_primary: boolean | null
          line_id: string | null
          mobile: string | null
          note: string | null
          phone: string | null
          role_tags: string[] | null
          title: string | null
          updated_at: string
        }
        Insert: {
          contact_name: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          email?: string | null
          id?: string
          investor_id: string
          is_active?: boolean | null
          is_primary?: boolean | null
          line_id?: string | null
          mobile?: string | null
          note?: string | null
          phone?: string | null
          role_tags?: string[] | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          contact_name?: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          email?: string | null
          id?: string
          investor_id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          line_id?: string | null
          mobile?: string | null
          note?: string | null
          phone?: string | null
          role_tags?: string[] | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_contacts_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_payment_methods: {
        Row: {
          account_name: string | null
          account_number: string | null
          bank_code: string | null
          bank_name: string | null
          branch_name: string | null
          created_at: string
          created_by: string | null
          id: string
          investor_id: string
          is_default: boolean | null
          method_type: string
          note: string | null
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          bank_code?: string | null
          bank_name?: string | null
          branch_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          investor_id: string
          is_default?: boolean | null
          method_type: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          bank_code?: string | null
          bank_name?: string | null
          branch_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          investor_id?: string
          is_default?: boolean | null
          method_type?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_payment_methods_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_year_counters: {
        Row: {
          created_at: string
          id: string
          investor_code: string
          last_seq: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          investor_code: string
          last_seq?: number
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          investor_code?: string
          last_seq?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      investors: {
        Row: {
          address: string | null
          company_name: string
          contact_person: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          investor_code: string
          investor_type: string | null
          note: string | null
          owner_name: string | null
          owner_title: string | null
          phone: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_name: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          investor_code: string
          investor_type?: string | null
          note?: string | null
          owner_name?: string | null
          owner_title?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_name?: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          investor_code?: string
          investor_type?: string | null
          note?: string | null
          owner_name?: string | null
          owner_title?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      partner_contacts: {
        Row: {
          contact_name: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          note: string | null
          partner_id: string
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          contact_name: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          note?: string | null
          partner_id: string
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          contact_name?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          note?: string | null
          partner_id?: string
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_contacts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          address: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          note: string | null
          partner_type: string | null
          tax_id: string | null
          updated_at: string
          work_capabilities: string[] | null
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          note?: string | null
          partner_type?: string | null
          tax_id?: string | null
          updated_at?: string
          work_capabilities?: string[] | null
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          note?: string | null
          partner_type?: string | null
          tax_id?: string | null
          updated_at?: string
          work_capabilities?: string[] | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_construction_assignments: {
        Row: {
          actual_end_date: string | null
          actual_start_date: string | null
          assignment_status: string
          construction_work_type: string
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          partner_id: string | null
          planned_end_date: string | null
          planned_start_date: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          assignment_status?: string
          construction_work_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          partner_id?: string | null
          planned_end_date?: string | null
          planned_start_date?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          assignment_status?: string
          construction_work_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          partner_id?: string | null
          planned_end_date?: string | null
          planned_start_date?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_construction_assignments_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_construction_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_status_history: {
        Row: {
          attachment_path: string | null
          changed_at: string
          changed_by: string | null
          id: string
          note: string | null
          project_id: string
          status: string
        }
        Insert: {
          attachment_path?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          note?: string | null
          project_id: string
          status: string
        }
        Update: {
          attachment_path?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          note?: string | null
          project_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_status_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          actual_installed_capacity: number | null
          address: string | null
          approval_date: string | null
          capacity_kwp: number | null
          city: string | null
          construction_status: string | null
          contact_person: string | null
          contact_phone: string | null
          coordinates: string | null
          created_at: string
          created_by: string | null
          district: string | null
          drive_folder_id: string | null
          drive_folder_url: string | null
          feeder_code: string | null
          fiscal_year: number | null
          folder_error: string | null
          folder_status: string | null
          grid_connection_type: string | null
          id: string
          installation_type: string | null
          intake_year: number | null
          investor_id: string | null
          land_owner: string | null
          land_owner_contact: string | null
          note: string | null
          pole_status: string | null
          power_phase_type: string | null
          power_voltage: string | null
          project_code: string
          project_name: string
          seq: number | null
          site_code_display: string | null
          status: string
          taipower_pv_id: string | null
          updated_at: string
        }
        Insert: {
          actual_installed_capacity?: number | null
          address?: string | null
          approval_date?: string | null
          capacity_kwp?: number | null
          city?: string | null
          construction_status?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          coordinates?: string | null
          created_at?: string
          created_by?: string | null
          district?: string | null
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          feeder_code?: string | null
          fiscal_year?: number | null
          folder_error?: string | null
          folder_status?: string | null
          grid_connection_type?: string | null
          id?: string
          installation_type?: string | null
          intake_year?: number | null
          investor_id?: string | null
          land_owner?: string | null
          land_owner_contact?: string | null
          note?: string | null
          pole_status?: string | null
          power_phase_type?: string | null
          power_voltage?: string | null
          project_code: string
          project_name: string
          seq?: number | null
          site_code_display?: string | null
          status?: string
          taipower_pv_id?: string | null
          updated_at?: string
        }
        Update: {
          actual_installed_capacity?: number | null
          address?: string | null
          approval_date?: string | null
          capacity_kwp?: number | null
          city?: string | null
          construction_status?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          coordinates?: string | null
          created_at?: string
          created_by?: string | null
          district?: string | null
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          feeder_code?: string | null
          fiscal_year?: number | null
          folder_error?: string | null
          folder_status?: string | null
          grid_connection_type?: string | null
          id?: string
          installation_type?: string | null
          intake_year?: number | null
          investor_id?: string | null
          land_owner?: string | null
          land_owner_contact?: string | null
          note?: string | null
          pole_status?: string | null
          power_phase_type?: string | null
          power_voltage?: string | null
          project_code?: string
          project_name?: string
          seq?: number | null
          site_code_display?: string | null
          status?: string
          taipower_pv_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      system_options: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string
          value: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string
          value: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      user_drive_tokens: {
        Row: {
          access_token: string
          created_at: string
          google_email: string | null
          google_error: string | null
          id: string
          refresh_token: string
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          google_email?: string | null
          google_error?: string | null
          id?: string
          refresh_token: string
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          google_email?: string | null
          google_error?: string | null
          id?: string
          refresh_token?: string
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_site_code_display: {
        Args: {
          p_approval_date: string
          p_intake_year: number
          p_investor_code: string
          p_seq: number
        }
        Returns: string
      }
      get_next_project_seq: {
        Args: { p_investor_code: string; p_year: number }
        Returns: number
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "viewer"
      construction_status:
        | "已開工"
        | "尚未開工"
        | "已掛錶"
        | "待掛錶"
        | "暫緩"
        | "取消"
      contact_role_tag:
        | "主要聯絡人"
        | "財務"
        | "工程"
        | "法務"
        | "行政"
        | "業務"
        | "其他"
      doc_status: "未開始" | "進行中" | "已完成" | "退件補正"
      doc_type:
        | "台電審查意見書"
        | "能源局同意備案"
        | "結構簽證"
        | "躉售合約"
        | "報竣掛表"
        | "設備登記"
        | "土地契約"
        | "其他"
      folder_status: "pending" | "created" | "failed"
      grid_connection_type:
        | "高壓併低壓側"
        | "低壓"
        | "併內線－躉售"
        | "併內線－自發自用"
      installation_type:
        | "畜牧舍"
        | "農業設施"
        | "農棚"
        | "地面型"
        | "農舍"
        | "住宅"
        | "廠辦"
        | "特目用建物"
        | "特登工廠"
        | "集合住宅"
        | "其他設施"
        | "新建物（農業）"
        | "新建物（其他）"
      investor_type: "自有投資" | "租賃投資" | "SPC" | "個人" | "其他"
      payment_method_type: "銀行轉帳" | "支票" | "現金" | "信用卡" | "其他"
      pole_status:
        | "已立桿"
        | "未立桿"
        | "基礎完成"
        | "無須"
        | "需移桿"
        | "亭置式"
      power_phase_type: "單相三線式" | "三相三線式" | "三相四線式"
      power_voltage: "220V" | "220V / 380V" | "380V" | "440V" | "480V"
      project_status:
        | "開發中"
        | "土地確認"
        | "結構簽證"
        | "台電送件"
        | "台電審查"
        | "能源局送件"
        | "同意備案"
        | "工程施工"
        | "報竣掛表"
        | "設備登記"
        | "運維中"
        | "暫停"
        | "取消"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff", "viewer"],
      construction_status: [
        "已開工",
        "尚未開工",
        "已掛錶",
        "待掛錶",
        "暫緩",
        "取消",
      ],
      contact_role_tag: [
        "主要聯絡人",
        "財務",
        "工程",
        "法務",
        "行政",
        "業務",
        "其他",
      ],
      doc_status: ["未開始", "進行中", "已完成", "退件補正"],
      doc_type: [
        "台電審查意見書",
        "能源局同意備案",
        "結構簽證",
        "躉售合約",
        "報竣掛表",
        "設備登記",
        "土地契約",
        "其他",
      ],
      folder_status: ["pending", "created", "failed"],
      grid_connection_type: [
        "高壓併低壓側",
        "低壓",
        "併內線－躉售",
        "併內線－自發自用",
      ],
      installation_type: [
        "畜牧舍",
        "農業設施",
        "農棚",
        "地面型",
        "農舍",
        "住宅",
        "廠辦",
        "特目用建物",
        "特登工廠",
        "集合住宅",
        "其他設施",
        "新建物（農業）",
        "新建物（其他）",
      ],
      investor_type: ["自有投資", "租賃投資", "SPC", "個人", "其他"],
      payment_method_type: ["銀行轉帳", "支票", "現金", "信用卡", "其他"],
      pole_status: ["已立桿", "未立桿", "基礎完成", "無須", "需移桿", "亭置式"],
      power_phase_type: ["單相三線式", "三相三線式", "三相四線式"],
      power_voltage: ["220V", "220V / 380V", "380V", "440V", "480V"],
      project_status: [
        "開發中",
        "土地確認",
        "結構簽證",
        "台電送件",
        "台電審查",
        "能源局送件",
        "同意備案",
        "工程施工",
        "報竣掛表",
        "設備登記",
        "運維中",
        "暫停",
        "取消",
      ],
    },
  },
} as const
