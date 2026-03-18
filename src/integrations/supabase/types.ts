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
      collab_invites: {
        Row: {
          content_id: string
          id: string
          invited_at: string | null
          invitee_id: string
          inviter_id: string
          responded_at: string | null
          status: string | null
        }
        Insert: {
          content_id: string
          id?: string
          invited_at?: string | null
          invitee_id: string
          inviter_id: string
          responded_at?: string | null
          status?: string | null
        }
        Update: {
          content_id?: string
          id?: string
          invited_at?: string | null
          invitee_id?: string
          inviter_id?: string
          responded_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collab_invites_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_invites_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_follows: {
        Row: {
          collection_id: string
          followed_at: string
          follower_id: string
          id: string
        }
        Insert: {
          collection_id: string
          followed_at?: string
          follower_id: string
          id?: string
        }
        Update: {
          collection_id?: string
          followed_at?: string
          follower_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_follows_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_items: {
        Row: {
          added_at: string
          added_by: string
          collection_id: string
          content_id: string
          id: string
          note: string | null
          position: number
        }
        Insert: {
          added_at?: string
          added_by: string
          collection_id: string
          content_id: string
          id?: string
          note?: string | null
          position: number
        }
        Update: {
          added_at?: string
          added_by?: string
          collection_id?: string
          content_id?: string
          id?: string
          note?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          description: string | null
          follower_count: number
          id: string
          is_public: boolean
          item_count: number
          owner_id: string
          project_id: string | null
          slug: string | null
          title: string
          updated_at: string
          visibility: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          follower_count?: number
          id?: string
          is_public?: boolean
          item_count?: number
          owner_id: string
          project_id?: string | null
          slug?: string | null
          title: string
          updated_at?: string
          visibility?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          follower_count?: number
          id?: string
          is_public?: boolean
          item_count?: number
          owner_id?: string
          project_id?: string | null
          slug?: string | null
          title?: string
          updated_at?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collections_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
          is_preview: boolean
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
          is_preview?: boolean
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
          is_preview?: boolean
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
      content_changelogs: {
        Row: {
          change_note: string
          content_id: string
          created_at: string | null
          created_by: string
          id: string
          version_label: string | null
        }
        Insert: {
          change_note: string
          content_id: string
          created_at?: string | null
          created_by: string
          id?: string
          version_label?: string | null
        }
        Update: {
          change_note?: string
          content_id?: string
          created_at?: string | null
          created_by?: string
          id?: string
          version_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_changelogs_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_changelogs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_collaborators: {
        Row: {
          collaborator_id: string
          content_id: string
          id: string
          is_primary_author: boolean | null
          joined_at: string | null
        }
        Insert: {
          collaborator_id: string
          content_id: string
          id?: string
          is_primary_author?: boolean | null
          joined_at?: string | null
        }
        Update: {
          collaborator_id?: string
          content_id?: string
          id?: string
          is_primary_author?: boolean | null
          joined_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_collaborators_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_collaborators_content_id_fkey"
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
      content_dependencies: {
        Row: {
          content_id: string
          dependency_note: string | null
          id: string
          requires_content_id: string
        }
        Insert: {
          content_id: string
          dependency_note?: string | null
          id?: string
          requires_content_id: string
        }
        Update: {
          content_id?: string
          dependency_note?: string | null
          id?: string
          requires_content_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_dependencies_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_dependencies_requires_content_id_fkey"
            columns: ["requires_content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
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
          compatibility_status: string | null
          content_type: string
          cover_image_url: string | null
          created_at: string
          creator_id: string
          current_version: string
          description: string | null
          difficulty: string
          donation_enabled: boolean
          download_count: number
          embedding: string | null
          file_url: string | null
          fork_count: number
          fork_of_content_id: string | null
          fork_of_creator_id: string | null
          has_curator_recommendation: boolean | null
          id: string
          is_pwyw: boolean
          is_verified: boolean
          last_verified_at: string | null
          monetisation_type: string
          price_gbp: number | null
          pwyw_avg_paid_gbp: number | null
          pwyw_enabled: boolean | null
          pwyw_floor_gbp: number | null
          pwyw_purchase_count: number | null
          rating_count: number
          star_rating: number
          status: string
          title: string
          tool_url: string | null
          use_cases: string[] | null
          use_instructions: string | null
          verification_count: number
          verified_by_creator_at: string | null
          view_count: number
          what_to_expect: string | null
        }
        Insert: {
          ai_tools?: string[] | null
          approved_at?: string | null
          avg_rating?: number
          comment_count?: number
          compatibility_status?: string | null
          content_type: string
          cover_image_url?: string | null
          created_at?: string
          creator_id: string
          current_version?: string
          description?: string | null
          difficulty: string
          donation_enabled?: boolean
          download_count?: number
          embedding?: string | null
          file_url?: string | null
          fork_count?: number
          fork_of_content_id?: string | null
          fork_of_creator_id?: string | null
          has_curator_recommendation?: boolean | null
          id?: string
          is_pwyw?: boolean
          is_verified?: boolean
          last_verified_at?: string | null
          monetisation_type?: string
          price_gbp?: number | null
          pwyw_avg_paid_gbp?: number | null
          pwyw_enabled?: boolean | null
          pwyw_floor_gbp?: number | null
          pwyw_purchase_count?: number | null
          rating_count?: number
          star_rating?: number
          status?: string
          title: string
          tool_url?: string | null
          use_cases?: string[] | null
          use_instructions?: string | null
          verification_count?: number
          verified_by_creator_at?: string | null
          view_count?: number
          what_to_expect?: string | null
        }
        Update: {
          ai_tools?: string[] | null
          approved_at?: string | null
          avg_rating?: number
          comment_count?: number
          compatibility_status?: string | null
          content_type?: string
          cover_image_url?: string | null
          created_at?: string
          creator_id?: string
          current_version?: string
          description?: string | null
          difficulty?: string
          donation_enabled?: boolean
          download_count?: number
          embedding?: string | null
          file_url?: string | null
          fork_count?: number
          fork_of_content_id?: string | null
          fork_of_creator_id?: string | null
          has_curator_recommendation?: boolean | null
          id?: string
          is_pwyw?: boolean
          is_verified?: boolean
          last_verified_at?: string | null
          monetisation_type?: string
          price_gbp?: number | null
          pwyw_avg_paid_gbp?: number | null
          pwyw_enabled?: boolean | null
          pwyw_floor_gbp?: number | null
          pwyw_purchase_count?: number | null
          rating_count?: number
          star_rating?: number
          status?: string
          title?: string
          tool_url?: string | null
          use_cases?: string[] | null
          use_instructions?: string | null
          verification_count?: number
          verified_by_creator_at?: string | null
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
          {
            foreignKeyName: "content_items_fork_of_content_id_fkey"
            columns: ["fork_of_content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_fork_of_creator_id_fkey"
            columns: ["fork_of_creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_microtags: {
        Row: {
          content_id: string
          id: string
          tag: string
        }
        Insert: {
          content_id: string
          id?: string
          tag: string
        }
        Update: {
          content_id?: string
          id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_microtags_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_microtags_tag_fkey"
            columns: ["tag"]
            isOneToOne: false
            referencedRelation: "microtag_definitions"
            referencedColumns: ["tag"]
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
      content_tips: {
        Row: {
          ai_tool_context: string | null
          content_id: string
          created_at: string
          id: string
          is_deleted: boolean
          text: string
          upvote_count: number
          user_id: string
        }
        Insert: {
          ai_tool_context?: string | null
          content_id: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          text: string
          upvote_count?: number
          user_id: string
        }
        Update: {
          ai_tool_context?: string | null
          content_id?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          text?: string
          upvote_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_tips_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_tips_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_verifications: {
        Row: {
          ai_tool_used: string | null
          content_id: string
          id: string
          user_id: string
          verified_at: string
        }
        Insert: {
          ai_tool_used?: string | null
          content_id: string
          id?: string
          user_id: string
          verified_at?: string
        }
        Update: {
          ai_tool_used?: string | null
          content_id?: string
          id?: string
          user_id?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_verifications_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_versions: {
        Row: {
          blocks_snapshot: Json | null
          changelog: string
          content_id: string
          created_at: string
          created_by: string
          id: string
          version_number: string
        }
        Insert: {
          blocks_snapshot?: Json | null
          changelog: string
          content_id: string
          created_at?: string
          created_by: string
          id?: string
          version_number: string
        }
        Update: {
          blocks_snapshot?: Json | null
          changelog?: string
          content_id?: string
          created_at?: string
          created_by?: string
          id?: string
          version_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_versions_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_versions_created_by_fkey"
            columns: ["created_by"]
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
      curator_applications: {
        Row: {
          applied_at: string | null
          id: string
          reason: string
          status: string | null
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          id?: string
          reason: string
          status?: string | null
          user_id: string
        }
        Update: {
          applied_at?: string | null
          id?: string
          reason?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curator_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      curator_recommendations: {
        Row: {
          content_id: string
          created_at: string | null
          curator_id: string
          id: string
          is_active: boolean | null
          recommendation_text: string
        }
        Insert: {
          content_id: string
          created_at?: string | null
          curator_id: string
          id?: string
          is_active?: boolean | null
          recommendation_text: string
        }
        Update: {
          content_id?: string
          created_at?: string | null
          curator_id?: string
          id?: string
          is_active?: boolean | null
          recommendation_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "curator_recommendations_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curator_recommendations_curator_id_fkey"
            columns: ["curator_id"]
            isOneToOne: false
            referencedRelation: "curators"
            referencedColumns: ["id"]
          },
        ]
      }
      curators: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          id: string
          is_active: boolean | null
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          id?: string
          is_active?: boolean | null
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          id?: string
          is_active?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curators_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
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
      learning_path_progress: {
        Row: {
          completed_at: string | null
          completed_step_ids: string[]
          id: string
          path_id: string
          started_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_step_ids?: string[]
          id?: string
          path_id: string
          started_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_step_ids?: string[]
          id?: string
          path_id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_path_progress_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_path_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_path_steps: {
        Row: {
          content_id: string
          id: string
          path_id: string
          position: number
          step_label: string | null
          step_note: string | null
        }
        Insert: {
          content_id: string
          id?: string
          path_id: string
          position: number
          step_label?: string | null
          step_note?: string | null
        }
        Update: {
          content_id?: string
          id?: string
          path_id?: string
          position?: number
          step_label?: string | null
          step_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_path_steps_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_path_steps_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_paths: {
        Row: {
          completion_count: number
          created_at: string
          creator_id: string
          description: string
          difficulty_range: string | null
          estimated_time_minutes: number | null
          follower_count: number
          id: string
          is_platform_curated: boolean
          status: string
          title: string
        }
        Insert: {
          completion_count?: number
          created_at?: string
          creator_id: string
          description: string
          difficulty_range?: string | null
          estimated_time_minutes?: number | null
          follower_count?: number
          id?: string
          is_platform_curated?: boolean
          status?: string
          title: string
        }
        Update: {
          completion_count?: number
          created_at?: string
          creator_id?: string
          description?: string
          difficulty_range?: string | null
          estimated_time_minutes?: number | null
          follower_count?: number
          id?: string
          is_platform_curated?: boolean
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_paths_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          id: string
          is_read: boolean
          recipient_id: string
          reply_to_enquiry_id: string | null
          sender_id: string
          sent_at: string
          text: string
          thread_id: string
        }
        Insert: {
          id?: string
          is_read?: boolean
          recipient_id: string
          reply_to_enquiry_id?: string | null
          sender_id: string
          sent_at?: string
          text: string
          thread_id: string
        }
        Update: {
          id?: string
          is_read?: boolean
          recipient_id?: string
          reply_to_enquiry_id?: string | null
          sender_id?: string
          sent_at?: string
          text?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_enquiry_id_fkey"
            columns: ["reply_to_enquiry_id"]
            isOneToOne: false
            referencedRelation: "service_enquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      microtag_definitions: {
        Row: {
          description: string | null
          tag: string
        }
        Insert: {
          description?: string | null
          tag: string
        }
        Update: {
          description?: string | null
          tag?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          collection_id: string | null
          content_id: string | null
          created_at: string
          id: string
          is_read: boolean
          metadata: Json | null
          notification_type: string
          project_id: string | null
          recipient_id: string
        }
        Insert: {
          actor_id?: string | null
          collection_id?: string | null
          content_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          notification_type: string
          project_id?: string | null
          recipient_id: string
        }
        Update: {
          actor_id?: string | null
          collection_id?: string | null
          content_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          notification_type?: string
          project_id?: string | null
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
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
          curator_application_status: string | null
          display_name: string | null
          follower_count: number
          following_count: number
          id: string
          is_admin: boolean
          is_creator: boolean
          is_curator: boolean | null
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
          curator_application_status?: string | null
          display_name?: string | null
          follower_count?: number
          following_count?: number
          id: string
          is_admin?: boolean
          is_creator?: boolean
          is_curator?: boolean | null
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
          curator_application_status?: string | null
          display_name?: string | null
          follower_count?: number
          following_count?: number
          id?: string
          is_admin?: boolean
          is_creator?: boolean
          is_curator?: boolean | null
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
      project_package_purchases: {
        Row: {
          amount_gbp: number | null
          id: string
          project_id: string
          purchased_at: string
          stripe_payment_intent_id: string | null
          user_id: string
        }
        Insert: {
          amount_gbp?: number | null
          id?: string
          project_id: string
          purchased_at?: string
          stripe_payment_intent_id?: string | null
          user_id: string
        }
        Update: {
          amount_gbp?: number | null
          id?: string
          project_id?: string
          purchased_at?: string
          stripe_payment_intent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_package_purchases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_package_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          package_price_enabled: boolean
          package_price_gbp: number | null
          package_stripe_price_id: string | null
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
          package_price_enabled?: boolean
          package_price_gbp?: number | null
          package_stripe_price_id?: string | null
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
          package_price_enabled?: boolean
          package_price_gbp?: number | null
          package_stripe_price_id?: string | null
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
      revenue_splits: {
        Row: {
          content_id: string | null
          created_at: string | null
          id: string
          percentage: number
          project_id: string | null
          recipient_id: string
          set_by: string
        }
        Insert: {
          content_id?: string | null
          created_at?: string | null
          id?: string
          percentage: number
          project_id?: string | null
          recipient_id: string
          set_by: string
        }
        Update: {
          content_id?: string | null
          created_at?: string | null
          id?: string
          percentage?: number
          project_id?: string | null
          recipient_id?: string
          set_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_splits_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_splits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_splits_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_splits_set_by_fkey"
            columns: ["set_by"]
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
      tip_upvotes: {
        Row: {
          created_at: string
          id: string
          tip_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tip_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tip_upvotes_tip_id_fkey"
            columns: ["tip_id"]
            isOneToOne: false
            referencedRelation: "content_tips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tip_upvotes_user_id_fkey"
            columns: ["user_id"]
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
      user_library: {
        Row: {
          added_at: string | null
          content_id: string
          has_update: boolean | null
          id: string
          last_seen_version: string | null
          user_id: string
        }
        Insert: {
          added_at?: string | null
          content_id: string
          has_update?: boolean | null
          id?: string
          last_seen_version?: string | null
          user_id: string
        }
        Update: {
          added_at?: string | null
          content_id?: string
          has_update?: boolean | null
          id?: string
          last_seen_version?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_library_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_library_user_id_fkey"
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
      increment_content_view_count: {
        Args: { _content_id: string }
        Returns: undefined
      }
      increment_download_count: {
        Args: { _content_id: string }
        Returns: undefined
      }
      increment_project_view_count: {
        Args: { _project_id: string }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      semantic_search: {
        Args: { match_count: number; query_embedding: string }
        Returns: {
          id: string
          similarity: number
          title: string
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
