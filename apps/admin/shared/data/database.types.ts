export type Json
  = | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
  public: {
    Tables: {
      addon_preset_items: {
        Row: {
          addon_id: string
          preset_id: string
          sort_order: number
        }
        Insert: {
          addon_id: string
          preset_id: string
          sort_order?: number
        }
        Update: {
          addon_id?: string
          preset_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: 'addon_preset_items_addon_id_fkey'
            columns: ['addon_id']
            isOneToOne: false
            referencedRelation: 'addons'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'addon_preset_items_preset_id_fkey'
            columns: ['preset_id']
            isOneToOne: false
            referencedRelation: 'addon_presets'
            referencedColumns: ['id']
          },
        ]
      }
      addon_presets: {
        Row: {
          active: boolean
          deleted_at: string | null
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          active?: boolean
          deleted_at?: string | null
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          active?: boolean
          deleted_at?: string | null
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'addon_presets_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      addons: {
        Row: {
          active: boolean
          deleted_at: string | null
          id: string
          name: string
          photo: string | null
          price: number
          sort_order: number
          tenant_id: string
          weight: number | null
        }
        Insert: {
          active?: boolean
          deleted_at?: string | null
          id?: string
          name: string
          photo?: string | null
          price?: number
          sort_order?: number
          tenant_id: string
          weight?: number | null
        }
        Update: {
          active?: boolean
          deleted_at?: string | null
          id?: string
          name?: string
          photo?: string | null
          price?: number
          sort_order?: number
          tenant_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'addons_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      appointment_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          actor_role: string | null
          appointment_id: string
          created_at: string | null
          event_type: string
          id: string
          meta: Json | null
          tenant_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          appointment_id: string
          created_at?: string | null
          event_type: string
          id?: string
          meta?: Json | null
          tenant_id: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          appointment_id?: string
          created_at?: string | null
          event_type?: string
          id?: string
          meta?: Json | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'appointment_events_appointment_id_fkey'
            columns: ['appointment_id']
            isOneToOne: false
            referencedRelation: 'appointments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'appointment_events_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      appointment_groups: {
        Row: {
          branch_id: string | null
          business_date: string | null
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          id: string
          idempotency_key: string | null
          notes: string | null
          processed_at: string | null
          processed_by: string | null
          requested_services: Json | null
          source: string
          status: string
          tenant_id: string
          total_price: number | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          business_date?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          requested_services?: Json | null
          source?: string
          status?: string
          tenant_id: string
          total_price?: number | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          business_date?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          requested_services?: Json | null
          source?: string
          status?: string
          tenant_id?: string
          total_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'appointment_groups_branch_id_fkey'
            columns: ['branch_id']
            isOneToOne: false
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'appointment_groups_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'appointment_groups_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      appointment_reminders: {
        Row: {
          appointment_id: string
          created_at: string
          id: string
          remind_before_minutes: number
          sent_at: string | null
          telegram_chat_id: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          id?: string
          remind_before_minutes: number
          sent_at?: string | null
          telegram_chat_id: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          id?: string
          remind_before_minutes?: number
          sent_at?: string | null
          telegram_chat_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'appointment_reminders_appointment_id_fkey'
            columns: ['appointment_id']
            isOneToOne: false
            referencedRelation: 'appointments'
            referencedColumns: ['id']
          },
        ]
      }
      appointment_settings: {
        Row: {
          allow_client_cancellation: boolean
          allow_client_reschedule: boolean
          auto_confirm: boolean
          booking_horizon_days: number
          cancellation_deadline_hours: number
          created_at: string
          default_allow_resource_choice: boolean
          default_booking_mode: string
          default_is_bookable: boolean
          default_max_duration: number
          id: string
          resource_label: string
          resource_mode: Database['public']['Enums']['appointment_resource_mode']
          slot_step_minutes: number
          staff_name_format: Database['public']['Enums']['staff_name_format']
          tenant_id: string
          updated_at: string
        }
        Insert: {
          allow_client_cancellation?: boolean
          allow_client_reschedule?: boolean
          auto_confirm?: boolean
          booking_horizon_days?: number
          cancellation_deadline_hours?: number
          created_at?: string
          default_allow_resource_choice?: boolean
          default_booking_mode?: string
          default_is_bookable?: boolean
          default_max_duration?: number
          id?: string
          resource_label?: string
          resource_mode?: Database['public']['Enums']['appointment_resource_mode']
          slot_step_minutes?: number
          staff_name_format?: Database['public']['Enums']['staff_name_format']
          tenant_id: string
          updated_at?: string
        }
        Update: {
          allow_client_cancellation?: boolean
          allow_client_reschedule?: boolean
          auto_confirm?: boolean
          booking_horizon_days?: number
          cancellation_deadline_hours?: number
          created_at?: string
          default_allow_resource_choice?: boolean
          default_booking_mode?: string
          default_is_bookable?: boolean
          default_max_duration?: number
          id?: string
          resource_label?: string
          resource_mode?: Database['public']['Enums']['appointment_resource_mode']
          slot_step_minutes?: number
          staff_name_format?: Database['public']['Enums']['staff_name_format']
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'appointment_settings_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: true
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      appointments: {
        Row: {
          actual_ends_at: string | null
          allow_cancel_snapshot: boolean | null
          allow_reschedule_snapshot: boolean | null
          booking_mode: string | null
          branch_id: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_phone: string
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          ends_at: string
          group_id: string
          id: string
          notes: string | null
          resource_assigned_by: string | null
          resource_id: string | null
          service_id: string | null
          service_name: string
          service_price: number
          starts_at: string
          status: Database['public']['Enums']['appointment_status']
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          actual_ends_at?: string | null
          allow_cancel_snapshot?: boolean | null
          allow_reschedule_snapshot?: boolean | null
          booking_mode?: string | null
          branch_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          ends_at: string
          group_id: string
          id?: string
          notes?: string | null
          resource_assigned_by?: string | null
          resource_id?: string | null
          service_id?: string | null
          service_name?: string
          service_price?: number
          starts_at: string
          status?: Database['public']['Enums']['appointment_status']
          tenant_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          actual_ends_at?: string | null
          allow_cancel_snapshot?: boolean | null
          allow_reschedule_snapshot?: boolean | null
          booking_mode?: string | null
          branch_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          ends_at?: string
          group_id?: string
          id?: string
          notes?: string | null
          resource_assigned_by?: string | null
          resource_id?: string | null
          service_id?: string | null
          service_name?: string
          service_price?: number
          starts_at?: string
          status?: Database['public']['Enums']['appointment_status']
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'appointments_branch_id_fkey'
            columns: ['branch_id']
            isOneToOne: false
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'appointments_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'appointments_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'appointment_groups'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'appointments_resource_id_fkey'
            columns: ['resource_id']
            isOneToOne: false
            referencedRelation: 'resources'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'appointments_service_id_fkey'
            columns: ['service_id']
            isOneToOne: false
            referencedRelation: 'services'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'appointments_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          actor_role: string | null
          created_at: string | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          payload: Json | null
          tenant_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          payload?: Json | null
          tenant_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          payload?: Json | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'audit_logs_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      auth_rate_limits: {
        Row: {
          count: number
          key: string
          reset_at: string
        }
        Insert: {
          count?: number
          key: string
          reset_at: string
        }
        Update: {
          count?: number
          key?: string
          reset_at?: string
        }
        Relationships: []
      }
      banners: {
        Row: {
          content: string
          created_at: string
          enabled: boolean
          id: string
          link: string | null
          page: string | null
          promo_code_id: string | null
          promotion_id: string | null
          sort_order: number
          tenant_id: string
          url: string
        }
        Insert: {
          content?: string
          created_at?: string
          enabled?: boolean
          id?: string
          link?: string | null
          page?: string | null
          promo_code_id?: string | null
          promotion_id?: string | null
          sort_order?: number
          tenant_id: string
          url: string
        }
        Update: {
          content?: string
          created_at?: string
          enabled?: boolean
          id?: string
          link?: string | null
          page?: string | null
          promo_code_id?: string | null
          promotion_id?: string | null
          sort_order?: number
          tenant_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: 'banners_promo_code_id_fkey'
            columns: ['promo_code_id']
            isOneToOne: false
            referencedRelation: 'promo_codes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'banners_promotion_id_fkey'
            columns: ['promotion_id']
            isOneToOne: false
            referencedRelation: 'promotions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'banners_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      billing_config: {
        Row: {
          grace_period_days: number
          id: boolean
          trial_days: number
        }
        Insert: {
          grace_period_days?: number
          id?: boolean
          trial_days?: number
        }
        Update: {
          grace_period_days?: number
          id?: boolean
          trial_days?: number
        }
        Relationships: []
      }
      billing_transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          description: string
          id: string
          plan_id: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          plan_id?: string | null
          tenant_id: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          plan_id?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: 'billing_transactions_plan_id_fkey'
            columns: ['plan_id']
            isOneToOne: false
            referencedRelation: 'plans'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'billing_transactions_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      branches: {
        Row: {
          address: string
          address_data: Json
          archived_at: string | null
          color: string
          created_at: string
          delivery_fee: number | null
          delivery_min_order: number | null
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          notifications: Json | null
          order_number_prefix: string | null
          phone: string | null
          tenant_id: string
          updated_at: string
          working_hours_schedule: Json | null
        }
        Insert: {
          address: string
          address_data: Json
          archived_at?: string | null
          color?: string
          created_at?: string
          delivery_fee?: number | null
          delivery_min_order?: number | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          notifications?: Json | null
          order_number_prefix?: string | null
          phone?: string | null
          tenant_id: string
          updated_at?: string
          working_hours_schedule?: Json | null
        }
        Update: {
          address?: string
          address_data?: Json
          archived_at?: string | null
          color?: string
          created_at?: string
          delivery_fee?: number | null
          delivery_min_order?: number | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          notifications?: Json | null
          order_number_prefix?: string | null
          phone?: string | null
          tenant_id?: string
          updated_at?: string
          working_hours_schedule?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: 'branches_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      categories: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          deleted_at: string | null
          id: string
          kind: string
          name: string
          photo_url: string | null
          slug: string | null
          sort_order: number
          tag_id: string | null
          tenant_id: string
          type: string
          updated_at: string
          use_first_dish_photo: boolean
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind?: string
          name: string
          photo_url?: string | null
          slug?: string | null
          sort_order?: number
          tag_id?: string | null
          tenant_id: string
          type?: string
          updated_at?: string
          use_first_dish_photo?: boolean
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind?: string
          name?: string
          photo_url?: string | null
          slug?: string | null
          sort_order?: number
          tag_id?: string | null
          tenant_id?: string
          type?: string
          updated_at?: string
          use_first_dish_photo?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'categories_tag_id_fkey'
            columns: ['tag_id']
            isOneToOne: false
            referencedRelation: 'dish_tags'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'categories_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      combo_branches: {
        Row: {
          branch_id: string
          combo_id: string
        }
        Insert: {
          branch_id: string
          combo_id: string
        }
        Update: {
          branch_id?: string
          combo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'combo_branches_branch_id_fkey'
            columns: ['branch_id']
            isOneToOne: false
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'combo_branches_combo_id_fkey'
            columns: ['combo_id']
            isOneToOne: false
            referencedRelation: 'combos'
            referencedColumns: ['id']
          },
        ]
      }
      combo_items: {
        Row: {
          addon_ids: string[]
          combo_id: string
          dish_id: string
          id: string
          modifier_option_ids: string[] | null
          sort_order: number | null
        }
        Insert: {
          addon_ids?: string[]
          combo_id: string
          dish_id: string
          id?: string
          modifier_option_ids?: string[] | null
          sort_order?: number | null
        }
        Update: {
          addon_ids?: string[]
          combo_id?: string
          dish_id?: string
          id?: string
          modifier_option_ids?: string[] | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'combo_items_combo_id_fkey'
            columns: ['combo_id']
            isOneToOne: false
            referencedRelation: 'combos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'combo_items_dish_id_fkey'
            columns: ['dish_id']
            isOneToOne: false
            referencedRelation: 'dishes'
            referencedColumns: ['id']
          },
        ]
      }
      combo_tag_assignments: {
        Row: {
          combo_id: string
          tag_id: string
          tenant_id: string
        }
        Insert: {
          combo_id: string
          tag_id: string
          tenant_id: string
        }
        Update: {
          combo_id?: string
          tag_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'combo_tag_assignments_combo_id_fkey'
            columns: ['combo_id']
            isOneToOne: false
            referencedRelation: 'combos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'combo_tag_assignments_tag_id_fkey'
            columns: ['tag_id']
            isOneToOne: false
            referencedRelation: 'dish_tags'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'combo_tag_assignments_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      combos: {
        Row: {
          active: boolean | null
          category_id: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          photos: string[] | null
          price: number
          sort_order: number | null
          tenant_id: string
        }
        Insert: {
          active?: boolean | null
          category_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          photos?: string[] | null
          price?: number
          sort_order?: number | null
          tenant_id: string
        }
        Update: {
          active?: boolean | null
          category_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          photos?: string[] | null
          price?: number
          sort_order?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'combos_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'combos_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      customer_addresses: {
        Row: {
          address: string
          apartment: string | null
          comment: string | null
          coordinates: unknown
          created_at: string
          customer_id: string
          entrance: string | null
          floor: string | null
          id: string
          intercom: string | null
          is_default: boolean
          label: string
        }
        Insert: {
          address: string
          apartment?: string | null
          comment?: string | null
          coordinates: unknown
          created_at?: string
          customer_id: string
          entrance?: string | null
          floor?: string | null
          id?: string
          intercom?: string | null
          is_default?: boolean
          label?: string
        }
        Update: {
          address?: string
          apartment?: string | null
          comment?: string | null
          coordinates?: unknown
          created_at?: string
          customer_id?: string
          entrance?: string | null
          floor?: string | null
          id?: string
          intercom?: string | null
          is_default?: boolean
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: 'customer_addresses_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
        ]
      }
      customer_sessions: {
        Row: {
          created_at: string
          customer_id: string
          expires_at: string
          id: string
          last_used_at: string
          telegram_id: string
          tenant_id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          expires_at: string
          id?: string
          last_used_at?: string
          telegram_id: string
          tenant_id: string
          token_hash: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          expires_at?: string
          id?: string
          last_used_at?: string
          telegram_id?: string
          tenant_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: 'customer_sessions_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'customer_sessions_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      customers: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          phone: string | null
          telegram_id: string | null
          tenant_id: string
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          telegram_id?: string | null
          tenant_id: string
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          telegram_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'customers_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      delivery_zones: {
        Row: {
          branch_id: string
          color: string
          coordinates: Json
          created_at: string
          delivery_fee: number
          free_delivery_from: number
          id: string
          is_active: boolean
          min_order: number
          name: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          color?: string
          coordinates: Json
          created_at?: string
          delivery_fee?: number
          free_delivery_from?: number
          id?: string
          is_active?: boolean
          min_order?: number
          name: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          color?: string
          coordinates?: Json
          created_at?: string
          delivery_fee?: number
          free_delivery_from?: number
          id?: string
          is_active?: boolean
          min_order?: number
          name?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'delivery_zones_branch_id_fkey'
            columns: ['branch_id']
            isOneToOne: false
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'delivery_zones_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      dish_addons: {
        Row: {
          addon_id: string
          dish_id: string
          sort_order: number
        }
        Insert: {
          addon_id: string
          dish_id: string
          sort_order?: number
        }
        Update: {
          addon_id?: string
          dish_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: 'dish_addons_addon_id_fkey'
            columns: ['addon_id']
            isOneToOne: false
            referencedRelation: 'addons'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'dish_addons_dish_id_fkey'
            columns: ['dish_id']
            isOneToOne: false
            referencedRelation: 'dishes'
            referencedColumns: ['id']
          },
        ]
      }
      dish_branches: {
        Row: {
          branch_id: string
          dish_id: string
        }
        Insert: {
          branch_id: string
          dish_id: string
        }
        Update: {
          branch_id?: string
          dish_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'dish_branches_branch_id_fkey'
            columns: ['branch_id']
            isOneToOne: false
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'dish_branches_dish_id_fkey'
            columns: ['dish_id']
            isOneToOne: false
            referencedRelation: 'dishes'
            referencedColumns: ['id']
          },
        ]
      }
      dish_modifier_groups: {
        Row: {
          dish_id: string
          group_id: string
          sort_order: number
        }
        Insert: {
          dish_id: string
          group_id: string
          sort_order?: number
        }
        Update: {
          dish_id?: string
          group_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: 'dish_modifier_groups_dish_id_fkey'
            columns: ['dish_id']
            isOneToOne: false
            referencedRelation: 'dishes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'dish_modifier_groups_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'modifier_groups'
            referencedColumns: ['id']
          },
        ]
      }
      dish_modifier_options: {
        Row: {
          active: boolean
          dish_id: string
          is_default: boolean
          option_id: string
          price_delta: number
          sort_order: number
          weight: number | null
          weight_delta: number | null
        }
        Insert: {
          active?: boolean
          dish_id: string
          is_default?: boolean
          option_id: string
          price_delta?: number
          sort_order?: number
          weight?: number | null
          weight_delta?: number | null
        }
        Update: {
          active?: boolean
          dish_id?: string
          is_default?: boolean
          option_id?: string
          price_delta?: number
          sort_order?: number
          weight?: number | null
          weight_delta?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'dish_modifier_options_dish_id_fkey'
            columns: ['dish_id']
            isOneToOne: false
            referencedRelation: 'dishes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'dish_modifier_options_option_id_fkey'
            columns: ['option_id']
            isOneToOne: false
            referencedRelation: 'modifier_options'
            referencedColumns: ['id']
          },
        ]
      }
      dish_tag_assignments: {
        Row: {
          dish_id: string
          sort_order: number
          tag_id: string
          tenant_id: string
        }
        Insert: {
          dish_id: string
          sort_order?: number
          tag_id: string
          tenant_id: string
        }
        Update: {
          dish_id?: string
          sort_order?: number
          tag_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'dish_tag_assignments_dish_id_fkey'
            columns: ['dish_id']
            isOneToOne: false
            referencedRelation: 'dishes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'dish_tag_assignments_tag_id_fkey'
            columns: ['tag_id']
            isOneToOne: false
            referencedRelation: 'dish_tags'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'dish_tag_assignments_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      dish_tags: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          name: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name: string
          sort_order?: number
          tenant_id: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'dish_tags_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      dishes: {
        Row: {
          active: boolean
          category_id: string | null
          created_at: string
          deleted_at: string | null
          description: string
          id: string
          ingredients: Json
          long_description: string | null
          max_addons: number | null
          name: string
          nutrition: Json | null
          photos: string[]
          price: number
          requires_kitchen: boolean
          sort_order: number
          tenant_id: string
          updated_at: string
          weight_unit: string
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          id?: string
          ingredients?: Json
          long_description?: string | null
          max_addons?: number | null
          name: string
          nutrition?: Json | null
          photos?: string[]
          price: number
          requires_kitchen?: boolean
          sort_order?: number
          tenant_id: string
          updated_at?: string
          weight_unit?: string
        }
        Update: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          id?: string
          ingredients?: Json
          long_description?: string | null
          max_addons?: number | null
          name?: string
          nutrition?: Json | null
          photos?: string[]
          price?: number
          requires_kitchen?: boolean
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          weight_unit?: string
        }
        Relationships: [
          {
            foreignKeyName: 'dishes_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'dishes_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      edge_alerts_state: {
        Row: {
          id: number
          last_alert_at: string | null
        }
        Insert: {
          id?: number
          last_alert_at?: string | null
        }
        Update: {
          id?: number
          last_alert_at?: string | null
        }
        Relationships: []
      }
      galleries: {
        Row: {
          autoplay: boolean
          autoplay_interval: number
          created_at: string
          description: string | null
          display_mode: string
          id: string
          name: string
          sort_order: number
          tenant_id: string
          title: string | null
        }
        Insert: {
          autoplay?: boolean
          autoplay_interval?: number
          created_at?: string
          description?: string | null
          display_mode?: string
          id?: string
          name: string
          sort_order?: number
          tenant_id: string
          title?: string | null
        }
        Update: {
          autoplay?: boolean
          autoplay_interval?: number
          created_at?: string
          description?: string | null
          display_mode?: string
          id?: string
          name?: string
          sort_order?: number
          tenant_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'galleries_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      gallery_photos: {
        Row: {
          created_at: string
          gallery_id: string
          id: string
          sort_order: number
          tenant_id: string
          url: string
        }
        Insert: {
          created_at?: string
          gallery_id: string
          id?: string
          sort_order?: number
          tenant_id: string
          url?: string
        }
        Update: {
          created_at?: string
          gallery_id?: string
          id?: string
          sort_order?: number
          tenant_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: 'gallery_photos_gallery_id_fkey'
            columns: ['gallery_id']
            isOneToOne: false
            referencedRelation: 'galleries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'gallery_photos_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      kitchen_queue: {
        Row: {
          addons: Json
          assigned_at: string | null
          assigned_to: string | null
          category_name: string | null
          charged: boolean
          combo_id: string | null
          combo_name: string | null
          completed_at: string | null
          created_at: string
          delivery_type: string
          dish_id: string | null
          dish_name: string
          dismissed_at: string | null
          id: string
          modifiers: Json
          order_id: string
          order_item_id: string
          removed_ingredients: Json
          served_at: string | null
          served_by: string | null
          skip_kitchen: boolean
          status: string
          tenant_id: string
        }
        Insert: {
          addons?: Json
          assigned_at?: string | null
          assigned_to?: string | null
          category_name?: string | null
          charged?: boolean
          combo_id?: string | null
          combo_name?: string | null
          completed_at?: string | null
          created_at?: string
          delivery_type: string
          dish_id?: string | null
          dish_name: string
          dismissed_at?: string | null
          id?: string
          modifiers?: Json
          order_id: string
          order_item_id: string
          removed_ingredients?: Json
          served_at?: string | null
          served_by?: string | null
          skip_kitchen?: boolean
          status?: string
          tenant_id: string
        }
        Update: {
          addons?: Json
          assigned_at?: string | null
          assigned_to?: string | null
          category_name?: string | null
          charged?: boolean
          combo_id?: string | null
          combo_name?: string | null
          completed_at?: string | null
          created_at?: string
          delivery_type?: string
          dish_id?: string | null
          dish_name?: string
          dismissed_at?: string | null
          id?: string
          modifiers?: Json
          order_id?: string
          order_item_id?: string
          removed_ingredients?: Json
          served_at?: string | null
          served_by?: string | null
          skip_kitchen?: boolean
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'kitchen_queue_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'kitchen_queue_order_item_id_fkey'
            columns: ['order_item_id']
            isOneToOne: false
            referencedRelation: 'order_items'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'kitchen_queue_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      modifier_groups: {
        Row: {
          active: boolean
          affects_weight: boolean
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          sort_order: number
          tenant_id: string
          weight_mode: string
        }
        Insert: {
          active?: boolean
          affects_weight?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          sort_order?: number
          tenant_id: string
          weight_mode?: string
        }
        Update: {
          active?: boolean
          affects_weight?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          sort_order?: number
          tenant_id?: string
          weight_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: 'modifier_groups_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      modifier_options: {
        Row: {
          active: boolean
          created_at: string
          group_id: string
          id: string
          name: string
          sort_order: number
          weight: number | null
          weight_delta: number | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          group_id: string
          id?: string
          name: string
          sort_order?: number
          weight?: number | null
          weight_delta?: number | null
        }
        Update: {
          active?: boolean
          created_at?: string
          group_id?: string
          id?: string
          name?: string
          sort_order?: number
          weight?: number | null
          weight_delta?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'modifier_options_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'modifier_groups'
            referencedColumns: ['id']
          },
        ]
      }
      module_configs: {
        Row: {
          business_types: Json
          description: string
          icon: string
          is_active: boolean
          key: string
          menu_styles: Json | null
          name: string
          required_plan_key: string
          sort_order: number
        }
        Insert: {
          business_types?: Json
          description?: string
          icon?: string
          is_active?: boolean
          key: string
          menu_styles?: Json | null
          name: string
          required_plan_key: string
          sort_order?: number
        }
        Update: {
          business_types?: Json
          description?: string
          icon?: string
          is_active?: boolean
          key?: string
          menu_styles?: Json | null
          name?: string
          required_plan_key?: string
          sort_order?: number
        }
        Relationships: []
      }
      order_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          actor_role: string | null
          created_at: string | null
          event_type: string
          id: string
          meta: Json | null
          order_id: string
          tenant_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          meta?: Json | null
          order_id: string
          tenant_id: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          meta?: Json | null
          order_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'order_events_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'order_events_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      order_items: {
        Row: {
          added_by: string | null
          addons: Json
          category_name: string | null
          combo_id: string | null
          combo_items: Json | null
          completed_at: string | null
          confirmed_by: string | null
          customizable: boolean | null
          dish_id: string | null
          dish_name: string
          id: string
          modifiers: Json | null
          order_id: string
          price: number
          quantity: number
          removed_ingredients: string[] | null
          sort_order: number
          status: string
          tenant_id: string
        }
        Insert: {
          added_by?: string | null
          addons?: Json
          category_name?: string | null
          combo_id?: string | null
          combo_items?: Json | null
          completed_at?: string | null
          confirmed_by?: string | null
          customizable?: boolean | null
          dish_id?: string | null
          dish_name: string
          id?: string
          modifiers?: Json | null
          order_id: string
          price: number
          quantity?: number
          removed_ingredients?: string[] | null
          sort_order?: number
          status?: string
          tenant_id: string
        }
        Update: {
          added_by?: string | null
          addons?: Json
          category_name?: string | null
          combo_id?: string | null
          combo_items?: Json | null
          completed_at?: string | null
          confirmed_by?: string | null
          customizable?: boolean | null
          dish_id?: string | null
          dish_name?: string
          id?: string
          modifiers?: Json | null
          order_id?: string
          price?: number
          quantity?: number
          removed_ingredients?: string[] | null
          sort_order?: number
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'order_items_combo_id_fkey'
            columns: ['combo_id']
            isOneToOne: false
            referencedRelation: 'combos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'order_items_dish_id_fkey'
            columns: ['dish_id']
            isOneToOne: false
            referencedRelation: 'dishes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'order_items_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'order_items_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      order_notes: {
        Row: {
          author_id: string | null
          author_name: string
          author_role: string
          content: string
          created_at: string
          id: string
          order_id: string
          tenant_id: string
        }
        Insert: {
          author_id?: string | null
          author_name: string
          author_role?: string
          content: string
          created_at?: string
          id?: string
          order_id: string
          tenant_id: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          author_role?: string
          content?: string
          created_at?: string
          id?: string
          order_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'order_notes_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'order_notes_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      order_number_counters: {
        Row: {
          period: string
          tenant_id: string
          value: number
        }
        Insert: {
          period: string
          tenant_id: string
          value?: number
        }
        Update: {
          period?: string
          tenant_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: 'order_number_counters_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      order_statuses: {
        Row: {
          created_at: string
          group_type: string
          id: string
          kitchen_visible: boolean
          name: string
          position: number
          quick_actions: Json
          tenant_id: string
        }
        Insert: {
          created_at?: string
          group_type: string
          id?: string
          kitchen_visible?: boolean
          name: string
          position?: number
          quick_actions?: Json
          tenant_id: string
        }
        Update: {
          created_at?: string
          group_type?: string
          id?: string
          kitchen_visible?: boolean
          name?: string
          position?: number
          quick_actions?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'order_statuses_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      orders: {
        Row: {
          accepted_by: string | null
          address: string | null
          apartment: string | null
          branch_id: string | null
          change_from: number | null
          comment: string | null
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_fee: number
          delivery_lat: number | null
          delivery_lon: number | null
          delivery_type: string
          delivery_zone_id: string | null
          discount_amount: number
          entrance: string | null
          floor: string | null
          guest_token: string | null
          id: string
          idempotency_key: string | null
          intercom: string | null
          kitchen_completed_at: string | null
          kitchen_lead_minutes: number | null
          kitchen_queued_at: string | null
          needs_change: boolean
          order_number: string | null
          payment_type: string
          promo_code: string | null
          promotion_id: string | null
          scheduled_at: string | null
          status: string
          subtotal: number
          table_id: string | null
          table_name: string | null
          tenant_id: string
          total: number
          updated_at: string
          visited_statuses: string[]
        }
        Insert: {
          accepted_by?: string | null
          address?: string | null
          apartment?: string | null
          branch_id?: string | null
          change_from?: number | null
          comment?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_fee?: number
          delivery_lat?: number | null
          delivery_lon?: number | null
          delivery_type: string
          delivery_zone_id?: string | null
          discount_amount?: number
          entrance?: string | null
          floor?: string | null
          guest_token?: string | null
          id?: string
          idempotency_key?: string | null
          intercom?: string | null
          kitchen_completed_at?: string | null
          kitchen_lead_minutes?: number | null
          kitchen_queued_at?: string | null
          needs_change?: boolean
          order_number?: string | null
          payment_type: string
          promo_code?: string | null
          promotion_id?: string | null
          scheduled_at?: string | null
          status?: string
          subtotal: number
          table_id?: string | null
          table_name?: string | null
          tenant_id: string
          total: number
          updated_at?: string
          visited_statuses?: string[]
        }
        Update: {
          accepted_by?: string | null
          address?: string | null
          apartment?: string | null
          branch_id?: string | null
          change_from?: number | null
          comment?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_fee?: number
          delivery_lat?: number | null
          delivery_lon?: number | null
          delivery_type?: string
          delivery_zone_id?: string | null
          discount_amount?: number
          entrance?: string | null
          floor?: string | null
          guest_token?: string | null
          id?: string
          idempotency_key?: string | null
          intercom?: string | null
          kitchen_completed_at?: string | null
          kitchen_lead_minutes?: number | null
          kitchen_queued_at?: string | null
          needs_change?: boolean
          order_number?: string | null
          payment_type?: string
          promo_code?: string | null
          promotion_id?: string | null
          scheduled_at?: string | null
          status?: string
          subtotal?: number
          table_id?: string | null
          table_name?: string | null
          tenant_id?: string
          total?: number
          updated_at?: string
          visited_statuses?: string[]
        }
        Relationships: [
          {
            foreignKeyName: 'orders_branch_id_fkey'
            columns: ['branch_id']
            isOneToOne: false
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'orders_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'orders_delivery_zone_id_fkey'
            columns: ['delivery_zone_id']
            isOneToOne: false
            referencedRelation: 'delivery_zones'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'orders_promotion_id_fkey'
            columns: ['promotion_id']
            isOneToOne: false
            referencedRelation: 'promotions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'orders_table_id_fkey'
            columns: ['table_id']
            isOneToOne: false
            referencedRelation: 'tables'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'orders_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      pending_telegram_auths: {
        Row: {
          completed_at: string | null
          expires_at: string
          nonce: string
          phone: string | null
          telegram_data: Json | null
          telegram_id: string | null
          tenant_id: string
        }
        Insert: {
          completed_at?: string | null
          expires_at: string
          nonce: string
          phone?: string | null
          telegram_data?: Json | null
          telegram_id?: string | null
          tenant_id: string
        }
        Update: {
          completed_at?: string | null
          expires_at?: string
          nonce?: string
          phone?: string | null
          telegram_data?: Json | null
          telegram_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'pending_telegram_auths_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      plans: {
        Row: {
          badge: string | null
          business_type: string
          created_at: string
          description: string
          features: Json
          id: string
          is_active: boolean
          is_featured: boolean
          key: string
          name: string
          price: number
          sort_order: number
        }
        Insert: {
          badge?: string | null
          business_type?: string
          created_at?: string
          description?: string
          features?: Json
          id?: string
          is_active?: boolean
          is_featured?: boolean
          key: string
          name: string
          price?: number
          sort_order?: number
        }
        Update: {
          badge?: string | null
          business_type?: string
          created_at?: string
          description?: string
          features?: Json
          id?: string
          is_active?: boolean
          is_featured?: boolean
          key?: string
          name?: string
          price?: number
          sort_order?: number
        }
        Relationships: []
      }
      processed_webhook_events: {
        Row: {
          event_id: string
          id: string
          payload: Json
          processed_at: string
        }
        Insert: {
          event_id: string
          id?: string
          payload?: Json
          processed_at?: string
        }
        Update: {
          event_id?: string
          id?: string
          payload?: Json
          processed_at?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          active: boolean
          active_from: string | null
          active_to: string | null
          code: string
          created_at: string
          deleted_at: string | null
          discount_type: string
          discount_value: number
          id: string
          min_order_amount: number | null
          tenant_id: string
          usage_limit: number | null
          used_count: number
        }
        Insert: {
          active?: boolean
          active_from?: string | null
          active_to?: string | null
          code: string
          created_at?: string
          deleted_at?: string | null
          discount_type: string
          discount_value: number
          id?: string
          min_order_amount?: number | null
          tenant_id: string
          usage_limit?: number | null
          used_count?: number
        }
        Update: {
          active?: boolean
          active_from?: string | null
          active_to?: string | null
          code?: string
          created_at?: string
          deleted_at?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          min_order_amount?: number | null
          tenant_id?: string
          usage_limit?: number | null
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: 'promo_codes_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      promotions: {
        Row: {
          active: boolean
          active_from: string | null
          active_to: string | null
          banner_url: string | null
          branch_ids: string[]
          conditions: Json
          created_at: string
          deleted_at: string | null
          description: string
          discount_type: string
          discount_value: number
          id: string
          tenant_id: string
          title: string
          type: string
        }
        Insert: {
          active?: boolean
          active_from?: string | null
          active_to?: string | null
          banner_url?: string | null
          branch_ids?: string[]
          conditions?: Json
          created_at?: string
          deleted_at?: string | null
          description?: string
          discount_type: string
          discount_value: number
          id?: string
          tenant_id: string
          title: string
          type?: string
        }
        Update: {
          active?: boolean
          active_from?: string | null
          active_to?: string | null
          banner_url?: string | null
          branch_ids?: string[]
          conditions?: Json
          created_at?: string
          deleted_at?: string | null
          description?: string
          discount_type?: string
          discount_value?: number
          id?: string
          tenant_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: 'promotions_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      reservation_settings: {
        Row: {
          allow_client_cancellation: boolean
          auto_confirm: boolean
          close_buffer_minutes: number
          conflict_mode: string
          created_at: string
          default_slot_duration: number
          enabled: boolean
          id: string
          max_advance_days: number
          max_guests: number
          max_guests_auto: boolean
          min_guests: number
          resource_selection_enabled: boolean
          slot_step: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          allow_client_cancellation?: boolean
          auto_confirm?: boolean
          close_buffer_minutes?: number
          conflict_mode?: string
          created_at?: string
          default_slot_duration?: number
          enabled?: boolean
          id?: string
          max_advance_days?: number
          max_guests?: number
          max_guests_auto?: boolean
          min_guests?: number
          resource_selection_enabled?: boolean
          slot_step?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          allow_client_cancellation?: boolean
          auto_confirm?: boolean
          close_buffer_minutes?: number
          conflict_mode?: string
          created_at?: string
          default_slot_duration?: number
          enabled?: boolean
          id?: string
          max_advance_days?: number
          max_guests?: number
          max_guests_auto?: boolean
          min_guests?: number
          resource_selection_enabled?: boolean
          slot_step?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'reservation_settings_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: true
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      reservations: {
        Row: {
          allow_cancel_snapshot: boolean | null
          branch_id: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          comment: string | null
          completed_at: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          customer_id: string | null
          guest_count: number
          guest_email: string | null
          guest_name: string
          guest_phone: string
          guest_token: string | null
          id: string
          idempotency_key: string | null
          order_id: string | null
          reserved_date: string
          reserved_time: string
          seated_at: string | null
          status: Database['public']['Enums']['reservation_status']
          table_id: string | null
          table_name: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          allow_cancel_snapshot?: boolean | null
          branch_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          comment?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          customer_id?: string | null
          guest_count: number
          guest_email?: string | null
          guest_name: string
          guest_phone: string
          guest_token?: string | null
          id?: string
          idempotency_key?: string | null
          order_id?: string | null
          reserved_date: string
          reserved_time: string
          seated_at?: string | null
          status?: Database['public']['Enums']['reservation_status']
          table_id?: string | null
          table_name?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          allow_cancel_snapshot?: boolean | null
          branch_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          comment?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          customer_id?: string | null
          guest_count?: number
          guest_email?: string | null
          guest_name?: string
          guest_phone?: string
          guest_token?: string | null
          id?: string
          idempotency_key?: string | null
          order_id?: string | null
          reserved_date?: string
          reserved_time?: string
          seated_at?: string | null
          status?: Database['public']['Enums']['reservation_status']
          table_id?: string | null
          table_name?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'reservations_branch_id_fkey'
            columns: ['branch_id']
            isOneToOne: false
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reservations_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reservations_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reservations_table_id_fkey'
            columns: ['table_id']
            isOneToOne: false
            referencedRelation: 'tables'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reservations_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      resource_branches: {
        Row: {
          branch_id: string
          resource_id: string
        }
        Insert: {
          branch_id: string
          resource_id: string
        }
        Update: {
          branch_id?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'resource_branches_branch_id_fkey'
            columns: ['branch_id']
            isOneToOne: false
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'resource_branches_resource_id_fkey'
            columns: ['resource_id']
            isOneToOne: false
            referencedRelation: 'resources'
            referencedColumns: ['id']
          },
        ]
      }
      resource_categories: {
        Row: {
          category_id: string
          resource_id: string
        }
        Insert: {
          category_id: string
          resource_id: string
        }
        Update: {
          category_id?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'resource_categories_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'resource_categories_resource_id_fkey'
            columns: ['resource_id']
            isOneToOne: false
            referencedRelation: 'resources'
            referencedColumns: ['id']
          },
        ]
      }
      resource_date_disabled_slots: {
        Row: {
          date: string
          id: string
          resource_id: string
          slot_time: string
        }
        Insert: {
          date: string
          id?: string
          resource_id: string
          slot_time: string
        }
        Update: {
          date?: string
          id?: string
          resource_id?: string
          slot_time?: string
        }
        Relationships: [
          {
            foreignKeyName: 'resource_date_disabled_slots_resource_id_fkey'
            columns: ['resource_id']
            isOneToOne: false
            referencedRelation: 'resources'
            referencedColumns: ['id']
          },
        ]
      }
      resource_date_overrides: {
        Row: {
          close_time: string | null
          date: string
          id: string
          is_working: boolean
          open_time: string | null
          resource_id: string
        }
        Insert: {
          close_time?: string | null
          date: string
          id?: string
          is_working?: boolean
          open_time?: string | null
          resource_id: string
        }
        Update: {
          close_time?: string | null
          date?: string
          id?: string
          is_working?: boolean
          open_time?: string | null
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'resource_date_overrides_resource_id_fkey'
            columns: ['resource_id']
            isOneToOne: false
            referencedRelation: 'resources'
            referencedColumns: ['id']
          },
        ]
      }
      resource_disabled_slots: {
        Row: {
          day_of_week: number
          id: string
          resource_id: string
          slot_time: string
        }
        Insert: {
          day_of_week: number
          id?: string
          resource_id: string
          slot_time: string
        }
        Update: {
          day_of_week?: number
          id?: string
          resource_id?: string
          slot_time?: string
        }
        Relationships: [
          {
            foreignKeyName: 'resource_disabled_slots_resource_id_fkey'
            columns: ['resource_id']
            isOneToOne: false
            referencedRelation: 'resources'
            referencedColumns: ['id']
          },
        ]
      }
      resource_schedules: {
        Row: {
          close_time: string | null
          day_of_week: number
          id: string
          is_working: boolean
          open_time: string | null
          resource_id: string
        }
        Insert: {
          close_time?: string | null
          day_of_week: number
          id?: string
          is_working?: boolean
          open_time?: string | null
          resource_id: string
        }
        Update: {
          close_time?: string | null
          day_of_week?: number
          id?: string
          is_working?: boolean
          open_time?: string | null
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'resource_schedules_resource_id_fkey'
            columns: ['resource_id']
            isOneToOne: false
            referencedRelation: 'resources'
            referencedColumns: ['id']
          },
        ]
      }
      resource_unavailability: {
        Row: {
          created_at: string
          date_from: string
          date_to: string
          id: string
          notes: string | null
          reason: string
          resource_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_from: string
          date_to: string
          id?: string
          notes?: string | null
          reason: string
          resource_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_from?: string
          date_to?: string
          id?: string
          notes?: string | null
          reason?: string
          resource_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'resource_unavailability_resource_id_fkey'
            columns: ['resource_id']
            isOneToOne: false
            referencedRelation: 'resources'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'resource_unavailability_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      resources: {
        Row: {
          applied_template_id: string | null
          capacity: number
          created_at: string
          cycle_start_date: string | null
          id: string
          is_active: boolean
          member_id: string | null
          name: string
          sort_order: number
          tenant_id: string
          type: Database['public']['Enums']['resource_type']
          updated_at: string
        }
        Insert: {
          applied_template_id?: string | null
          capacity?: number
          created_at?: string
          cycle_start_date?: string | null
          id?: string
          is_active?: boolean
          member_id?: string | null
          name: string
          sort_order?: number
          tenant_id: string
          type?: Database['public']['Enums']['resource_type']
          updated_at?: string
        }
        Update: {
          applied_template_id?: string | null
          capacity?: number
          created_at?: string
          cycle_start_date?: string | null
          id?: string
          is_active?: boolean
          member_id?: string | null
          name?: string
          sort_order?: number
          tenant_id?: string
          type?: Database['public']['Enums']['resource_type']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'resources_applied_template_id_fkey'
            columns: ['applied_template_id']
            isOneToOne: false
            referencedRelation: 'schedule_templates'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'resources_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'tenant_members'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'resources_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      schedule_template_days: {
        Row: {
          close_time: string | null
          day_index: number
          is_working: boolean
          open_time: string | null
          template_id: string
        }
        Insert: {
          close_time?: string | null
          day_index: number
          is_working?: boolean
          open_time?: string | null
          template_id: string
        }
        Update: {
          close_time?: string | null
          day_index?: number
          is_working?: boolean
          open_time?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'schedule_template_days_template_id_fkey'
            columns: ['template_id']
            isOneToOne: false
            referencedRelation: 'schedule_templates'
            referencedColumns: ['id']
          },
        ]
      }
      schedule_templates: {
        Row: {
          created_at: string
          cycle_length: number | null
          id: string
          name: string
          reference_branch_id: string | null
          sort_order: number
          tenant_id: string
          type: Database['public']['Enums']['schedule_template_type']
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle_length?: number | null
          id?: string
          name: string
          reference_branch_id?: string | null
          sort_order?: number
          tenant_id: string
          type: Database['public']['Enums']['schedule_template_type']
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle_length?: number | null
          id?: string
          name?: string
          reference_branch_id?: string | null
          sort_order?: number
          tenant_id?: string
          type?: Database['public']['Enums']['schedule_template_type']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'schedule_templates_reference_branch_id_fkey'
            columns: ['reference_branch_id']
            isOneToOne: false
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'schedule_templates_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      service_branches: {
        Row: {
          branch_id: string
          service_id: string
        }
        Insert: {
          branch_id: string
          service_id: string
        }
        Update: {
          branch_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'service_branches_branch_id_fkey'
            columns: ['branch_id']
            isOneToOne: false
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'service_branches_service_id_fkey'
            columns: ['service_id']
            isOneToOne: false
            referencedRelation: 'services'
            referencedColumns: ['id']
          },
        ]
      }
      service_resources: {
        Row: {
          resource_id: string
          service_id: string
        }
        Insert: {
          resource_id: string
          service_id: string
        }
        Update: {
          resource_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'service_resources_resource_id_fkey'
            columns: ['resource_id']
            isOneToOne: false
            referencedRelation: 'resources'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'service_resources_service_id_fkey'
            columns: ['service_id']
            isOneToOne: false
            referencedRelation: 'services'
            referencedColumns: ['id']
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          allow_resource_choice: boolean
          booking_mode: string
          category_id: string | null
          created_at: string
          description: string
          duration: number
          id: string
          is_bookable: boolean
          long_description: string | null
          max_duration: number | null
          name: string
          photos: string[]
          price: number
          sort_order: number
          tags: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          allow_resource_choice?: boolean
          booking_mode?: string
          category_id?: string | null
          created_at?: string
          description?: string
          duration: number
          id?: string
          is_bookable?: boolean
          long_description?: string | null
          max_duration?: number | null
          name: string
          photos?: string[]
          price?: number
          sort_order?: number
          tags?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          allow_resource_choice?: boolean
          booking_mode?: string
          category_id?: string | null
          created_at?: string
          description?: string
          duration?: number
          id?: string
          is_bookable?: boolean
          long_description?: string | null
          max_duration?: number | null
          name?: string
          photos?: string[]
          price?: number
          sort_order?: number
          tags?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'services_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'services_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      support_messages: {
        Row: {
          body: string
          created_at: string | null
          id: string
          image_urls: string[] | null
          sender_id: string
          sender_type: string
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          image_urls?: string[] | null
          sender_id: string
          sender_type: string
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          image_urls?: string[] | null
          sender_id?: string
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'support_messages_ticket_id_fkey'
            columns: ['ticket_id']
            isOneToOne: false
            referencedRelation: 'support_tickets'
            referencedColumns: ['id']
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          status: string
          subject: string
          support_last_seen_at: string | null
          tenant_id: string
          tenant_last_seen_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          status?: string
          subject: string
          support_last_seen_at?: string | null
          tenant_id: string
          tenant_last_seen_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          status?: string
          subject?: string
          support_last_seen_at?: string | null
          tenant_id?: string
          tenant_last_seen_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'support_tickets_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      table_call_types: {
        Row: {
          created_at: string | null
          id: string
          name: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          sort_order?: number
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'table_call_types_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      table_calls: {
        Row: {
          call_type_id: string | null
          call_type_name: string
          created_at: string | null
          id: string
          resolved_at: string | null
          table_id: string
          tenant_id: string
        }
        Insert: {
          call_type_id?: string | null
          call_type_name: string
          created_at?: string | null
          id?: string
          resolved_at?: string | null
          table_id: string
          tenant_id: string
        }
        Update: {
          call_type_id?: string | null
          call_type_name?: string
          created_at?: string | null
          id?: string
          resolved_at?: string | null
          table_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'table_calls_call_type_id_fkey'
            columns: ['call_type_id']
            isOneToOne: false
            referencedRelation: 'table_call_types'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'table_calls_table_id_fkey'
            columns: ['table_id']
            isOneToOne: false
            referencedRelation: 'tables'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'table_calls_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      tables: {
        Row: {
          branch_id: string
          capacity: number | null
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          is_open: boolean
          name: string
          notes: string | null
          opened_at: string | null
          position_x: number | null
          position_y: number | null
          rotation: number
          shape: string
          table_height: number
          table_width: number
          tags: string[]
          tenant_id: string
        }
        Insert: {
          branch_id: string
          capacity?: number | null
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_open?: boolean
          name: string
          notes?: string | null
          opened_at?: string | null
          position_x?: number | null
          position_y?: number | null
          rotation?: number
          shape?: string
          table_height?: number
          table_width?: number
          tags?: string[]
          tenant_id: string
        }
        Update: {
          branch_id?: string
          capacity?: number | null
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_open?: boolean
          name?: string
          notes?: string | null
          opened_at?: string | null
          position_x?: number | null
          position_y?: number | null
          rotation?: number
          shape?: string
          table_height?: number
          table_width?: number
          tags?: string[]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tables_branch_id_fkey'
            columns: ['branch_id']
            isOneToOne: false
            referencedRelation: 'branches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tables_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      telegram_link_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          tenant_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          tenant_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'telegram_link_codes_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: true
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      tenant_invitations: {
        Row: {
          accepted_at: string | null
          branch_ids: string[]
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role_id: string | null
          tenant_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          branch_ids?: string[]
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role_id?: string | null
          tenant_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          branch_ids?: string[]
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role_id?: string | null
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tenant_invitations_role_id_fkey'
            columns: ['role_id']
            isOneToOne: false
            referencedRelation: 'tenant_roles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tenant_invitations_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      tenant_members: {
        Row: {
          blocked_until: string | null
          branch_ids: string[]
          created_at: string
          id: string
          role_id: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          blocked_until?: string | null
          branch_ids?: string[]
          created_at?: string
          id?: string
          role_id?: string | null
          tenant_id: string
          user_id: string
        }
        Update: {
          blocked_until?: string | null
          branch_ids?: string[]
          created_at?: string
          id?: string
          role_id?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tenant_members_role_id_fkey'
            columns: ['role_id']
            isOneToOne: false
            referencedRelation: 'tenant_roles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tenant_members_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      tenant_roles: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          permissions: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          permissions?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          permissions?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tenant_roles_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      tenant_telegram_subscribers: {
        Row: {
          added_at: string
          chat_id: string
          chat_type: string
          id: string
          label: string | null
          tenant_id: string
          thread_id: number | null
        }
        Insert: {
          added_at?: string
          chat_id: string
          chat_type: string
          id?: string
          label?: string | null
          tenant_id: string
          thread_id?: number | null
        }
        Update: {
          added_at?: string
          chat_id?: string
          chat_type?: string
          id?: string
          label?: string | null
          tenant_id?: string
          thread_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'tenant_telegram_subscribers_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
        ]
      }
      tenants: {
        Row: {
          balance: number
          branch_selection_mode: string
          business_type: string | null
          contacts: Json
          created_at: string
          currency: string
          custom_domain: string | null
          delivery_description: string
          delivery_fee: number
          delivery_min_order: number
          delivery_mode: string
          free_delivery_from: number
          id: string
          kitchen_config: Json
          kitchen_urgency_minutes: number
          legal_info: Json | null
          max_addons_default: number | null
          menu_style: string
          modules: Json
          name: string
          notifications: Json
          onboarding_completed: boolean
          onboarding_state: Json
          order_number_config: Json | null
          order_scheduling_config: Json
          owner_id: string | null
          payment_methods: string[]
          self_registered: boolean
          seo: Json
          site_content: Json
          site_layout: Json
          slug: string
          subscription: Json
          theme: Json
          timezone: string
          updated_at: string
          working_hours_schedule: Json | null
        }
        Insert: {
          balance?: number
          branch_selection_mode?: string
          business_type?: string | null
          contacts?: Json
          created_at?: string
          currency?: string
          custom_domain?: string | null
          delivery_description?: string
          delivery_fee?: number
          delivery_min_order?: number
          delivery_mode?: string
          free_delivery_from?: number
          id?: string
          kitchen_config?: Json
          kitchen_urgency_minutes?: number
          legal_info?: Json | null
          max_addons_default?: number | null
          menu_style?: string
          modules?: Json
          name: string
          notifications?: Json
          onboarding_completed?: boolean
          onboarding_state?: Json
          order_number_config?: Json | null
          order_scheduling_config?: Json
          owner_id?: string | null
          payment_methods?: string[]
          self_registered?: boolean
          seo?: Json
          site_content?: Json
          site_layout?: Json
          slug: string
          subscription?: Json
          theme?: Json
          timezone?: string
          updated_at?: string
          working_hours_schedule?: Json | null
        }
        Update: {
          balance?: number
          branch_selection_mode?: string
          business_type?: string | null
          contacts?: Json
          created_at?: string
          currency?: string
          custom_domain?: string | null
          delivery_description?: string
          delivery_fee?: number
          delivery_min_order?: number
          delivery_mode?: string
          free_delivery_from?: number
          id?: string
          kitchen_config?: Json
          kitchen_urgency_minutes?: number
          legal_info?: Json | null
          max_addons_default?: number | null
          menu_style?: string
          modules?: Json
          name?: string
          notifications?: Json
          onboarding_completed?: boolean
          onboarding_state?: Json
          order_number_config?: Json | null
          order_scheduling_config?: Json
          owner_id?: string | null
          payment_methods?: string[]
          self_registered?: boolean
          seo?: Json
          site_content?: Json
          site_layout?: Json
          slug?: string
          subscription?: Json
          theme?: Json
          timezone?: string
          updated_at?: string
          working_hours_schedule?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _kitchen_queue_insert_item: {
        Args: {
          p_delivery_type: string
          p_item: Record<string, unknown>
          p_order_id: string
          p_tenant_id: string
        }
        Returns: undefined
      }
      accept_invitation_atomic: {
        Args: { _token: string; _user_email: string; _user_id: string }
        Returns: {
          role_id: string
          tenant_id: string
        }[]
      }
      add_service_to_visit: {
        Args: {
          p_ends_at: string
          p_resource_assigned_by?: string
          p_resource_id: string
          p_service_id: string
          p_service_name: string
          p_service_price: number
          p_starts_at: string
          p_status?: Database['public']['Enums']['appointment_status']
          p_visit_id: string
        }
        Returns: Json
      }
      apply_shift_template_to_resource: {
        Args: {
          p_cycle_start_date: string
          p_resource_id: string
          p_template_id: string
        }
        Returns: undefined
      }
      apply_table_discount: {
        Args: {
          p_cancelled_status_ids: string[]
          p_discount_amount: number
          p_opened_at: string
          p_table_id: string
        }
        Returns: undefined
      }
      apply_weekly_template_to_resource: {
        Args: { p_resource_id: string; p_template_id: string }
        Returns: undefined
      }
      assert_uuids_in_tenant: {
        Args: { p_table: unknown; p_tenant_id: string; p_uuids: string[] }
        Returns: undefined
      }
      auto_close_stale_support_tickets: { Args: never; Returns: undefined }
      billing_change_plan: {
        Args: {
          p_new_plan_key: string
          p_tenant_id: string
          p_user_id?: string
        }
        Returns: string
      }
      billing_charge_subscription: {
        Args: { p_tenant_id: string }
        Returns: string
      }
      billing_set_price_override: {
        Args: { p_price?: number; p_tenant_id: string }
        Returns: undefined
      }
      billing_topup: {
        Args: {
          p_admin_user_id?: string
          p_amount: number
          p_description?: string
          p_tenant_id: string
        }
        Returns: Json
      }
      cancel_appointment_by_customer: {
        Args: { p_appointment_id: string; p_customer_id: string }
        Returns: Json
      }
      check_promo_code:
        | { Args: { p_code: string; p_tenant_id: string }; Returns: Json }
        | {
          Args: {
            p_code: string
            p_delivery_time?: string
            p_subtotal?: number
            p_tenant_id: string
          }
          Returns: Json
        }
      check_promotion_by_id: {
        Args: {
          p_delivery_time?: string
          p_promotion_id: string
          p_subtotal?: number
          p_tenant_id: string
        }
        Returns: Json
      }
      check_resource_unavailability: {
        Args: {
          p_resource_id: string
          p_starts_at: string
          p_tenant_id: string
        }
        Returns: undefined
      }
      cleanup_auth_rate_limits: { Args: never; Returns: undefined }
      combos_set_branch_ids: {
        Args: { p_branch_ids: string[]; p_combo_id: string }
        Returns: undefined
      }
      compute_business_date: {
        Args: { p_branch_id: string; p_starts_at: string; p_tenant_id: string }
        Returns: string
      }
      consume_rate_limit: {
        Args: { _key: string; _max: number; _window_seconds: number }
        Returns: boolean
      }
      convert_visit_request: {
        Args: { p_items: Json; p_user_id: string; p_visit_id: string }
        Returns: Json
      }
      count_pending_visits: { Args: { p_tenant_id: string }; Returns: number }
      create_appointment: {
        Args: {
          p_allow_cancel_snapshot: boolean
          p_allow_reschedule_snapshot: boolean
          p_branch_id: string
          p_customer_email?: string
          p_customer_id: string
          p_customer_name: string
          p_customer_phone: string
          p_ends_at: string
          p_notes: string
          p_resource_assigned_by?: string
          p_resource_id: string
          p_service_id: string
          p_service_name?: string
          p_service_price?: number
          p_source?: string
          p_starts_at: string
          p_status: Database['public']['Enums']['appointment_status']
          p_tenant_id: string
          p_user_id: string
        }
        Returns: {
          ends_at: string
          id: string
          starts_at: string
          status: Database['public']['Enums']['appointment_status']
        }[]
      }
      create_appointments_bulk: {
        Args: {
          p_allow_cancel_snapshot: boolean
          p_allow_reschedule_snapshot: boolean
          p_branch_id: string
          p_customer_email: string
          p_customer_id: string
          p_customer_name: string
          p_customer_phone: string
          p_items: Json
          p_notes: string
          p_source: string
          p_status: Database['public']['Enums']['appointment_status']
          p_tenant_id: string
          p_user_id: string
        }
        Returns: Json
      }
      create_order_with_items_atomic: {
        Args: {
          p_free_item_json: Json
          p_items_json: Json
          p_order_payload: Json
          p_promo_code?: string
        }
        Returns: Json
      }
      create_visit_request: {
        Args: {
          p_branch_id: string
          p_customer_email: string
          p_customer_id: string
          p_customer_name: string
          p_customer_phone: string
          p_notes: string
          p_requested_services: Json
          p_tenant_id: string
        }
        Returns: Json
      }
      delete_order_item_atomic: {
        Args: { p_order_item_id: string }
        Returns: Json
      }
      dishes_set_branch_ids: {
        Args: { p_branch_ids: string[]; p_dish_id: string }
        Returns: undefined
      }
      ensure_scheduled_holding_status: {
        Args: { p_tenant_id: string }
        Returns: string
      }
      extend_appointment: {
        Args: { p_id: string; p_minutes: number }
        Returns: {
          actual_ends_at: string | null
          allow_cancel_snapshot: boolean | null
          allow_reschedule_snapshot: boolean | null
          booking_mode: string | null
          branch_id: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_phone: string
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          ends_at: string
          group_id: string
          id: string
          notes: string | null
          resource_assigned_by: string | null
          resource_id: string | null
          service_id: string | null
          service_name: string
          service_price: number
          starts_at: string
          status: Database['public']['Enums']['appointment_status']
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'appointments'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_order_number: {
        Args: { p_branch_id?: string; p_config: Json; p_tenant_id: string }
        Returns: string
      }
      get_best_promotion: {
        Args: {
          p_delivery_time?: string
          p_subtotal: number
          p_tenant_id: string
        }
        Returns: Json
      }
      get_free_item_promotion: {
        Args: {
          p_delivery_time?: string
          p_subtotal: number
          p_tenant_id: string
        }
        Returns: Json
      }
      get_invite_status: {
        Args: { _email: string; _tenant_id: string }
        Returns: string
      }
      get_tenant_unread_support_count: {
        Args: { p_tenant_id: string }
        Returns: number
      }
      get_user_emails: {
        Args: { user_ids: string[] }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_user_emails_admin: {
        Args: { user_ids: string[] }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_user_id_by_email: { Args: { p_email: string }; Returns: string }
      get_user_profiles: {
        Args: { user_ids: string[] }
        Returns: {
          email: string
          full_name: string
          user_id: string
        }[]
      }
      get_user_profiles_for_tenant: {
        Args: { p_tenant_id: string; user_ids: string[] }
        Returns: {
          email: string
          full_name: string
          user_id: string
        }[]
      }
      has_permission: {
        Args: { _permission: string; _tenant_id: string }
        Returns: boolean
      }
      is_resource_tenant_member: {
        Args: { p_resource_id: string }
        Returns: boolean
      }
      is_template_tenant_member: {
        Args: { p_template_id: string }
        Returns: boolean
      }
      is_tenant_member: { Args: { _tenant_id: string }; Returns: boolean }
      is_tenant_owner: { Args: { _tenant_id: string }; Returns: boolean }
      kitchen_queue_populate: {
        Args: {
          p_delivery_type: string
          p_order_id: string
          p_tenant_id: string
        }
        Returns: undefined
      }
      monitor_edge_errors: { Args: never; Returns: undefined }
      move_appointment: {
        Args: {
          p_appt_id: string
          p_ends_at: string
          p_resource_assigned_by?: string
          p_resource_id?: string
          p_service_id?: string
          p_starts_at: string
        }
        Returns: Json
      }
      move_visit_to_date: {
        Args: { p_new_date: string; p_user_id?: string; p_visit_id: string }
        Returns: Json
      }
      record_visit_event: {
        Args: {
          p_actor_id: string
          p_event_type: string
          p_payload: Json
          p_visit_id: string
        }
        Returns: undefined
      }
      release_rate_limit: { Args: { _key: string }; Returns: undefined }
      reorder_categories: { Args: { items: Json }; Returns: undefined }
      reorder_dishes: { Args: { items: Json }; Returns: undefined }
      resources_set_branch_ids: {
        Args: { p_branch_ids: string[]; p_resource_id: string }
        Returns: undefined
      }
      resources_set_category_ids: {
        Args: { p_category_ids: string[]; p_resource_id: string }
        Returns: undefined
      }
      resources_set_service_ids: {
        Args: { p_resource_id: string; p_service_ids: string[] }
        Returns: undefined
      }
      schedule_templates_update: {
        Args: {
          p_cycle_length: number
          p_days: Json
          p_id: string
          p_name: string
          p_reference_branch_id: string
          p_type: string
        }
        Returns: undefined
      }
      self_register_tenant:
        | {
          Args: {
            p_email: string
            p_name: string
            p_owner_id: string
            p_slug: string
            p_trial_days: number
          }
          Returns: string
        }
        | {
          Args: {
            p_email: string
            p_initial_plan?: string
            p_name: string
            p_owner_id: string
            p_slug: string
            p_trial_days: number
          }
          Returns: string
        }
      services_set_branch_ids: {
        Args: { p_branch_ids: string[]; p_service_id: string }
        Returns: undefined
      }
      split_visit_to_request: {
        Args: {
          p_appointment_ids: string[]
          p_user_id: string
          p_visit_id: string
        }
        Returns: Json
      }
      try_advisory_xact_lock: { Args: { p_key: number }; Returns: boolean }
      update_appointment: {
        Args: {
          p_ends_at: string
          p_id: string
          p_resource_assigned_by?: string
          p_resource_id: string
          p_service_id?: string
          p_service_name?: string
          p_service_price?: number
          p_starts_at: string
        }
        Returns: Json
      }
      update_order_status: {
        Args: { p_new_status: string; p_order_id: string }
        Returns: undefined
      }
      update_order_with_items: {
        Args: { p_items_json: Json; p_order_id: string; p_order_patch: Json }
        Returns: undefined
      }
    }
    Enums: {
      appointment_resource_mode: 'staff' | 'objects' | 'both'
      appointment_status: 'new' | 'confirmed' | 'cancelled' | 'done'
      reservation_status:
        | 'pending'
        | 'confirmed'
        | 'seated'
        | 'completed'
        | 'cancelled'
        | 'no_show'
      resource_type: 'person' | 'object'
      schedule_template_type: 'weekly' | 'shift'
      staff_name_format: 'first_name' | 'first_name_last_initial' | 'full_name'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
  | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
      & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
      ? R
      : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables']
    & DefaultSchema['Views'])
    ? (DefaultSchema['Tables']
      & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
        ? R
        : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema['Tables']
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
    Insert: infer I
  }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema['Tables']
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
    Update: infer U
  }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
  | keyof DefaultSchema['Enums']
  | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof DefaultSchema['CompositeTypes']
  | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      appointment_resource_mode: ['staff', 'objects', 'both'],
      appointment_status: ['new', 'confirmed', 'cancelled', 'done'],
      reservation_status: [
        'pending',
        'confirmed',
        'seated',
        'completed',
        'cancelled',
        'no_show',
      ],
      resource_type: ['person', 'object'],
      schedule_template_type: ['weekly', 'shift'],
      staff_name_format: ['first_name', 'first_name_last_initial', 'full_name'],
    },
  },
} as const

