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
      d2_notifications: {
        Row: {
          body_key: string
          category: string
          created_at: string
          id: string
          params: Json
          profile_id: string
          read_at: string | null
          tenant_id: string
          title_key: string
        }
        Insert: {
          body_key: string
          category: string
          created_at?: string
          id: string
          params?: Json
          profile_id: string
          read_at?: string | null
          tenant_id: string
          title_key: string
        }
        Update: {
          body_key?: string
          category?: string
          created_at?: string
          id?: string
          params?: Json
          profile_id?: string
          read_at?: string | null
          tenant_id?: string
          title_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "d2_notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "d2_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "d2_notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "d2_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      d2_platform_admins: {
        Row: {
          active: boolean
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      d2_profile_contacts: {
        Row: {
          communication_preference_flags: Json
          contact_type: string
          created_at: string
          deleted_at: string | null
          display_value: string
          id: string
          invalidated_at: string | null
          normalized_value: string
          outdated_at: string | null
          profile_id: string
          updated_at: string
          verification_sent_at: string | null
          verification_state: string
          verified_at: string | null
        }
        Insert: {
          communication_preference_flags?: Json
          contact_type: string
          created_at?: string
          deleted_at?: string | null
          display_value: string
          id: string
          invalidated_at?: string | null
          normalized_value: string
          outdated_at?: string | null
          profile_id: string
          updated_at?: string
          verification_sent_at?: string | null
          verification_state: string
          verified_at?: string | null
        }
        Update: {
          communication_preference_flags?: Json
          contact_type?: string
          created_at?: string
          deleted_at?: string | null
          display_value?: string
          id?: string
          invalidated_at?: string | null
          normalized_value?: string
          outdated_at?: string | null
          profile_id?: string
          updated_at?: string
          verification_sent_at?: string | null
          verification_state?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "d2_profile_contacts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "d2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      d2_profile_correction_audit: {
        Row: {
          actor_user_id: string
          created_at: string
          field_name: string
          id: string
          new_value: string
          old_value: string
          reason: string
          target_profile_id: string
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          field_name: string
          id?: string
          new_value: string
          old_value: string
          reason: string
          target_profile_id: string
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string
          old_value?: string
          reason?: string
          target_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "d2_profile_correction_audit_target_profile_id_fkey"
            columns: ["target_profile_id"]
            isOneToOne: false
            referencedRelation: "d2_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      d2_profiles: {
        Row: {
          birth_date: string
          created_at: string
          display_name: string | null
          document: string
          full_name: string
          id: string
          photo_path: string | null
          preferred_name: string | null
          pronoun_preference: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          birth_date: string
          created_at?: string
          display_name?: string | null
          document: string
          full_name: string
          id: string
          photo_path?: string | null
          preferred_name?: string | null
          pronoun_preference?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          birth_date?: string
          created_at?: string
          display_name?: string | null
          document?: string
          full_name?: string
          id?: string
          photo_path?: string | null
          preferred_name?: string | null
          pronoun_preference?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      d2_properties: {
        Row: {
          address: string
          created_at: string
          id: string
          tenant_id: string
        }
        Insert: {
          address: string
          created_at?: string
          id: string
          tenant_id: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "d2_properties_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "d2_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      d2_residence_members: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          profile_id: string
          property_id: string
          role: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id: string
          is_primary?: boolean
          profile_id: string
          property_id: string
          role: string
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          profile_id?: string
          property_id?: string
          role?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "d2_residence_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "d2_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "d2_residence_members_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "d2_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "d2_residence_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "d2_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      d2_support_messages: {
        Row: {
          content: string
          created_at: string
          delivery_sequence: number
          id: string
          property_id: string
          resident_access_revoked: boolean
          resident_profile_id: string
          resident_user_id: string
          sender_profile_id: string | null
          sender_type: string
          support_request_id: string
          tenant_id: string
        }
        Insert: {
          content: string
          created_at?: string
          delivery_sequence?: never
          id: string
          property_id: string
          resident_access_revoked?: boolean
          resident_profile_id: string
          resident_user_id: string
          sender_profile_id?: string | null
          sender_type: string
          support_request_id: string
          tenant_id: string
        }
        Update: {
          content?: string
          created_at?: string
          delivery_sequence?: never
          id?: string
          property_id?: string
          resident_access_revoked?: boolean
          resident_profile_id?: string
          resident_user_id?: string
          sender_profile_id?: string | null
          sender_type?: string
          support_request_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "d2_support_messages_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "d2_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "d2_support_messages_resident_profile_id_fkey"
            columns: ["resident_profile_id"]
            isOneToOne: false
            referencedRelation: "d2_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "d2_support_messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "d2_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "d2_support_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "d2_tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_identity_projection_fk"
            columns: [
              "support_request_id",
              "tenant_id",
              "property_id",
              "resident_profile_id",
            ]
            isOneToOne: false
            referencedRelation: "d2_support_requests"
            referencedColumns: ["id", "tenant_id", "property_id", "profile_id"]
          },
          {
            foreignKeyName: "support_messages_request_fk"
            columns: ["support_request_id"]
            isOneToOne: false
            referencedRelation: "d2_support_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      d2_support_requests: {
        Row: {
          category: string
          created_at: string
          id: string
          profile_id: string
          property_id: string
          protocol: string
          status: string
          subject: string
          tenant_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id: string
          profile_id: string
          property_id: string
          protocol: string
          status?: string
          subject: string
          tenant_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          profile_id?: string
          property_id?: string
          protocol?: string
          status?: string
          subject?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "d2_support_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "d2_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "d2_support_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "d2_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "d2_support_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "d2_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      d2_tenant_members: {
        Row: {
          created_at: string
          id: string
          role: string
          status: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          role: string
          status?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          status?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "d2_tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "d2_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      d2_tenants: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
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
          relationship: Database["public"]["Enums"]["household_relationship"]
          responsible_profile_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["household_member_status"]
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
          relationship: Database["public"]["Enums"]["household_relationship"]
          responsible_profile_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["household_member_status"]
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
          relationship?: Database["public"]["Enums"]["household_relationship"]
          responsible_profile_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["household_member_status"]
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
      platform_role_assignments: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["platform_role"]
          status: Database["public"]["Enums"]["platform_assignment_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          revoked_at?: string | null
          role: Database["public"]["Enums"]["platform_role"]
          status?: Database["public"]["Enums"]["platform_assignment_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["platform_role"]
          status?: Database["public"]["Enums"]["platform_assignment_status"]
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
          contact_type: Database["public"]["Enums"]["contact_type"]
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
          verification_state: Database["public"]["Enums"]["verification_state"]
          verified_at: string | null
        }
        Insert: {
          contact_type: Database["public"]["Enums"]["contact_type"]
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
          verification_state?: Database["public"]["Enums"]["verification_state"]
          verified_at?: string | null
        }
        Update: {
          contact_type?: Database["public"]["Enums"]["contact_type"]
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
          verification_state?: Database["public"]["Enums"]["verification_state"]
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
          status: Database["public"]["Enums"]["profile_status"]
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
          status?: Database["public"]["Enums"]["profile_status"]
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
          status?: Database["public"]["Enums"]["profile_status"]
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
          status: Database["public"]["Enums"]["property_status"]
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
          status?: Database["public"]["Enums"]["property_status"]
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
          status?: Database["public"]["Enums"]["property_status"]
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
            | Database["public"]["Enums"]["residence_membership_end_reason"]
            | null
          id: string
          is_primary: boolean
          moveout_requested_at: string | null
          profile_id: string
          property_id: string
          requested_end_date: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["residence_role"]
          start_date: string | null
          status: Database["public"]["Enums"]["residence_membership_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          end_reason?:
            | Database["public"]["Enums"]["residence_membership_end_reason"]
            | null
          id?: string
          is_primary?: boolean
          moveout_requested_at?: string | null
          profile_id: string
          property_id: string
          requested_end_date?: string | null
          revoked_at?: string | null
          role: Database["public"]["Enums"]["residence_role"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["residence_membership_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          end_reason?:
            | Database["public"]["Enums"]["residence_membership_end_reason"]
            | null
          id?: string
          is_primary?: boolean
          moveout_requested_at?: string | null
          profile_id?: string
          property_id?: string
          requested_end_date?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["residence_role"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["residence_membership_status"]
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
          status: Database["public"]["Enums"]["resident_status"]
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
          status?: Database["public"]["Enums"]["resident_status"]
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
          status?: Database["public"]["Enums"]["resident_status"]
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
          role: Database["public"]["Enums"]["tenant_role"]
          status: Database["public"]["Enums"]["tenant_membership_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string
          profile_id: string
          revoked_at?: string | null
          role: Database["public"]["Enums"]["tenant_role"]
          status?: Database["public"]["Enums"]["tenant_membership_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string
          profile_id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["tenant_role"]
          status?: Database["public"]["Enums"]["tenant_membership_status"]
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
          status: Database["public"]["Enums"]["tenant_status"]
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
          status?: Database["public"]["Enums"]["tenant_status"]
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
          status?: Database["public"]["Enums"]["tenant_status"]
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
      d2_apply_profile_correction: {
        Args: {
          audit_reason: string
          replacement_document: string
          target_profile_id: string
        }
        Returns: string
      }
      d2_create_support_message: {
        Args: {
          requested_property_id?: string
          requested_resident_profile_id?: string
          requested_tenant_id?: string
          target_content: string
          target_created_at?: string
          target_sender_profile_id?: string
          target_sender_type?: string
          target_support_request_id: string
        }
        Returns: {
          content: string
          created_at: string
          delivery_sequence: number
          id: string
          property_id: string
          resident_access_revoked: boolean
          resident_profile_id: string
          resident_user_id: string
          sender_profile_id: string | null
          sender_type: string
          support_request_id: string
          tenant_id: string
        }
        SetofOptions: {
          from: "*"
          to: "d2_support_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      d2_current_profile_id: { Args: never; Returns: string }
      d2_is_active_resident_support_participant: {
        Args: {
          target_profile_id: string
          target_property_id: string
          target_tenant_id: string
        }
        Returns: boolean
      }
      d2_is_authorized_operator: {
        Args: { target_tenant_id: string }
        Returns: boolean
      }
      d2_is_platform_admin: { Args: never; Returns: boolean }
      d2_is_support_request_author: {
        Args: { target_request_id: string }
        Returns: boolean
      }
      d2_is_tenant_member: {
        Args: { target_tenant_id: string }
        Returns: boolean
      }
      has_platform_role: {
        Args: { target_role: Database["public"]["Enums"]["platform_role"] }
        Returns: boolean
      }
      has_tenant_permission: {
        Args: {
          target_permission: Database["public"]["Enums"]["tenant_permission"]
          target_tenant_id: string
        }
        Returns: boolean
      }
      has_tenant_role: {
        Args: {
          target_role: Database["public"]["Enums"]["tenant_role"]
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
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      contact_type: "email" | "phone" | "whatsapp"
      household_member_status: "active" | "inactive" | "former"
      household_relationship:
        | "spouse"
        | "child"
        | "parent"
        | "relative"
        | "dependent"
        | "legal_charge"
        | "other"
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
    Enums: {
      contact_type: ["email", "phone", "whatsapp"],
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

