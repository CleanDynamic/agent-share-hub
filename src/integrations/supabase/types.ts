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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ad_impressions: {
        Row: {
          content_id: string
          converted: boolean
          dismissed_at: string | null
          id: string
          shown_at: string
          user_id: string | null
        }
        Insert: {
          content_id: string
          converted?: boolean
          dismissed_at?: string | null
          id?: string
          shown_at?: string
          user_id?: string | null
        }
        Update: {
          content_id?: string
          converted?: boolean
          dismissed_at?: string | null
          id?: string
          shown_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_impressions_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_impressions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_tools_registry: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_official: boolean
          logo_url: string | null
          name: string
          rejected_reason: string | null
          slug: string | null
          status: string
          submitted_by: string | null
          website_url: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_official?: boolean
          logo_url?: string | null
          name: string
          rejected_reason?: string | null
          slug?: string | null
          status?: string
          submitted_by?: string | null
          website_url?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_official?: boolean
          logo_url?: string | null
          name?: string
          rejected_reason?: string | null
          slug?: string | null
          status?: string
          submitted_by?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_tools_registry_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_tools_registry_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      block_variations: {
        Row: {
          block_id: string
          file_name: string | null
          file_url: string | null
          formatting: Json | null
          id: string
          image_description: string | null
          image_url: string | null
          position: number
          text_content: string | null
          variation_label: string
          variation_type: string
        }
        Insert: {
          block_id: string
          file_name?: string | null
          file_url?: string | null
          formatting?: Json | null
          id?: string
          image_description?: string | null
          image_url?: string | null
          position: number
          text_content?: string | null
          variation_label: string
          variation_type: string
        }
        Update: {
          block_id?: string
          file_name?: string | null
          file_url?: string | null
          formatting?: Json | null
          id?: string
          image_description?: string | null
          image_url?: string | null
          position?: number
          text_content?: string | null
          variation_label?: string
          variation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "block_variations_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "content_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "content_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_blocks: {
        Row: {
          block_type: string
          content_id: string
          created_at: string
          file_name: string | null
          file_size_bytes: number | null
          file_url: string | null
          formatting: Json | null
          id: string
          image_description: string | null
          image_url: string | null
          position: number
          text_content: string | null
        }
        Insert: {
          block_type: string
          content_id: string
          created_at?: string
          file_name?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          formatting?: Json | null
          id?: string
          image_description?: string | null
          image_url?: string | null
          position: number
          text_content?: string | null
        }
        Update: {
          block_type?: string
          content_id?: string
          created_at?: string
          file_name?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          formatting?: Json | null
          id?: string
          image_description?: string | null
          image_url?: string | null
          position?: number
          text_content?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_blocks_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_comments: {
        Row: {
          block_id: string | null
          content_id: string
          created_at: string
          id: string
          is_deleted: boolean
          like_count: number
          text: string
          user_id: string
        }
        Insert: {
          block_id?: string | null
          content_id: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          like_count?: number
          text: string
          user_id: string
        }
        Update: {
          block_id?: string | null
          content_id?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          like_count?: number
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_comments_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "content_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_comments_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          ai_tools: string[] | null
          approved_at: string | null
          avg_rating: number
          comment_count: number
          content_type: string
          created_at: string
          creator_id: string
          description: string | null
          difficulty: string
          donation_enabled: boolean
          download_count: number
          file_url: string | null
          id: string
          monetisation_type: string
          price_gbp: number | null
          rating_count: number
          star_rating: number
          status: string
          title: string
          use_cases: string[] | null
          use_instructions: string | null
          view_count: number
          what_to_expect: string | null
        }
        Insert: {
          ai_tools?: string[] | null
          approved_at?: string | null
          avg_rating?: number
          comment_count?: number
          content_type: string
          created_at?: string
          creator_id: string
          description?: string | null
          difficulty: string
          donation_enabled?: boolean
          download_count?: number
          file_url?: string | null
          id?: string
          monetisation_type?: string
          price_gbp?: number | null
          rating_count?: number
          star_rating?: number
          status?: string
          title: string
          use_cases?: string[] | null
          use_instructions?: string | null
          view_count?: number
          what_to_expect?: string | null
        }
        Update: {
          ai_tools?: string[] | null
          approved_at?: string | null
          avg_rating?: number
          comment_count?: number
          content_type?: string
          created_at?: string
          creator_id?: string
          description?: string | null
          difficulty?: string
          donation_enabled?: boolean
          download_count?: number
          file_url?: string | null
          id?: string
          monetisation_type?: string
          price_gbp?: number | null
          rating_count?: number
          star_rating?: number
          status?: string
          title?: string
          use_cases?: string[] | null
          use_instructions?: string | null
          view_count?: number
          what_to_expect?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_items_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_ratings: {
        Row: {
          content_id: string
          created_at: string
          id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          id?: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_ratings_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_views: {
        Row: {
          content_id: string
          id: string
          user_id: string | null
          viewed_at: string
        }
        Insert: {
          content_id: string
          id?: string
          user_id?: string | null
          viewed_at?: string
        }
        Update: {
          content_id?: string
          id?: string
          user_id?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_views_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      downloads: {
        Row: {
          content_id: string
          downloaded_at: string
          id: string
          user_id: string | null
        }
        Insert: {
          content_id: string
          downloaded_at?: string
          id?: string
          user_id?: string | null
        }
        Update: {
          content_id?: string
          downloaded_at?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "downloads_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "downloads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          follower_count: number
          following_count: number
          id: string
          is_admin: boolean
          is_creator: boolean
          joined_at: string
          location: string | null
          notification_preferences: Json
          stripe_account_id: string | null
          subscription_price_id: string | null
          twitter_handle: string | null
          user_ai_tools: string[]
          user_interests: string[]
          username: string | null
          website_url: string | null
        }
        Insert: {
          account_type?: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          follower_count?: number
          following_count?: number
          id: string
          is_admin?: boolean
          is_creator?: boolean
          joined_at?: string
          location?: string | null
          notification_preferences?: Json
          stripe_account_id?: string | null
          subscription_price_id?: string | null
          twitter_handle?: string | null
          user_ai_tools?: string[]
          user_interests?: string[]
          username?: string | null
          website_url?: string | null
        }
        Update: {
          account_type?: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          follower_count?: number
          following_count?: number
          id?: string
          is_admin?: boolean
          is_creator?: boolean
          joined_at?: string
          location?: string | null
          notification_preferences?: Json
          stripe_account_id?: string | null
          subscription_price_id?: string | null
          twitter_handle?: string | null
          user_ai_tools?: string[]
          user_interests?: string[]
          username?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      project_components: {
        Row: {
          component_label: string | null
          component_note: string | null
          component_type: string
          id: string
          inline_content_id: string | null
          linked_content_id: string | null
          position: number
          project_id: string
          show_on_browse: boolean
        }
        Insert: {
          component_label?: string | null
          component_note?: string | null
          component_type: string
          id?: string
          inline_content_id?: string | null
          linked_content_id?: string | null
          position: number
          project_id: string
          show_on_browse?: boolean
        }
        Update: {
          component_label?: string | null
          component_note?: string | null
          component_type?: string
          id?: string
          inline_content_id?: string | null
          linked_content_id?: string | null
          position?: number
          project_id?: string
          show_on_browse?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "project_components_inline_content_id_fkey"
            columns: ["inline_content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_components_linked_content_id_fkey"
            columns: ["linked_content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_components_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          approved_at: string | null
          cover_image_url: string | null
          created_at: string
          creator_id: string
          description: string
          id: string
          status: string
          title: string
          view_count: number
        }
        Insert: {
          approved_at?: string | null
          cover_image_url?: string | null
          created_at?: string
          creator_id: string
          description: string
          id?: string
          status?: string
          title: string
          view_count?: number
        }
        Update: {
          approved_at?: string | null
          cover_image_url?: string | null
          created_at?: string
          creator_id?: string
          description?: string
          id?: string
          status?: string
          title?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "projects_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_enquiries: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          message: string | null
          requester_email: string
          requester_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          message?: string | null
          requester_email: string
          requester_name: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          message?: string | null
          requester_email?: string
          requester_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_enquiries_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "service_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      service_listings: {
        Row: {
          created_at: string
          creator_id: string
          description: string | null
          id: string
          is_active: boolean
          price_gbp: number | null
          title: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          description?: string | null
          id?: string
          is_active?: boolean
          price_gbp?: number | null
          title: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          description?: string | null
          id?: string
          is_active?: boolean
          price_gbp?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_listings_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          creator_id: string
          id: string
          status: string
          stripe_subscription_id: string | null
          subscriber_id: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          id?: string
          status?: string
          stripe_subscription_id?: string | null
          subscriber_id: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          id?: string
          status?: string
          stripe_subscription_id?: string | null
          subscriber_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_interactions: {
        Row: {
          content_id: string
          created_at: string
          id: string
          interaction_meta: Json | null
          interaction_type: string
          project_id: string | null
          user_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          id?: string
          interaction_meta?: Json | null
          interaction_type: string
          project_id?: string | null
          user_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          id?: string
          interaction_meta?: Json | null
          interaction_type?: string
          project_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_interactions_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_interactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_saves: {
        Row: {
          content_id: string
          id: string
          project_id: string | null
          saved_at: string
          user_id: string
        }
        Insert: {
          content_id: string
          id?: string
          project_id?: string | null
          saved_at?: string
          user_id: string
        }
        Update: {
          content_id?: string
          id?: string
          project_id?: string | null
          saved_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_saves_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_saves_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_download_count: {
        Args: { _content_id: string }
        Returns: undefined
      }
      increment_project_view_count: {
        Args: { _project_id: string }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
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
    Enums: {},
  },
} as const
