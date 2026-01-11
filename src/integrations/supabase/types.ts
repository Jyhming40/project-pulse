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
      app_settings: {
        Row: {
          address: string | null
          company_name_en: string | null
          company_name_zh: string | null
          created_at: string
          email: string | null
          favicon_url: string | null
          id: string
          logo_dark_url: string | null
          logo_light_url: string | null
          phone: string | null
          primary_color: string | null
          system_name_en: string | null
          system_name_zh: string
          tax_id: string | null
          updated_at: string
          updated_by: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          company_name_en?: string | null
          company_name_zh?: string | null
          created_at?: string
          email?: string | null
          favicon_url?: string | null
          id?: string
          logo_dark_url?: string | null
          logo_light_url?: string | null
          phone?: string | null
          primary_color?: string | null
          system_name_en?: string | null
          system_name_zh?: string
          tax_id?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          company_name_en?: string | null
          company_name_zh?: string | null
          created_at?: string
          email?: string | null
          favicon_url?: string | null
          id?: string
          logo_dark_url?: string | null
          logo_light_url?: string | null
          phone?: string | null
          primary_color?: string | null
          system_name_en?: string | null
          system_name_zh?: string
          tax_id?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_user_id: string | null
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          reason: string | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_user_id?: string | null
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          reason?: string | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_user_id?: string | null
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          reason?: string | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
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
            referencedRelation: "project_analytics_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "construction_status_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      deletion_policies: {
        Row: {
          allow_auto_purge: boolean | null
          created_at: string | null
          created_by: string | null
          deletion_mode: Database["public"]["Enums"]["deletion_mode"]
          id: string
          require_confirmation: boolean | null
          require_reason: boolean | null
          retention_days: number | null
          table_name: string
          updated_at: string | null
        }
        Insert: {
          allow_auto_purge?: boolean | null
          created_at?: string | null
          created_by?: string | null
          deletion_mode?: Database["public"]["Enums"]["deletion_mode"]
          id?: string
          require_confirmation?: boolean | null
          require_reason?: boolean | null
          retention_days?: number | null
          table_name: string
          updated_at?: string | null
        }
        Update: {
          allow_auto_purge?: boolean | null
          created_at?: string | null
          created_by?: string | null
          deletion_mode?: Database["public"]["Enums"]["deletion_mode"]
          id?: string
          require_confirmation?: boolean | null
          require_reason?: boolean | null
          retention_days?: number | null
          table_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      document_files: {
        Row: {
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          document_id: string
          file_size: number | null
          id: string
          is_deleted: boolean | null
          mime_type: string | null
          original_name: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          document_id: string
          file_size?: number | null
          id?: string
          is_deleted?: boolean | null
          mime_type?: string | null
          original_name: string
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          document_id?: string
          file_size?: number | null
          id?: string
          is_deleted?: boolean | null
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
            referencedRelation: "document_analytics_view"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "document_files_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_tag_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          document_id: string
          id: string
          tag_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          document_id: string
          id?: string
          tag_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          document_id?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_tag_assignments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_analytics_view"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "document_tag_assignments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "document_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      document_tags: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      document_type_config: {
        Row: {
          agency_code: string
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          label: string
          sort_order: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          agency_code: string
          code: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          label: string
          sort_order?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          agency_code?: string
          code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          label?: string
          sort_order?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_type_config_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_type_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          agency_code: string | null
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          created_at: string
          created_by: string | null
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          doc_status: string
          doc_type: string
          doc_type_code: string | null
          drive_file_id: string | null
          drive_parent_folder_id: string | null
          drive_path: string | null
          drive_web_view_link: string | null
          due_at: string | null
          id: string
          is_archived: boolean | null
          is_current: boolean | null
          is_deleted: boolean | null
          issued_at: string | null
          note: string | null
          owner_user_id: string | null
          project_id: string
          submitted_at: string | null
          title: string | null
          updated_at: string
          version: number | null
        }
        Insert: {
          agency_code?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          doc_status?: string
          doc_type: string
          doc_type_code?: string | null
          drive_file_id?: string | null
          drive_parent_folder_id?: string | null
          drive_path?: string | null
          drive_web_view_link?: string | null
          due_at?: string | null
          id?: string
          is_archived?: boolean | null
          is_current?: boolean | null
          is_deleted?: boolean | null
          issued_at?: string | null
          note?: string | null
          owner_user_id?: string | null
          project_id: string
          submitted_at?: string | null
          title?: string | null
          updated_at?: string
          version?: number | null
        }
        Update: {
          agency_code?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          doc_status?: string
          doc_type?: string
          doc_type_code?: string | null
          drive_file_id?: string | null
          drive_parent_folder_id?: string | null
          drive_path?: string | null
          drive_web_view_link?: string | null
          due_at?: string | null
          id?: string
          is_archived?: boolean | null
          is_current?: boolean | null
          is_deleted?: boolean | null
          issued_at?: string | null
          note?: string | null
          owner_user_id?: string | null
          project_id?: string
          submitted_at?: string | null
          title?: string | null
          updated_at?: string
          version?: number | null
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
            referencedRelation: "project_analytics_view"
            referencedColumns: ["project_id"]
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
      duplicate_ignore_pairs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          project_id_a: string
          project_id_b: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          project_id_a: string
          project_id_b: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          project_id_a?: string
          project_id_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_ignore_pairs_project_id_a_fkey"
            columns: ["project_id_a"]
            isOneToOne: false
            referencedRelation: "project_analytics_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "duplicate_ignore_pairs_project_id_a_fkey"
            columns: ["project_id_a"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_ignore_pairs_project_id_b_fkey"
            columns: ["project_id_b"]
            isOneToOne: false
            referencedRelation: "project_analytics_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "duplicate_ignore_pairs_project_id_b_fkey"
            columns: ["project_id_b"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      duplicate_reviews: {
        Row: {
          created_at: string
          decision: string
          id: string
          project_id_a: string
          project_id_b: string
          reason: string | null
          reviewed_at: string
          reviewed_by: string | null
        }
        Insert: {
          created_at?: string
          decision: string
          id?: string
          project_id_a: string
          project_id_b: string
          reason?: string | null
          reviewed_at?: string
          reviewed_by?: string | null
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          project_id_a?: string
          project_id_b?: string
          reason?: string | null
          reviewed_at?: string
          reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_reviews_project_id_a_fkey"
            columns: ["project_id_a"]
            isOneToOne: false
            referencedRelation: "project_analytics_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "duplicate_reviews_project_id_a_fkey"
            columns: ["project_id_a"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_reviews_project_id_b_fkey"
            columns: ["project_id_b"]
            isOneToOne: false
            referencedRelation: "project_analytics_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "duplicate_reviews_project_id_b_fkey"
            columns: ["project_id_b"]
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
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          department: string | null
          email: string | null
          id: string
          investor_id: string
          is_active: boolean | null
          is_deleted: boolean | null
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
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          department?: string | null
          email?: string | null
          id?: string
          investor_id: string
          is_active?: boolean | null
          is_deleted?: boolean | null
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
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          department?: string | null
          email?: string | null
          id?: string
          investor_id?: string
          is_active?: boolean | null
          is_deleted?: boolean | null
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
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          investor_id: string
          is_default: boolean | null
          is_deleted: boolean | null
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
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          investor_id: string
          is_default?: boolean | null
          is_deleted?: boolean | null
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
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          investor_id?: string
          is_default?: boolean | null
          is_deleted?: boolean | null
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
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          company_name: string
          contact_person: string | null
          created_at: string
          created_by: string | null
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          id: string
          investor_code: string
          investor_type: string | null
          is_archived: boolean | null
          is_deleted: boolean | null
          note: string | null
          owner_name: string | null
          owner_title: string | null
          phone: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          company_name: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          investor_code: string
          investor_type?: string | null
          is_archived?: boolean | null
          is_deleted?: boolean | null
          note?: string | null
          owner_name?: string | null
          owner_title?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          company_name?: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          investor_code?: string
          investor_type?: string | null
          is_archived?: boolean | null
          is_deleted?: boolean | null
          note?: string | null
          owner_name?: string | null
          owner_title?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      milestone_notification_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          milestone_code: string
          project_id: string
          recipients: string[]
          sent_at: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          milestone_code: string
          project_id: string
          recipients?: string[]
          sent_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          milestone_code?: string
          project_id?: string
          recipients?: string[]
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestone_notification_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_analytics_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "milestone_notification_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      milestone_notification_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milestone_notification_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      module_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          created_at: string
          created_by: string | null
          id: string
          module_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          module_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          module_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_permissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_contacts: {
        Row: {
          contact_name: string
          created_at: string
          created_by: string | null
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          id: string
          is_active: boolean | null
          is_deleted: boolean | null
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
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_deleted?: boolean | null
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
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_deleted?: boolean | null
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
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          id: string
          is_active: boolean
          is_archived: boolean | null
          is_deleted: boolean | null
          name: string
          note: string | null
          partner_type: string | null
          tax_id: string | null
          updated_at: string
          work_capabilities: string[] | null
        }
        Insert: {
          address?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_archived?: boolean | null
          is_deleted?: boolean | null
          name: string
          note?: string | null
          partner_type?: string | null
          tax_id?: string | null
          updated_at?: string
          work_capabilities?: string[] | null
        }
        Update: {
          address?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_archived?: boolean | null
          is_deleted?: boolean | null
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
      progress_milestones: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_required: boolean
          milestone_code: string
          milestone_name: string
          milestone_type: Database["public"]["Enums"]["milestone_type"]
          notify_on_complete: boolean | null
          notify_recipients: string[] | null
          sort_order: number
          stage_label: string | null
          updated_at: string
          updated_by: string | null
          weight: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          milestone_code: string
          milestone_name: string
          milestone_type: Database["public"]["Enums"]["milestone_type"]
          notify_on_complete?: boolean | null
          notify_recipients?: string[] | null
          sort_order?: number
          stage_label?: string | null
          updated_at?: string
          updated_by?: string | null
          weight?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          milestone_code?: string
          milestone_name?: string
          milestone_type?: Database["public"]["Enums"]["milestone_type"]
          notify_on_complete?: boolean | null
          notify_recipients?: string[] | null
          sort_order?: number
          stage_label?: string | null
          updated_at?: string
          updated_by?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "progress_milestones_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_milestones_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "progress_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_construction_assignments: {
        Row: {
          actual_end_date: string | null
          actual_start_date: string | null
          assignment_status: string
          construction_work_type: string
          created_at: string
          created_by: string | null
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_deleted: boolean | null
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
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_deleted?: boolean | null
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
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_deleted?: boolean | null
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
            referencedRelation: "project_analytics_view"
            referencedColumns: ["project_id"]
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
      project_custom_field_values: {
        Row: {
          created_at: string
          field_id: string
          field_value: string | null
          id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_id: string
          field_value?: string | null
          id?: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_id?: string
          field_value?: string | null
          id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_custom_field_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "project_custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_custom_field_values_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_analytics_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_custom_field_values_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_custom_fields: {
        Row: {
          created_at: string
          created_by: string | null
          field_key: string
          field_label: string
          field_options: Json | null
          field_type: string
          id: string
          is_active: boolean
          is_required: boolean
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          field_key: string
          field_label: string
          field_options?: Json | null
          field_type?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          field_key?: string
          field_label?: string
          field_options?: Json | null
          field_type?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_custom_fields_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_custom_fields_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_field_config: {
        Row: {
          created_at: string
          field_key: string
          field_label: string
          id: string
          is_system: boolean
          is_visible: boolean
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          field_key: string
          field_label: string
          id?: string
          is_system?: boolean
          is_visible?: boolean
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          field_key?: string
          field_label?: string
          id?: string
          is_system?: boolean
          is_visible?: boolean
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_field_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_milestones: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          is_completed: boolean
          milestone_code: string
          note: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          milestone_code: string
          note?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          milestone_code?: string
          note?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_analytics_view"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_milestones_project_id_fkey"
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
            referencedRelation: "project_analytics_view"
            referencedColumns: ["project_id"]
          },
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
          actual_meter_date: string | null
          address: string | null
          admin_progress: number | null
          admin_stage: string | null
          approval_date: string | null
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          capacity_kwp: number | null
          city: string | null
          construction_status: string | null
          contact_person: string | null
          contact_phone: string | null
          coordinates: string | null
          created_at: string
          created_by: string | null
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          district: string | null
          drive_folder_id: string | null
          drive_folder_url: string | null
          engineering_progress: number | null
          engineering_stage: string | null
          feeder_code: string | null
          fiscal_year: number | null
          folder_error: string | null
          folder_status: string | null
          grid_connection_type: string | null
          id: string
          installation_type: string | null
          intake_year: number | null
          investor_drive_folder_id: string | null
          investor_id: string | null
          is_archived: boolean | null
          is_deleted: boolean | null
          land_owner: string | null
          land_owner_contact: string | null
          note: string | null
          overall_progress: number | null
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
          actual_meter_date?: string | null
          address?: string | null
          admin_progress?: number | null
          admin_stage?: string | null
          approval_date?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          capacity_kwp?: number | null
          city?: string | null
          construction_status?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          coordinates?: string | null
          created_at?: string
          created_by?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          district?: string | null
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          engineering_progress?: number | null
          engineering_stage?: string | null
          feeder_code?: string | null
          fiscal_year?: number | null
          folder_error?: string | null
          folder_status?: string | null
          grid_connection_type?: string | null
          id?: string
          installation_type?: string | null
          intake_year?: number | null
          investor_drive_folder_id?: string | null
          investor_id?: string | null
          is_archived?: boolean | null
          is_deleted?: boolean | null
          land_owner?: string | null
          land_owner_contact?: string | null
          note?: string | null
          overall_progress?: number | null
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
          actual_meter_date?: string | null
          address?: string | null
          admin_progress?: number | null
          admin_stage?: string | null
          approval_date?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          capacity_kwp?: number | null
          city?: string | null
          construction_status?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          coordinates?: string | null
          created_at?: string
          created_by?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          district?: string | null
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          engineering_progress?: number | null
          engineering_stage?: string | null
          feeder_code?: string | null
          fiscal_year?: number | null
          folder_error?: string | null
          folder_status?: string | null
          grid_connection_type?: string | null
          id?: string
          installation_type?: string | null
          intake_year?: number | null
          investor_drive_folder_id?: string | null
          investor_id?: string | null
          is_archived?: boolean | null
          is_deleted?: boolean | null
          land_owner?: string | null
          land_owner_contact?: string | null
          note?: string | null
          overall_progress?: number | null
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
      user_preferences: {
        Row: {
          created_at: string
          id: string
          theme_color: string
          theme_mode: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          theme_color?: string
          theme_mode?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          theme_color?: string
          theme_mode?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          reject_reason: string | null
          rejected_at: string | null
          rejected_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["user_status"]
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          reject_reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["user_status"]
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          reject_reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["user_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_security: {
        Row: {
          created_at: string | null
          id: string
          must_change_password: boolean | null
          password_changed_at: string | null
          password_expires_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          must_change_password?: boolean | null
          password_changed_at?: string | null
          password_expires_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          must_change_password?: boolean | null
          password_changed_at?: string | null
          password_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      document_analytics_view: {
        Row: {
          approved_at: string | null
          created_by: string | null
          document_id: string | null
          document_status: string | null
          document_type: string | null
          due_at: string | null
          is_archived: boolean | null
          is_overdue: boolean | null
          is_pending: boolean | null
          owner_user_id: string | null
          project_code: string | null
          project_id: string | null
          project_name: string | null
          submitted_at: string | null
          uploaded_at: string | null
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
            referencedRelation: "project_analytics_view"
            referencedColumns: ["project_id"]
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
      project_analytics_view: {
        Row: {
          admin_progress_percent: number | null
          admin_stage: string | null
          approval_date: string | null
          capacity_kwp: number | null
          city: string | null
          completed_documents: number | null
          construction_status: string | null
          created_at: string | null
          current_project_status: string | null
          district: string | null
          engineering_progress_percent: number | null
          engineering_stage: string | null
          fiscal_year: number | null
          grid_connection_type: string | null
          has_risk: boolean | null
          installation_type: string | null
          intake_year: number | null
          investor_code: string | null
          investor_id: string | null
          investor_name: string | null
          last_status_changed_at: string | null
          overall_progress_percent: number | null
          project_code: string | null
          project_id: string | null
          project_name: string | null
          risk_reasons: string[] | null
          total_documents: number | null
          updated_at: string | null
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
      get_deletion_policy: {
        Args: { p_table_name: string }
        Returns: {
          allow_auto_purge: boolean | null
          created_at: string | null
          created_by: string | null
          deletion_mode: Database["public"]["Enums"]["deletion_mode"]
          id: string
          require_confirmation: boolean | null
          require_reason: boolean | null
          retention_days: number | null
          table_name: string
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "deletion_policies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_next_project_seq: {
        Args: { p_investor_code: string; p_year: number }
        Returns: number
      }
      get_project_risk_assessment: {
        Args: { p_project_id: string }
        Returns: {
          has_risk: boolean
          risk_level: string
          risk_reasons: string[]
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_active_status: { Args: { _user_id: string }; Returns: boolean }
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
      log_audit_action: {
        Args: {
          p_action: Database["public"]["Enums"]["audit_action"]
          p_new_data?: Json
          p_old_data?: Json
          p_reason?: string
          p_record_id: string
          p_table_name: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "viewer"
      audit_action:
        | "DELETE"
        | "RESTORE"
        | "PURGE"
        | "ARCHIVE"
        | "UNARCHIVE"
        | "CREATE"
        | "UPDATE"
        | "DB_RESET"
        | "DB_EXPORT"
        | "DB_IMPORT"
        | "BRANDING_UPDATE"
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
      deletion_mode: "soft_delete" | "archive" | "hard_delete" | "disable_only"
      doc_status: "未開始" | "進行中" | "已完成" | "退件補正"
      doc_type:
        | "台電審查意見書"
        | "能源署同意備案"
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
      milestone_type: "admin" | "engineering"
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
        | "能源署送件"
        | "同意備案"
        | "工程施工"
        | "報竣掛表"
        | "設備登記"
        | "運維中"
        | "暫停"
        | "取消"
      user_status: "pending" | "active" | "rejected" | "disabled"
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
      audit_action: [
        "DELETE",
        "RESTORE",
        "PURGE",
        "ARCHIVE",
        "UNARCHIVE",
        "CREATE",
        "UPDATE",
        "DB_RESET",
        "DB_EXPORT",
        "DB_IMPORT",
        "BRANDING_UPDATE",
      ],
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
      deletion_mode: ["soft_delete", "archive", "hard_delete", "disable_only"],
      doc_status: ["未開始", "進行中", "已完成", "退件補正"],
      doc_type: [
        "台電審查意見書",
        "能源署同意備案",
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
      milestone_type: ["admin", "engineering"],
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
        "能源署送件",
        "同意備案",
        "工程施工",
        "報竣掛表",
        "設備登記",
        "運維中",
        "暫停",
        "取消",
      ],
      user_status: ["pending", "active", "rejected", "disabled"],
    },
  },
} as const
