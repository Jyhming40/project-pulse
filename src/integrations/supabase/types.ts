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
          doc_status: Database["public"]["Enums"]["doc_status"]
          doc_type: Database["public"]["Enums"]["doc_type"]
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
          doc_status?: Database["public"]["Enums"]["doc_status"]
          doc_type: Database["public"]["Enums"]["doc_type"]
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
          doc_status?: Database["public"]["Enums"]["doc_status"]
          doc_type?: Database["public"]["Enums"]["doc_type"]
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
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
          note: string | null
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
          note?: string | null
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
          note?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
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
      project_status_history: {
        Row: {
          attachment_path: string | null
          changed_at: string
          changed_by: string | null
          id: string
          note: string | null
          project_id: string
          status: Database["public"]["Enums"]["project_status"]
        }
        Insert: {
          attachment_path?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          note?: string | null
          project_id: string
          status: Database["public"]["Enums"]["project_status"]
        }
        Update: {
          attachment_path?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          note?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["project_status"]
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
          address: string | null
          capacity_kwp: number | null
          city: string | null
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
          folder_status: Database["public"]["Enums"]["folder_status"] | null
          id: string
          investor_id: string | null
          land_owner: string | null
          land_owner_contact: string | null
          note: string | null
          project_code: string
          project_name: string
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          capacity_kwp?: number | null
          city?: string | null
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
          folder_status?: Database["public"]["Enums"]["folder_status"] | null
          id?: string
          investor_id?: string | null
          land_owner?: string | null
          land_owner_contact?: string | null
          note?: string | null
          project_code: string
          project_name: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          capacity_kwp?: number | null
          city?: string | null
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
          folder_status?: Database["public"]["Enums"]["folder_status"] | null
          id?: string
          investor_id?: string | null
          land_owner?: string | null
          land_owner_contact?: string | null
          note?: string | null
          project_code?: string
          project_name?: string
          status?: Database["public"]["Enums"]["project_status"]
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
