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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_backup_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: number
          used_at: string | null
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: never
          used_at?: string | null
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: never
          used_at?: string | null
        }
        Relationships: []
      }
      admin_login_attempts: {
        Row: {
          created_at: string
          id: number
          ip: string
          reason: string
          success: boolean
        }
        Insert: {
          created_at?: string
          id?: never
          ip: string
          reason: string
          success: boolean
        }
        Update: {
          created_at?: string
          id?: never
          ip?: string
          reason?: string
          success?: boolean
        }
        Relationships: []
      }
      admin_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: number
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: never
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: never
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          cod_disabled: boolean
          created_at: string
          default_page_size: number | null
          discount_percent: number | null
          gst_rate: number
          id: number
          name: string
          show_on_home: boolean
          whatsapp_number: string | null
        }
        Insert: {
          cod_disabled?: boolean
          created_at?: string
          default_page_size?: number | null
          discount_percent?: number | null
          gst_rate?: number
          id?: never
          name: string
          show_on_home?: boolean
          whatsapp_number?: string | null
        }
        Update: {
          cod_disabled?: boolean
          created_at?: string
          default_page_size?: number | null
          discount_percent?: number | null
          gst_rate?: number
          id?: never
          name?: string
          show_on_home?: boolean
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      chat_button_labels: {
        Row: {
          created_at: string
          id: number
          kind: string
          label: string
        }
        Insert: {
          created_at?: string
          id?: never
          kind: string
          label: string
        }
        Update: {
          created_at?: string
          id?: never
          kind?: string
          label?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: number
          is_public: boolean
          max_uses: number | null
          referral_phone: string | null
          used_count: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: never
          is_public?: boolean
          max_uses?: number | null
          referral_phone?: string | null
          used_count?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: never
          is_public?: boolean
          max_uses?: number | null
          referral_phone?: string | null
          used_count?: number
        }
        Relationships: []
      }
      gift_campaign_claims: {
        Row: {
          campaign_id: number
          checkout_token: string
          created_at: string
          expires_at: string
          id: number
          status: string
        }
        Insert: {
          campaign_id: number
          checkout_token: string
          created_at?: string
          expires_at: string
          id?: number
          status?: string
        }
        Update: {
          campaign_id?: number
          checkout_token?: string
          created_at?: string
          expires_at?: string
          id?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_campaign_claims_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "gift_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_campaigns: {
        Row: {
          created_at: string
          custom_gift_image_url: string | null
          custom_gift_name: string | null
          custom_gift_value: number | null
          enabled: boolean
          ends_at: string
          gift_product_id: number | null
          id: number
          max_redemptions: number
          min_amount: number
          redeemed_count: number
          starts_at: string | null
          title: string
        }
        Insert: {
          created_at?: string
          custom_gift_image_url?: string | null
          custom_gift_name?: string | null
          custom_gift_value?: number | null
          enabled?: boolean
          ends_at: string
          gift_product_id?: number | null
          id?: number
          max_redemptions: number
          min_amount: number
          redeemed_count?: number
          starts_at?: string | null
          title: string
        }
        Update: {
          created_at?: string
          custom_gift_image_url?: string | null
          custom_gift_name?: string | null
          custom_gift_value?: number | null
          enabled?: boolean
          ends_at?: string
          gift_product_id?: number | null
          id?: number
          max_redemptions?: number
          min_amount?: number
          redeemed_count?: number
          starts_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_campaigns_gift_product_id_fkey"
            columns: ["gift_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      labels: {
        Row: {
          created_at: string
          id: number
          name: string
          photo_filter: string | null
        }
        Insert: {
          created_at?: string
          id?: never
          name: string
          photo_filter?: string | null
        }
        Update: {
          created_at?: string
          id?: never
          name?: string
          photo_filter?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          contacted: boolean
          contacted_at: string | null
          created_at: string
          details: Json | null
          email: string | null
          id: number
          name: string
          phone: string | null
          source: string
        }
        Insert: {
          contacted?: boolean
          contacted_at?: string | null
          created_at?: string
          details?: Json | null
          email?: string | null
          id?: never
          name: string
          phone?: string | null
          source: string
        }
        Update: {
          contacted?: boolean
          contacted_at?: string | null
          created_at?: string
          details?: Json | null
          email?: string | null
          id?: never
          name?: string
          phone?: string | null
          source?: string
        }
        Relationships: []
      }
      order_notification_log: {
        Row: {
          email: string | null
          id: number
          order_id: number
          sent_at: string
          status: string
          whatsapp: string | null
        }
        Insert: {
          email?: string | null
          id?: never
          order_id: number
          sent_at?: string
          status: string
          whatsapp?: string | null
        }
        Update: {
          email?: string | null
          id?: never
          order_id?: number
          sent_at?: string
          status?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_notification_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notification_numbers: {
        Row: {
          created_at: string
          id: number
          label: string | null
          phone_number: string
        }
        Insert: {
          created_at?: string
          id?: never
          label?: string | null
          phone_number: string
        }
        Update: {
          created_at?: string
          id?: never
          label?: string | null
          phone_number?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount: number | null
          awb_number: string | null
          checkout_token: string | null
          cod_collected_at: string | null
          cod_fee: number | null
          courier_name: string | null
          created_at: string
          customer_details: Json | null
          id: number
          items: Json | null
          order_id: string | null
          payment_id: string | null
          payment_method: string
          shipping_address: Json | null
          status: string
        }
        Insert: {
          amount?: number | null
          awb_number?: string | null
          checkout_token?: string | null
          cod_collected_at?: string | null
          cod_fee?: number | null
          courier_name?: string | null
          created_at?: string
          customer_details?: Json | null
          id?: number
          items?: Json | null
          order_id?: string | null
          payment_id?: string | null
          payment_method?: string
          shipping_address?: Json | null
          status?: string
        }
        Update: {
          amount?: number | null
          awb_number?: string | null
          checkout_token?: string | null
          cod_collected_at?: string | null
          cod_fee?: number | null
          courier_name?: string | null
          created_at?: string
          customer_details?: Json | null
          id?: number
          items?: Json | null
          order_id?: string | null
          payment_id?: string | null
          payment_method?: string
          shipping_address?: Json | null
          status?: string
        }
        Relationships: []
      }
      orders_cancelled_archive: {
        Row: {
          amount: number | null
          awb_number: string | null
          created_at: string
          customer_details: Json | null
          id: number
          items: Json | null
          order_id: string | null
          payment_id: string | null
          shipping_address: Json | null
          status: string
        }
        Insert: {
          amount?: number | null
          awb_number?: string | null
          created_at?: string
          customer_details?: Json | null
          id?: number
          items?: Json | null
          order_id?: string | null
          payment_id?: string | null
          shipping_address?: Json | null
          status?: string
        }
        Update: {
          amount?: number | null
          awb_number?: string | null
          created_at?: string
          customer_details?: Json | null
          id?: number
          items?: Json | null
          order_id?: string | null
          payment_id?: string | null
          shipping_address?: Json | null
          status?: string
        }
        Relationships: []
      }
      product_colors: {
        Row: {
          created_at: string
          id: number
          name: string
        }
        Insert: {
          created_at?: string
          id?: never
          name: string
        }
        Update: {
          created_at?: string
          id?: never
          name?: string
        }
        Relationships: []
      }
      product_materials: {
        Row: {
          created_at: string
          id: number
          name: string
        }
        Insert: {
          created_at?: string
          id?: never
          name: string
        }
        Update: {
          created_at?: string
          id?: never
          name?: string
        }
        Relationships: []
      }
      product_sales: {
        Row: {
          product_id: number
          units_sold: number
          updated_at: string
        }
        Insert: {
          product_id: number
          units_sold?: number
          updated_at?: string
        }
        Update: {
          product_id?: number
          units_sold?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_ugc: {
        Row: {
          approved: boolean | null
          caption: string | null
          content_type: string
          content_url: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          featured: boolean | null
          id: number
          moderated_at: string | null
          moderation_notes: string | null
          product_id: number
          used_at: string | null
          used_in_marketing: boolean | null
        }
        Insert: {
          approved?: boolean | null
          caption?: string | null
          content_type: string
          content_url?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          featured?: boolean | null
          id?: never
          moderated_at?: string | null
          moderation_notes?: string | null
          product_id: number
          used_at?: string | null
          used_in_marketing?: boolean | null
        }
        Update: {
          approved?: boolean | null
          caption?: string | null
          content_type?: string
          content_url?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          featured?: boolean | null
          id?: never
          moderated_at?: string | null
          moderation_notes?: string | null
          product_id?: number
          used_at?: string | null
          used_in_marketing?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "product_ugc_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_views: {
        Row: {
          id: number
          product_id: number
          viewed_at: string
          visitor_token: string
        }
        Insert: {
          id?: never
          product_id: number
          viewed_at?: string
          visitor_token: string
        }
        Update: {
          id?: never
          product_id?: number
          viewed_at?: string
          visitor_token?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          breadth_cm: number | null
          category: string | null
          cod_disabled: boolean
          color: string | null
          cost_price: number | null
          cost_price_per_kg: number | null
          created_at: string
          depth_cm: number | null
          description: string | null
          display_order: number | null
          enquire_only: boolean
          enquiry_notify_numbers: string[] | null
          height_cm: number | null
          hidden: boolean
          id: number
          image_url: string | null
          images: string[] | null
          inventory: number | null
          is_spotlight: boolean
          label: string | null
          last_restocked_at: string | null
          material: string | null
          name: string | null
          photo_filter: string | null
          price: number | null
          price_per_kg: number | null
          spotlight_order: number | null
          supplier_numbers: string[] | null
          weight_g: number | null
          whatsapp_number: string | null
        }
        Insert: {
          breadth_cm?: number | null
          category?: string | null
          cod_disabled?: boolean
          color?: string | null
          cost_price?: number | null
          cost_price_per_kg?: number | null
          created_at?: string
          depth_cm?: number | null
          description?: string | null
          display_order?: number | null
          enquire_only?: boolean
          enquiry_notify_numbers?: string[] | null
          height_cm?: number | null
          hidden?: boolean
          id?: number
          image_url?: string | null
          images?: string[] | null
          inventory?: number | null
          is_spotlight?: boolean
          label?: string | null
          last_restocked_at?: string | null
          material?: string | null
          name?: string | null
          photo_filter?: string | null
          price?: number | null
          price_per_kg?: number | null
          spotlight_order?: number | null
          supplier_numbers?: string[] | null
          weight_g?: number | null
          whatsapp_number?: string | null
        }
        Update: {
          breadth_cm?: number | null
          category?: string | null
          cod_disabled?: boolean
          color?: string | null
          cost_price?: number | null
          cost_price_per_kg?: number | null
          created_at?: string
          depth_cm?: number | null
          description?: string | null
          display_order?: number | null
          enquire_only?: boolean
          enquiry_notify_numbers?: string[] | null
          height_cm?: number | null
          hidden?: boolean
          id?: number
          image_url?: string | null
          images?: string[] | null
          inventory?: number | null
          is_spotlight?: boolean
          label?: string | null
          last_restocked_at?: string | null
          material?: string | null
          name?: string | null
          photo_filter?: string | null
          price?: number | null
          price_per_kg?: number | null
          spotlight_order?: number | null
          supplier_numbers?: string[] | null
          weight_g?: number | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      rate_limit_events: {
        Row: {
          bucket: string
          created_at: string
          id: number
          ip: string
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: never
          ip: string
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: never
          ip?: string
        }
        Relationships: []
      }
      review_reminders_sent: {
        Row: {
          id: number
          order_id: number
          sent_at: string
        }
        Insert: {
          id?: never
          order_id: number
          sent_at?: string
        }
        Update: {
          id?: never
          order_id?: number
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_reminders_sent_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          approved: boolean
          created_at: string
          customer_name: string
          id: number
          product_id: number
          rating: number
          review_text: string | null
        }
        Insert: {
          approved?: boolean
          created_at?: string
          customer_name: string
          id?: never
          product_id: number
          rating: number
          review_text?: string | null
        }
        Update: {
          approved?: boolean
          created_at?: string
          customer_name?: string
          id?: never
          product_id?: number
          rating?: number
          review_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      stock_alert_subscriptions: {
        Row: {
          channels: string[] | null
          created_at: string
          email: string | null
          id: number
          notified_at: string | null
          phone: string
          product_id: number
        }
        Insert: {
          channels?: string[] | null
          created_at?: string
          email?: string | null
          id?: never
          notified_at?: string | null
          phone: string
          product_id: number
        }
        Update: {
          channels?: string[] | null
          created_at?: string
          email?: string | null
          id?: never
          notified_at?: string | null
          phone?: string
          product_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_alert_subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_reservations: {
        Row: {
          checkout_token: string
          created_at: string
          expires_at: string
          id: number
          product_id: number
          qty: number
          status: string
        }
        Insert: {
          checkout_token: string
          created_at?: string
          expires_at: string
          id?: number
          product_id: number
          qty: number
          status?: string
        }
        Update: {
          checkout_token?: string
          created_at?: string
          expires_at?: string
          id?: number
          product_id?: number
          qty?: number
          status?: string
        }
        Relationships: []
      }
      whatsapp_enquiries: {
        Row: {
          category: string | null
          created_at: string
          enquiry_notified_count: number | null
          id: number
          out_of_stock: boolean
          price: number | null
          product_id: number | null
          product_name: string | null
          source: string
          whatsapp_number: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          enquiry_notified_count?: number | null
          id?: never
          out_of_stock?: boolean
          price?: number | null
          product_id?: number | null
          product_name?: string | null
          source: string
          whatsapp_number?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          enquiry_notified_count?: number | null
          id?: never
          out_of_stock?: boolean
          price?: number | null
          product_id?: number | null
          product_name?: string | null
          source?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      whatsapp_numbers: {
        Row: {
          created_at: string
          id: number
          label: string | null
          phone_number: string
        }
        Insert: {
          created_at?: string
          id?: never
          label?: string | null
          phone_number: string
        }
        Update: {
          created_at?: string
          id?: never
          label?: string | null
          phone_number?: string
        }
        Relationships: []
      }
      whatsapp_otp_verifications: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          expires_at: string
          id: number
          ip: string
          phone: string
          verification_token: string | null
          verified_at: string | null
          verified_expires_at: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          expires_at: string
          id?: never
          ip: string
          phone: string
          verification_token?: string | null
          verified_at?: string | null
          verified_expires_at?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: never
          ip?: string
          phone?: string
          verification_token?: string | null
          verified_at?: string | null
          verified_expires_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_product_sales: {
        Args: { p_items: Json; p_sign: number }
        Returns: undefined
      }
      claim_gift_campaign_slot: {
        Args: { p_campaign_id: number; p_token: string; p_ttl_seconds: number }
        Returns: {
          ok: boolean
        }[]
      }
      consume_gift_campaign_claim: {
        Args: { p_token: string }
        Returns: {
          ok: boolean
        }[]
      }
      consume_reservation: {
        Args: { p_token: string }
        Returns: {
          new_inventory: number
          oversold_by: number
          product_id: number
        }[]
      }
      decrement_inventory: {
        Args: { p_product_id: number; p_qty: number }
        Returns: {
          new_inventory: number
          oversold_by: number
        }[]
      }
      reserve_stock: {
        Args: { p_items: Json; p_token: string; p_ttl_seconds: number }
        Returns: {
          available: number
          ok: boolean
          product_id: number
          product_name: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
