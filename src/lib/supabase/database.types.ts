export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  resident: {
    Tables: {
      association_details: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          created_at: string
          district: string | null
          email: string | null
          enabled_modules: Json
          id: string
          phone: string | null
          postal_code: string | null
          registration_number: string | null
          settings: Json
          state: string | null
          tenant_id: string
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          created_at?: string
          district?: string | null
          email?: string | null
          enabled_modules?: Json
          id?: string
          phone?: string | null
          postal_code?: string | null
          registration_number?: string | null
          settings?: Json
          state?: string | null
          tenant_id: string
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          created_at?: string
          district?: string | null
          email?: string | null
          enabled_modules?: Json
          id?: string
          phone?: string | null
          postal_code?: string | null
          registration_number?: string | null
          settings?: Json
          state?: string | null
          tenant_id?: string
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "association_details_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      association_settings_private: {
        Row: {
          created_at: string
          id: string
          settings: Json
          tenant_id: string
          updated_at: string
          updated_by_profile_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          settings?: Json
          tenant_id: string
          updated_at?: string
          updated_by_profile_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          settings?: Json
          tenant_id?: string
          updated_at?: string
          updated_by_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "association_settings_private_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "association_settings_private_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_profile_id: string | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          request_id: string
          source: string
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          request_id: string
          source: string
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          request_id?: string
          source?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_accounts: {
        Row: {
          created_at: string
          deleted_at: string | null
          external_reference: string | null
          id: string
          metadata: Json
          property_id: string
          status: Database["resident"]["Enums"]["billing_account_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          external_reference?: string | null
          id?: string
          metadata?: Json
          property_id: string
          status?: Database["resident"]["Enums"]["billing_account_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          external_reference?: string | null
          id?: string
          metadata?: Json
          property_id?: string
          status?: Database["resident"]["Enums"]["billing_account_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_accounts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_cycles: {
        Row: {
          billing_account_id: string
          created_at: string
          cycle_end: string
          cycle_start: string
          due_date: string
          id: string
          metadata: Json
          reference_period: string
          status: Database["resident"]["Enums"]["billing_cycle_status"]
          tenant_id: string
          updated_at: string
          updated_by_profile_id: string | null
        }
        Insert: {
          billing_account_id: string
          created_at?: string
          cycle_end: string
          cycle_start: string
          due_date: string
          id?: string
          metadata?: Json
          reference_period: string
          status?: Database["resident"]["Enums"]["billing_cycle_status"]
          tenant_id: string
          updated_at?: string
          updated_by_profile_id?: string | null
        }
        Update: {
          billing_account_id?: string
          created_at?: string
          cycle_end?: string
          cycle_start?: string
          due_date?: string
          id?: string
          metadata?: Json
          reference_period?: string
          status?: Database["resident"]["Enums"]["billing_cycle_status"]
          tenant_id?: string
          updated_at?: string
          updated_by_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_cycles_billing_account_id_fkey"
            columns: ["billing_account_id"]
            isOneToOne: false
            referencedRelation: "billing_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_cycles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_cycles_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_adjustments: {
        Row: {
          amount: number
          applied_by_profile_id: string | null
          category: Database["resident"]["Enums"]["adjustment_category"]
          created_at: string
          description: string
          id: string
          invoice_id: string
          metadata: Json
          percentage: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          applied_by_profile_id?: string | null
          category: Database["resident"]["Enums"]["adjustment_category"]
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          metadata?: Json
          percentage?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          applied_by_profile_id?: string | null
          category?: Database["resident"]["Enums"]["adjustment_category"]
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          metadata?: Json
          percentage?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_adjustments_applied_by_profile_id_fkey"
            columns: ["applied_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_adjustments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_adjustments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_audit_log: {
        Row: {
          action: Database["resident"]["Enums"]["financial_event_type"]
          actor_profile_id: string | null
          changes: Json
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          tenant_id: string
        }
        Insert: {
          action: Database["resident"]["Enums"]["financial_event_type"]
          actor_profile_id?: string | null
          changes?: Json
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json
          tenant_id: string
        }
        Update: {
          action?: Database["resident"]["Enums"]["financial_event_type"]
          actor_profile_id?: string | null
          changes?: Json
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_audit_log_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          birth_date: string | null
          created_at: string
          end_date: string | null
          full_name: string
          id: string
          linked_profile_id: string | null
          notes: string | null
          property_id: string
          relationship: Database["resident"]["Enums"]["household_relationship"]
          responsible_profile_id: string
          start_date: string | null
          status: Database["resident"]["Enums"]["household_member_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          end_date?: string | null
          full_name: string
          id?: string
          linked_profile_id?: string | null
          notes?: string | null
          property_id: string
          relationship: Database["resident"]["Enums"]["household_relationship"]
          responsible_profile_id: string
          start_date?: string | null
          status?: Database["resident"]["Enums"]["household_member_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          end_date?: string | null
          full_name?: string
          id?: string
          linked_profile_id?: string | null
          notes?: string | null
          property_id?: string
          relationship?: Database["resident"]["Enums"]["household_relationship"]
          responsible_profile_id?: string
          start_date?: string | null
          status?: Database["resident"]["Enums"]["household_member_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_linked_profile_id_fkey"
            columns: ["linked_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_property_composite_fk"
            columns: ["property_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "household_members_responsible_profile_id_fkey"
            columns: ["responsible_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          amount: number
          category: Database["resident"]["Enums"]["invoice_item_category"]
          created_at: string
          deleted_at: string | null
          description: string
          id: string
          invoice_id: string
          metadata: Json
          quantity: number
          sort_order: number
          tenant_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: Database["resident"]["Enums"]["invoice_item_category"]
          created_at?: string
          deleted_at?: string | null
          description: string
          id?: string
          invoice_id: string
          metadata?: Json
          quantity?: number
          sort_order?: number
          tenant_id: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: Database["resident"]["Enums"]["invoice_item_category"]
          created_at?: string
          deleted_at?: string | null
          description?: string
          id?: string
          invoice_id?: string
          metadata?: Json
          quantity?: number
          sort_order?: number
          tenant_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          bank_reference: string | null
          billing_account_id: string
          billing_cycle_id: string | null
          cancelled_at: string | null
          convenio: string | null
          created_at: string
          deleted_at: string | null
          document_number: string
          due_date: string
          id: string
          issued_at: string | null
          last_reminder_sent_at: string | null
          metadata: Json
          nosso_numero: string | null
          paid_at: string | null
          reminder_count: number
          remittance_number: string | null
          renegotiation_reference: string | null
          replaced_by_invoice_id: string | null
          return_number: string | null
          status: Database["resident"]["Enums"]["invoice_status"]
          tenant_id: string
          updated_at: string
          updated_by_profile_id: string | null
          wallet_code: string | null
          written_off_reason: string | null
        }
        Insert: {
          amount?: number
          bank_reference?: string | null
          billing_account_id: string
          billing_cycle_id?: string | null
          cancelled_at?: string | null
          convenio?: string | null
          created_at?: string
          deleted_at?: string | null
          document_number: string
          due_date: string
          id?: string
          issued_at?: string | null
          last_reminder_sent_at?: string | null
          metadata?: Json
          nosso_numero?: string | null
          paid_at?: string | null
          reminder_count?: number
          remittance_number?: string | null
          renegotiation_reference?: string | null
          replaced_by_invoice_id?: string | null
          return_number?: string | null
          status?: Database["resident"]["Enums"]["invoice_status"]
          tenant_id: string
          updated_at?: string
          updated_by_profile_id?: string | null
          wallet_code?: string | null
          written_off_reason?: string | null
        }
        Update: {
          amount?: number
          bank_reference?: string | null
          billing_account_id?: string
          billing_cycle_id?: string | null
          cancelled_at?: string | null
          convenio?: string | null
          created_at?: string
          deleted_at?: string | null
          document_number?: string
          due_date?: string
          id?: string
          issued_at?: string | null
          last_reminder_sent_at?: string | null
          metadata?: Json
          nosso_numero?: string | null
          paid_at?: string | null
          reminder_count?: number
          remittance_number?: string | null
          renegotiation_reference?: string | null
          replaced_by_invoice_id?: string | null
          return_number?: string | null
          status?: Database["resident"]["Enums"]["invoice_status"]
          tenant_id?: string
          updated_at?: string
          updated_by_profile_id?: string | null
          wallet_code?: string | null
          written_off_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_billing_account_id_fkey"
            columns: ["billing_account_id"]
            isOneToOne: false
            referencedRelation: "billing_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_billing_cycle_id_fkey"
            columns: ["billing_cycle_id"]
            isOneToOne: false
            referencedRelation: "billing_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_replaced_by_invoice_id_fkey"
            columns: ["replaced_by_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          balance: number
          created_at: string
          credit_amount: number
          debit_amount: number
          description: string
          entity_id: string | null
          entity_type: string | null
          entry_date: string
          id: string
          metadata: Json
          reference_document: string | null
          tenant_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          credit_amount?: number
          debit_amount?: number
          description: string
          entity_id?: string | null
          entity_type?: string | null
          entry_date?: string
          id?: string
          metadata?: Json
          reference_document?: string | null
          tenant_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          credit_amount?: number
          debit_amount?: number
          description?: string
          entity_id?: string | null
          entity_type?: string | null
          entry_date?: string
          id?: string
          metadata?: Json
          reference_document?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_intents: {
        Row: {
          amount: number
          attempt_count: number
          created_at: string
          expires_at: string | null
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          invoice_id: string
          last_attempt_at: string | null
          metadata: Json
          provider: string
          provider_boleto_barcode: string | null
          provider_boleto_digitable_line: string | null
          provider_boleto_url: string | null
          provider_checkout_url: string | null
          provider_payment_intent_id: string | null
          provider_pix_code: string | null
          provider_pix_qr_base64: string | null
          status: Database["resident"]["Enums"]["payment_status"]
          tenant_id: string
          updated_at: string
          updated_by_profile_id: string | null
        }
        Insert: {
          amount: number
          attempt_count?: number
          created_at?: string
          expires_at?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          invoice_id: string
          last_attempt_at?: string | null
          metadata?: Json
          provider: string
          provider_boleto_barcode?: string | null
          provider_boleto_digitable_line?: string | null
          provider_boleto_url?: string | null
          provider_checkout_url?: string | null
          provider_payment_intent_id?: string | null
          provider_pix_code?: string | null
          provider_pix_qr_base64?: string | null
          status?: Database["resident"]["Enums"]["payment_status"]
          tenant_id: string
          updated_at?: string
          updated_by_profile_id?: string | null
        }
        Update: {
          amount?: number
          attempt_count?: number
          created_at?: string
          expires_at?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          invoice_id?: string
          last_attempt_at?: string | null
          metadata?: Json
          provider?: string
          provider_boleto_barcode?: string | null
          provider_boleto_digitable_line?: string | null
          provider_boleto_url?: string | null
          provider_checkout_url?: string | null
          provider_payment_intent_id?: string | null
          provider_pix_code?: string | null
          provider_pix_qr_base64?: string | null
          status?: Database["resident"]["Enums"]["payment_status"]
          tenant_id?: string
          updated_at?: string
          updated_by_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          billing_account_id: string
          created_at: string
          deleted_at: string | null
          display_name: string
          id: string
          is_active: boolean
          is_default: boolean
          metadata: Json
          method_type: Database["resident"]["Enums"]["payment_method_type"]
          provider: string
          provider_payment_method_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          billing_account_id: string
          created_at?: string
          deleted_at?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          metadata?: Json
          method_type?: Database["resident"]["Enums"]["payment_method_type"]
          provider: string
          provider_payment_method_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          billing_account_id?: string
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          metadata?: Json
          method_type?: Database["resident"]["Enums"]["payment_method_type"]
          provider?: string
          provider_payment_method_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_billing_account_id_fkey"
            columns: ["billing_account_id"]
            isOneToOne: false
            referencedRelation: "billing_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_provider_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          metadata: Json
          payload: Json
          processed_at: string | null
          provider: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          metadata?: Json
          payload?: Json
          processed_at?: string | null
          provider: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          metadata?: Json
          payload?: Json
          processed_at?: string | null
          provider?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_provider_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_receipts: {
        Row: {
          amount_paid: number
          created_at: string
          id: string
          invoice_id: string
          issued_at: string
          metadata: Json
          payment_transaction_id: string
          pdf_url: string | null
          receipt_number: string
          tenant_id: string
        }
        Insert: {
          amount_paid: number
          created_at?: string
          id?: string
          invoice_id: string
          issued_at?: string
          metadata?: Json
          payment_transaction_id: string
          pdf_url?: string | null
          receipt_number: string
          tenant_id: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          id?: string
          invoice_id?: string
          issued_at?: string
          metadata?: Json
          payment_transaction_id?: string
          pdf_url?: string | null
          receipt_number?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_receipts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_receipts_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_receipts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          metadata: Json
          paid_at: string | null
          payment_intent_id: string | null
          payment_method_type: Database["resident"]["Enums"]["payment_method_type"]
          provider: string
          provider_transaction_id: string | null
          status: Database["resident"]["Enums"]["payment_status"]
          tenant_id: string
          updated_at: string
          updated_by_profile_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          metadata?: Json
          paid_at?: string | null
          payment_intent_id?: string | null
          payment_method_type?: Database["resident"]["Enums"]["payment_method_type"]
          provider: string
          provider_transaction_id?: string | null
          status?: Database["resident"]["Enums"]["payment_status"]
          tenant_id: string
          updated_at?: string
          updated_by_profile_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          metadata?: Json
          paid_at?: string | null
          payment_intent_id?: string | null
          payment_method_type?: Database["resident"]["Enums"]["payment_method_type"]
          provider?: string
          provider_transaction_id?: string | null
          status?: Database["resident"]["Enums"]["payment_status"]
          tenant_id?: string
          updated_at?: string
          updated_by_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_role_assignments: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          revoked_at: string | null
          role: Database["resident"]["Enums"]["platform_role"]
          status: Database["resident"]["Enums"]["platform_assignment_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          revoked_at?: string | null
          role: Database["resident"]["Enums"]["platform_role"]
          status?: Database["resident"]["Enums"]["platform_assignment_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          revoked_at?: string | null
          role?: Database["resident"]["Enums"]["platform_role"]
          status?: Database["resident"]["Enums"]["platform_assignment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_role_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_contacts: {
        Row: {
          contact_type: Database["resident"]["Enums"]["contact_type"]
          created_at: string
          deleted_at: string | null
          display_value: string
          id: string
          invalidated_at: string | null
          is_primary: boolean
          is_whatsapp_capable: boolean
          normalized_value: string
          outdated_at: string | null
          profile_id: string
          updated_at: string
          verification_sent_at: string | null
          verification_state: Database["resident"]["Enums"]["verification_state"]
          verified_at: string | null
        }
        Insert: {
          contact_type: Database["resident"]["Enums"]["contact_type"]
          created_at?: string
          deleted_at?: string | null
          display_value: string
          id?: string
          invalidated_at?: string | null
          is_primary?: boolean
          is_whatsapp_capable?: boolean
          normalized_value: string
          outdated_at?: string | null
          profile_id: string
          updated_at?: string
          verification_sent_at?: string | null
          verification_state?: Database["resident"]["Enums"]["verification_state"]
          verified_at?: string | null
        }
        Update: {
          contact_type?: Database["resident"]["Enums"]["contact_type"]
          created_at?: string
          deleted_at?: string | null
          display_value?: string
          id?: string
          invalidated_at?: string | null
          is_primary?: boolean
          is_whatsapp_capable?: boolean
          normalized_value?: string
          outdated_at?: string | null
          profile_id?: string
          updated_at?: string
          verification_sent_at?: string | null
          verification_state?: Database["resident"]["Enums"]["verification_state"]
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_contacts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_devices: {
        Row: {
          app_version: string | null
          created_at: string
          device_name: string
          device_platform: string
          id: string
          last_seen_at: string
          profile_id: string
          revoked_at: string | null
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          device_name: string
          device_platform: string
          id?: string
          last_seen_at?: string
          profile_id: string
          revoked_at?: string | null
        }
        Update: {
          app_version?: string | null
          created_at?: string
          device_name?: string
          device_platform?: string
          id?: string
          last_seen_at?: string
          profile_id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_devices_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_preferences: {
        Row: {
          accessibility: Json
          app_preferences: Json
          locale: string
          profile_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          accessibility?: Json
          app_preferences?: Json
          locale?: string
          profile_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          accessibility?: Json
          app_preferences?: Json
          locale?: string
          profile_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          locale: string
          preferred_name: string | null
          status: Database["resident"]["Enums"]["profile_status"]
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id?: string
          locale?: string
          preferred_name?: string | null
          status?: Database["resident"]["Enums"]["profile_status"]
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          locale?: string
          preferred_name?: string | null
          status?: Database["resident"]["Enums"]["profile_status"]
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address_line1: string
          address_line2: string | null
          block_identifier: string | null
          city: string
          country: string
          created_at: string
          district: string | null
          id: string
          label: string
          metadata: Json
          nickname: string | null
          postal_code: string | null
          state: string
          status: Database["resident"]["Enums"]["property_status"]
          tenant_id: string
          unit_identifier: string
          updated_at: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          block_identifier?: string | null
          city: string
          country?: string
          created_at?: string
          district?: string | null
          id?: string
          label: string
          metadata?: Json
          nickname?: string | null
          postal_code?: string | null
          state: string
          status?: Database["resident"]["Enums"]["property_status"]
          tenant_id: string
          unit_identifier: string
          updated_at?: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          block_identifier?: string | null
          city?: string
          country?: string
          created_at?: string
          district?: string | null
          id?: string
          label?: string
          metadata?: Json
          nickname?: string | null
          postal_code?: string | null
          state?: string
          status?: Database["resident"]["Enums"]["property_status"]
          tenant_id?: string
          unit_identifier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      residence_members: {
        Row: {
          created_at: string
          end_date: string | null
          end_reason:
            | Database["resident"]["Enums"]["residence_membership_end_reason"]
            | null
          id: string
          is_primary: boolean
          moveout_requested_at: string | null
          profile_id: string
          property_id: string
          requested_end_date: string | null
          revoked_at: string | null
          role: Database["resident"]["Enums"]["residence_role"]
          start_date: string | null
          status: Database["resident"]["Enums"]["residence_membership_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          end_reason?:
            | Database["resident"]["Enums"]["residence_membership_end_reason"]
            | null
          id?: string
          is_primary?: boolean
          moveout_requested_at?: string | null
          profile_id: string
          property_id: string
          requested_end_date?: string | null
          revoked_at?: string | null
          role: Database["resident"]["Enums"]["residence_role"]
          start_date?: string | null
          status?: Database["resident"]["Enums"]["residence_membership_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          end_reason?:
            | Database["resident"]["Enums"]["residence_membership_end_reason"]
            | null
          id?: string
          is_primary?: boolean
          moveout_requested_at?: string | null
          profile_id?: string
          property_id?: string
          requested_end_date?: string | null
          revoked_at?: string | null
          role?: Database["resident"]["Enums"]["residence_role"]
          start_date?: string | null
          status?: Database["resident"]["Enums"]["residence_membership_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "residence_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residence_members_property_composite_fk"
            columns: ["property_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "residence_members_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residence_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      resident_staff_notes: {
        Row: {
          author_profile_id: string
          created_at: string
          id: string
          note: string
          note_kind: string
          resident_id: string
          tenant_id: string
        }
        Insert: {
          author_profile_id: string
          created_at?: string
          id?: string
          note: string
          note_kind?: string
          resident_id: string
          tenant_id: string
        }
        Update: {
          author_profile_id?: string
          created_at?: string
          id?: string
          note?: string
          note_kind?: string
          resident_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resident_staff_notes_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resident_staff_notes_resident_fk"
            columns: ["resident_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "resident_staff_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      residents: {
        Row: {
          approved_at: string | null
          approved_by_profile_id: string | null
          created_at: string
          id: string
          joined_at: string | null
          left_at: string | null
          profile_id: string
          registration_code: string | null
          status: Database["resident"]["Enums"]["resident_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by_profile_id?: string | null
          created_at?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          profile_id: string
          registration_code?: string | null
          status?: Database["resident"]["Enums"]["resident_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by_profile_id?: string | null
          created_at?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          profile_id?: string
          registration_code?: string | null
          status?: Database["resident"]["Enums"]["resident_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "residents_approved_by_profile_id_fkey"
            columns: ["approved_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          created_at: string
          id: string
          joined_at: string
          profile_id: string
          revoked_at: string | null
          role: Database["resident"]["Enums"]["tenant_role"]
          status: Database["resident"]["Enums"]["tenant_membership_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string
          profile_id: string
          revoked_at?: string | null
          role: Database["resident"]["Enums"]["tenant_role"]
          status?: Database["resident"]["Enums"]["tenant_membership_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string
          profile_id?: string
          revoked_at?: string | null
          role?: Database["resident"]["Enums"]["tenant_role"]
          status?: Database["resident"]["Enums"]["tenant_membership_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          display_name: string
          id: string
          legal_name: string
          locale: string
          metadata: Json
          slug: string
          status: Database["resident"]["Enums"]["tenant_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          legal_name: string
          locale?: string
          metadata?: Json
          slug: string
          status?: Database["resident"]["Enums"]["tenant_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          legal_name?: string
          locale?: string
          metadata?: Json
          slug?: string
          status?: Database["resident"]["Enums"]["tenant_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_residence: {
        Args: { target_property_id: string }
        Returns: boolean
      }
      can_manage_profile: {
        Args: { target_profile_id: string; target_tenant_id?: string }
        Returns: boolean
      }
      check_association_details_enabled_modules: {
        Args: { m: Json }
        Returns: boolean
      }
      check_association_details_settings: {
        Args: { s: Json }
        Returns: boolean
      }
      current_profile_id: { Args: never; Returns: string }
      current_tenant_context: { Args: never; Returns: Json }
      has_platform_role: {
        Args: { target_role: Database["resident"]["Enums"]["platform_role"] }
        Returns: boolean
      }
      has_tenant_permission: {
        Args: {
          target_permission: Database["resident"]["Enums"]["tenant_permission"]
          target_tenant_id: string
        }
        Returns: boolean
      }
      has_tenant_role: {
        Args: {
          target_role: Database["resident"]["Enums"]["tenant_role"]
          target_tenant_id: string
        }
        Returns: boolean
      }
      is_active_residence_member: {
        Args: { target_property_id: string }
        Returns: boolean
      }
      is_active_resident: {
        Args: { target_tenant_id: string }
        Returns: boolean
      }
      is_active_tenant_member: {
        Args: { target_tenant_id: string }
        Returns: boolean
      }
      is_billing_account_owner: {
        Args: { target_billing_account_id: string }
        Returns: boolean
      }
      is_household_responsible: {
        Args: { target_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: never; Returns: boolean }
      log_audit_event: {
        Args: {
          target_action: string
          target_entity_id: string
          target_entity_type: string
          target_metadata?: Json
          target_request_id: string
          target_source: string
          target_tenant_id: string
        }
        Returns: string
      }
      log_financial_audit: {
        Args: {
          p_action: Database["resident"]["Enums"]["financial_event_type"]
          p_changes?: Json
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
          p_tenant_id: string
        }
        Returns: string
      }
    }
    Enums: {
      adjustment_category:
        | "discount"
        | "interest"
        | "fine"
        | "credit"
        | "debit"
        | "correction"
        | "other"
      billing_account_status: "active" | "inactive" | "suspended" | "closed"
      billing_cycle_status: "draft" | "open" | "closed" | "cancelled"
      contact_type: "email" | "phone" | "whatsapp"
      financial_event_type:
        | "invoice_created"
        | "invoice_issued"
        | "invoice_sent"
        | "invoice_cancelled"
        | "invoice_replaced"
        | "invoice_renegotiated"
        | "invoice_written_off"
        | "reminder_sent"
        | "payment_started"
        | "payment_processing"
        | "payment_confirmed"
        | "payment_failed"
        | "payment_refunded"
        | "payment_partially_refunded"
        | "webhook_received"
        | "adjustment_applied"
        | "discount_applied"
        | "interest_applied"
        | "fine_applied"
        | "credit_applied"
        | "receipt_generated"
        | "status_updated"
        | "manual_settlement"
        | "billing_cycle_opened"
        | "billing_cycle_closed"
      household_member_status: "active" | "inactive" | "former"
      household_relationship:
        | "spouse"
        | "child"
        | "parent"
        | "relative"
        | "dependent"
        | "legal_charge"
        | "other"
      invoice_item_category:
        | "water"
        | "association_fee"
        | "maintenance"
        | "reserve_fund"
        | "penalty"
        | "adjustment"
        | "donation"
        | "other_services"
      invoice_status:
        | "draft"
        | "issued"
        | "open"
        | "payment_pending"
        | "paid"
        | "overdue"
        | "cancelled"
        | "replaced"
        | "renegotiated"
        | "written_off"
      payment_method_type:
        | "pix"
        | "boleto"
        | "credit_card"
        | "debit_card"
        | "bank_transfer"
        | "cash"
        | "manual"
        | "other"
      payment_status:
        | "pending"
        | "processing"
        | "confirmed"
        | "failed"
        | "refunded"
        | "partially_refunded"
        | "under_review"
        | "not_reconciled"
      platform_assignment_status: "active" | "revoked"
      platform_role: "platform_admin" | "platform_support"
      profile_status: "active" | "inactive" | "under_review" | "disabled"
      property_status: "active" | "inactive" | "under_review"
      residence_membership_end_reason:
        | "moved_out"
        | "ownership_transferred"
        | "tenancy_ended"
        | "evicted"
        | "deceased"
        | "blocked"
        | "replaced"
        | "administrative"
      residence_membership_status: "active" | "pending" | "revoked"
      residence_role:
        | "owner"
        | "tenant"
        | "resident"
        | "dependent"
        | "authorized_contact"
      resident_status:
        | "pending"
        | "active"
        | "inactive"
        | "former"
        | "deceased"
        | "blocked"
      tenant_membership_status: "active" | "pending" | "revoked"
      tenant_permission:
        | "tenant_members:read"
        | "tenant_members:write"
        | "residences:read"
        | "residences:write"
        | "profiles:read_association"
        | "profiles:update_association"
        | "profile_contacts:read_association"
        | "profile_contacts:verify"
        | "tenant_context:admin"
        | "residents:read"
        | "residents:write"
        | "residence_payers:read"
        | "residence_payers:write"
        | "household:read"
        | "household:write"
        | "invitations:read"
        | "invitations:write"
        | "association_details:read"
        | "association_details:write"
        | "audit:read_association"
        | "residences:read_routes"
      tenant_role:
        | "association_admin"
        | "association_operator"
        | "association_finance"
        | "association_support"
        | "association_viewer"
        | "association_collector"
      tenant_status: "active" | "inactive" | "under_review"
      verification_state:
        | "unverified"
        | "pending"
        | "verified"
        | "invalid"
        | "outdated"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
  resident: {
    Enums: {
      adjustment_category: [
        "discount",
        "interest",
        "fine",
        "credit",
        "debit",
        "correction",
        "other",
      ],
      billing_account_status: ["active", "inactive", "suspended", "closed"],
      billing_cycle_status: ["draft", "open", "closed", "cancelled"],
      contact_type: ["email", "phone", "whatsapp"],
      financial_event_type: [
        "invoice_created",
        "invoice_issued",
        "invoice_sent",
        "invoice_cancelled",
        "invoice_replaced",
        "invoice_renegotiated",
        "invoice_written_off",
        "reminder_sent",
        "payment_started",
        "payment_processing",
        "payment_confirmed",
        "payment_failed",
        "payment_refunded",
        "payment_partially_refunded",
        "webhook_received",
        "adjustment_applied",
        "discount_applied",
        "interest_applied",
        "fine_applied",
        "credit_applied",
        "receipt_generated",
        "status_updated",
        "manual_settlement",
        "billing_cycle_opened",
        "billing_cycle_closed",
      ],
      household_member_status: ["active", "inactive", "former"],
      household_relationship: [
        "spouse",
        "child",
        "parent",
        "relative",
        "dependent",
        "legal_charge",
        "other",
      ],
      invoice_item_category: [
        "water",
        "association_fee",
        "maintenance",
        "reserve_fund",
        "penalty",
        "adjustment",
        "donation",
        "other_services",
      ],
      invoice_status: [
        "draft",
        "issued",
        "open",
        "payment_pending",
        "paid",
        "overdue",
        "cancelled",
        "replaced",
        "renegotiated",
        "written_off",
      ],
      payment_method_type: [
        "pix",
        "boleto",
        "credit_card",
        "debit_card",
        "bank_transfer",
        "cash",
        "manual",
        "other",
      ],
      payment_status: [
        "pending",
        "processing",
        "confirmed",
        "failed",
        "refunded",
        "partially_refunded",
        "under_review",
        "not_reconciled",
      ],
      platform_assignment_status: ["active", "revoked"],
      platform_role: ["platform_admin", "platform_support"],
      profile_status: ["active", "inactive", "under_review", "disabled"],
      property_status: ["active", "inactive", "under_review"],
      residence_membership_end_reason: [
        "moved_out",
        "ownership_transferred",
        "tenancy_ended",
        "evicted",
        "deceased",
        "blocked",
        "replaced",
        "administrative",
      ],
      residence_membership_status: ["active", "pending", "revoked"],
      residence_role: [
        "owner",
        "tenant",
        "resident",
        "dependent",
        "authorized_contact",
      ],
      resident_status: [
        "pending",
        "active",
        "inactive",
        "former",
        "deceased",
        "blocked",
      ],
      tenant_membership_status: ["active", "pending", "revoked"],
      tenant_permission: [
        "tenant_members:read",
        "tenant_members:write",
        "residences:read",
        "residences:write",
        "profiles:read_association",
        "profiles:update_association",
        "profile_contacts:read_association",
        "profile_contacts:verify",
        "tenant_context:admin",
        "residents:read",
        "residents:write",
        "residence_payers:read",
        "residence_payers:write",
        "household:read",
        "household:write",
        "invitations:read",
        "invitations:write",
        "association_details:read",
        "association_details:write",
        "audit:read_association",
        "residences:read_routes",
      ],
      tenant_role: [
        "association_admin",
        "association_operator",
        "association_finance",
        "association_support",
        "association_viewer",
        "association_collector",
      ],
      tenant_status: ["active", "inactive", "under_review"],
      verification_state: [
        "unverified",
        "pending",
        "verified",
        "invalid",
        "outdated",
      ],
    },
  },
} as const

