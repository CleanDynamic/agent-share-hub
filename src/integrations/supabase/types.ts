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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
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
      ai_export_log: {
        Row: {
          exported_at: string
          exporter_id: string | null
          format: string
          id: string
          post_id: string
        }
        Insert: {
          exported_at?: string
          exporter_id?: string | null
          format: string
          id?: string
          post_id: string
        }
        Update: {
          exported_at?: string
          exporter_id?: string | null
          format?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_export_log_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "content_items"
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
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
      bounty_author_review: {
        Row: {
          author_id: string
          bounty_id: string
          created_at: string
          id: string
          private_note: string | null
          solution_id: string
          state: string
          updated_at: string
        }
        Insert: {
          author_id: string
          bounty_id: string
          created_at?: string
          id?: string
          private_note?: string | null
          solution_id: string
          state: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          bounty_id?: string
          created_at?: string
          id?: string
          private_note?: string | null
          solution_id?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bounty_author_review_bounty_id_fkey"
            columns: ["bounty_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      bounty_comment_last_read: {
        Row: {
          bounty_id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          bounty_id: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          bounty_id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bounty_comment_last_read_bounty_id_fkey"
            columns: ["bounty_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      bounty_comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          reaction: string
          reactor_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          reaction: string
          reactor_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          reaction?: string
          reactor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bounty_comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "bounty_discussion_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      bounty_deadline_extensions: {
        Row: {
          bounty_id: string
          created_at: string
          extended_by: string
          id: string
          new_deadline: string
          previous_deadline: string | null
          reason: string | null
        }
        Insert: {
          bounty_id: string
          created_at?: string
          extended_by: string
          id?: string
          new_deadline: string
          previous_deadline?: string | null
          reason?: string | null
        }
        Update: {
          bounty_id?: string
          created_at?: string
          extended_by?: string
          id?: string
          new_deadline?: string
          previous_deadline?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bounty_deadline_extensions_bounty_id_fkey"
            columns: ["bounty_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      bounty_discussion_comments: {
        Row: {
          author_id: string
          body: string
          bounty_id: string
          created_at: string
          id: string
          parent_comment_id: string | null
          tagged_bounty_author: boolean
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          bounty_id: string
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          tagged_bounty_author?: boolean
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          bounty_id?: string
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          tagged_bounty_author?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bounty_discussion_comments_bounty_id_fkey"
            columns: ["bounty_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bounty_discussion_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "bounty_discussion_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      build_events: {
        Row: {
          build_id: string
          created_at: string
          id: string
          kind: string
          occurred_at: string | null
          ordinal: number
          payload: Json
          phase: number | null
          phase_title: string | null
          produced_node_id: string | null
          visibility: string
        }
        Insert: {
          build_id: string
          created_at?: string
          id?: string
          kind: string
          occurred_at?: string | null
          ordinal: number
          payload?: Json
          phase?: number | null
          phase_title?: string | null
          produced_node_id?: string | null
          visibility?: string
        }
        Update: {
          build_id?: string
          created_at?: string
          id?: string
          kind?: string
          occurred_at?: string | null
          ordinal?: number
          payload?: Json
          phase?: number | null
          phase_title?: string | null
          produced_node_id?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "build_events_build_id_fkey"
            columns: ["build_id"]
            isOneToOne: false
            referencedRelation: "builds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "build_events_produced_node_id_fkey"
            columns: ["produced_node_id"]
            isOneToOne: false
            referencedRelation: "build_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      build_layers: {
        Row: {
          approved: boolean
          approved_at: string | null
          build_id: string
          content: Json
          created_at: string
          edited_by_creator: boolean
          generated_at: string
          generated_from_hash: string
          id: string
          layer: string
          model_used: string | null
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          build_id: string
          content?: Json
          created_at?: string
          edited_by_creator?: boolean
          generated_at?: string
          generated_from_hash: string
          id?: string
          layer: string
          model_used?: string | null
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          build_id?: string
          content?: Json
          created_at?: string
          edited_by_creator?: boolean
          generated_at?: string
          generated_from_hash?: string
          id?: string
          layer?: string
          model_used?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "build_layers_build_id_fkey"
            columns: ["build_id"]
            isOneToOne: false
            referencedRelation: "builds"
            referencedColumns: ["id"]
          },
        ]
      }
      build_media: {
        Row: {
          bucket: string
          build_id: string
          bytes: number | null
          caption: string | null
          created_at: string
          duration: number | null
          filename: string | null
          height: number | null
          id: string
          kind: string
          metadata: Json | null
          mime: string | null
          node_id: string | null
          path: string
          poster_path: string | null
          width: number | null
        }
        Insert: {
          bucket?: string
          build_id: string
          bytes?: number | null
          caption?: string | null
          created_at?: string
          duration?: number | null
          filename?: string | null
          height?: number | null
          id?: string
          kind: string
          metadata?: Json | null
          mime?: string | null
          node_id?: string | null
          path: string
          poster_path?: string | null
          width?: number | null
        }
        Update: {
          bucket?: string
          build_id?: string
          bytes?: number | null
          caption?: string | null
          created_at?: string
          duration?: number | null
          filename?: string | null
          height?: number | null
          id?: string
          kind?: string
          metadata?: Json | null
          mime?: string | null
          node_id?: string | null
          path?: string
          poster_path?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "build_media_build_id_fkey"
            columns: ["build_id"]
            isOneToOne: false
            referencedRelation: "builds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "build_media_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "build_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      build_nodes: {
        Row: {
          build_id: string
          created_at: string
          event_id: string | null
          id: string
          is_gap: boolean
          note: string | null
          parent_id: string | null
          payload: Json
          position: number | null
          source_ref: Json | null
          title: string | null
          type: string
        }
        Insert: {
          build_id: string
          created_at?: string
          event_id?: string | null
          id?: string
          is_gap?: boolean
          note?: string | null
          parent_id?: string | null
          payload?: Json
          position?: number | null
          source_ref?: Json | null
          title?: string | null
          type: string
        }
        Update: {
          build_id?: string
          created_at?: string
          event_id?: string | null
          id?: string
          is_gap?: boolean
          note?: string | null
          parent_id?: string | null
          payload?: Json
          position?: number | null
          source_ref?: Json | null
          title?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "build_nodes_build_id_fkey"
            columns: ["build_id"]
            isOneToOne: false
            referencedRelation: "builds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "build_nodes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "build_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "build_nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "build_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "build_nodes_type_fkey"
            columns: ["type"]
            isOneToOne: false
            referencedRelation: "node_types"
            referencedColumns: ["key"]
          },
        ]
      }
      build_reproductions: {
        Row: {
          build_id: string
          confirmed_at: string
          created_at: string
          id: string
          metadata: Json | null
          model_used: string | null
          note: string | null
          result: string | null
          user_id: string
          worked: boolean
        }
        Insert: {
          build_id: string
          confirmed_at?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          model_used?: string | null
          note?: string | null
          result?: string | null
          user_id: string
          worked?: boolean
        }
        Update: {
          build_id?: string
          confirmed_at?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          model_used?: string | null
          note?: string | null
          result?: string | null
          user_id?: string
          worked?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "build_reproductions_build_id_fkey"
            columns: ["build_id"]
            isOneToOne: false
            referencedRelation: "builds"
            referencedColumns: ["id"]
          },
        ]
      }
      builds: {
        Row: {
          completeness: number | null
          cost_monthly: number | null
          cost_setup: number | null
          created_at: string
          creator_id: string
          currency: string | null
          donation_enabled: boolean | null
          forked_from_event_id: string | null
          hero_node_id: string | null
          id: string
          last_confirmed_at: string | null
          last_confirmed_model: string | null
          live_url: string | null
          made_for: string[] | null
          made_with: string[] | null
          monetisation_type: string | null
          outcome: string | null
          parent_build_id: string | null
          price_gbp: number | null
          published_at: string | null
          repo_url: string | null
          reproduction_count: number
          root_build_id: string | null
          shape: string
          slug: string
          source_content_item_id: string | null
          status: string
          time_to_first_result: number | null
          title: string
          updated_at: string
        }
        Insert: {
          completeness?: number | null
          cost_monthly?: number | null
          cost_setup?: number | null
          created_at?: string
          creator_id: string
          currency?: string | null
          donation_enabled?: boolean | null
          forked_from_event_id?: string | null
          hero_node_id?: string | null
          id?: string
          last_confirmed_at?: string | null
          last_confirmed_model?: string | null
          live_url?: string | null
          made_for?: string[] | null
          made_with?: string[] | null
          monetisation_type?: string | null
          outcome?: string | null
          parent_build_id?: string | null
          price_gbp?: number | null
          published_at?: string | null
          repo_url?: string | null
          reproduction_count?: number
          root_build_id?: string | null
          shape?: string
          slug: string
          source_content_item_id?: string | null
          status?: string
          time_to_first_result?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          completeness?: number | null
          cost_monthly?: number | null
          cost_setup?: number | null
          created_at?: string
          creator_id?: string
          currency?: string | null
          donation_enabled?: boolean | null
          forked_from_event_id?: string | null
          hero_node_id?: string | null
          id?: string
          last_confirmed_at?: string | null
          last_confirmed_model?: string | null
          live_url?: string | null
          made_for?: string[] | null
          made_with?: string[] | null
          monetisation_type?: string | null
          outcome?: string | null
          parent_build_id?: string | null
          price_gbp?: number | null
          published_at?: string | null
          repo_url?: string | null
          reproduction_count?: number
          root_build_id?: string | null
          shape?: string
          slug?: string
          source_content_item_id?: string | null
          status?: string
          time_to_first_result?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "builds_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "builds_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "builds_forked_from_event_id_fkey"
            columns: ["forked_from_event_id"]
            isOneToOne: false
            referencedRelation: "build_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "builds_hero_node_id_fkey"
            columns: ["hero_node_id"]
            isOneToOne: false
            referencedRelation: "build_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "builds_parent_build_id_fkey"
            columns: ["parent_build_id"]
            isOneToOne: false
            referencedRelation: "builds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "builds_root_build_id_fkey"
            columns: ["root_build_id"]
            isOneToOne: false
            referencedRelation: "builds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "builds_source_content_item_id_fkey"
            columns: ["source_content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_history: {
        Row: {
          challenge_key: string
          completed_at: string
          id: string
          title: string | null
          user_id: string
          xp_awarded: number
        }
        Insert: {
          challenge_key: string
          completed_at?: string
          id?: string
          title?: string | null
          user_id: string
          xp_awarded?: number
        }
        Update: {
          challenge_key?: string
          completed_at?: string
          id?: string
          title?: string | null
          user_id?: string
          xp_awarded?: number
        }
        Relationships: []
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
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
      collab_split_contests: {
        Row: {
          content_id: string
          contestant_id: string
          created_at: string
          id: string
          original_percentage: number
          proposed_percentage: number
          reason: string | null
          status: string
        }
        Insert: {
          content_id: string
          contestant_id: string
          created_at?: string
          id?: string
          original_percentage: number
          proposed_percentage: number
          reason?: string | null
          status?: string
        }
        Update: {
          content_id?: string
          contestant_id?: string
          created_at?: string
          id?: string
          original_percentage?: number
          proposed_percentage?: number
          reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_split_contests_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_split_contests_contestant_id_fkey"
            columns: ["contestant_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "collab_split_contests_contestant_id_fkey"
            columns: ["contestant_id"]
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
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
          cached_meta: Json | null
          collection_id: string
          content_id: string
          id: string
          item_id: string | null
          item_kind: string | null
          note: string | null
          position: number
        }
        Insert: {
          added_at?: string
          added_by: string
          cached_meta?: Json | null
          collection_id: string
          content_id: string
          id?: string
          item_id?: string | null
          item_kind?: string | null
          note?: string | null
          position: number
        }
        Update: {
          added_at?: string
          added_by?: string
          cached_meta?: Json | null
          collection_id?: string
          content_id?: string
          id?: string
          item_id?: string | null
          item_kind?: string | null
          note?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
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
          accent_color: string
          created_at: string
          description: string | null
          follower_count: number
          id: string
          is_default: boolean
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
          accent_color?: string
          created_at?: string
          description?: string | null
          follower_count?: number
          id?: string
          is_default?: boolean
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
          accent_color?: string
          created_at?: string
          description?: string | null
          follower_count?: number
          id?: string
          is_default?: boolean
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
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
          external_file_url: string | null
          file_name: string | null
          file_size_bytes: number | null
          file_url: string | null
          formatting: Json | null
          formatting_type: string
          github_url: string | null
          id: string
          image_description: string | null
          image_url: string | null
          is_preview: boolean
          position: number
          sub_blocks: Json | null
          text_content: string | null
          use_instructions: string | null
        }
        Insert: {
          block_type: string
          content_id: string
          created_at?: string
          external_file_url?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          formatting?: Json | null
          formatting_type?: string
          github_url?: string | null
          id?: string
          image_description?: string | null
          image_url?: string | null
          is_preview?: boolean
          position: number
          sub_blocks?: Json | null
          text_content?: string | null
          use_instructions?: string | null
        }
        Update: {
          block_type?: string
          content_id?: string
          created_at?: string
          external_file_url?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          formatting?: Json | null
          formatting_type?: string
          github_url?: string | null
          id?: string
          image_description?: string | null
          image_url?: string | null
          is_preview?: boolean
          position?: number
          sub_blocks?: Json | null
          text_content?: string | null
          use_instructions?: string | null
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
          fields_changed_count: number | null
          id: string
          version_label: string | null
        }
        Insert: {
          change_note: string
          content_id: string
          created_at?: string | null
          created_by: string
          fields_changed_count?: number | null
          id?: string
          version_label?: string | null
        }
        Update: {
          change_note?: string
          content_id?: string
          created_at?: string | null
          created_by?: string
          fields_changed_count?: number | null
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
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
      content_item_results: {
        Row: {
          caption: string | null
          content_item_id: string
          created_at: string
          id: string
          kind: string
          media_url: string | null
          position: number
          text_content: string | null
        }
        Insert: {
          caption?: string | null
          content_item_id: string
          created_at?: string
          id?: string
          kind: string
          media_url?: string | null
          position?: number
          text_content?: string | null
        }
        Update: {
          caption?: string | null
          content_item_id?: string
          created_at?: string
          id?: string
          kind?: string
          media_url?: string | null
          position?: number
          text_content?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_item_results_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          ai_pdf_generated_at: string | null
          ai_pdf_url: string | null
          ai_tools: string[] | null
          approved_at: string | null
          article_body: Json | null
          avg_rating: number
          block_count: number
          block_types_used: string[]
          blog_referenced_post_ids: string[] | null
          blog_topic_category: string | null
          bounty_acceptance_criteria: string | null
          bounty_active_solvers: number
          bounty_deadline: string | null
          bounty_health_score: number | null
          bounty_is_meta: boolean
          bounty_meta_parent_id: string | null
          bounty_reward_amount: number | null
          bounty_reward_currency: string | null
          bounty_reward_type: string | null
          bounty_sequential_id: number | null
          bounty_solved_count: number
          bounty_status: string | null
          bounty_submissions_paused: boolean
          bounty_total_slots: number
          bounty_total_submissions: number
          canonical_export_payload: Json | null
          comment_count: number
          compatibility_status: string | null
          connection_count: number
          content_type: string
          cover_image_focal_x: number | null
          cover_image_focal_y: number | null
          cover_image_path: string | null
          cover_image_url: string | null
          created_at: string
          creator_id: string
          current_version: string
          custom_tags: string[] | null
          custom_use_case_description: string | null
          description: string | null
          difficulty: string
          domain: string | null
          donation_enabled: boolean
          download_count: number
          draft_name: string | null
          draft_saved_at: string | null
          embedding: string | null
          estimated_read_minutes: number | null
          estimated_reading_minutes: number | null
          evidence_caption: string | null
          evidence_media_type: string | null
          evidence_media_urls: string[] | null
          file_url: string | null
          fork_count: number
          fork_of_content_id: string | null
          fork_of_creator_id: string | null
          forked_from_solution_id: string | null
          has_curator_recommendation: boolean | null
          id: string
          is_pwyw: boolean
          is_verified: boolean
          last_metadata_recompute_at: string | null
          last_verified_at: string | null
          missing_block_count: number
          missing_stage_count: number
          model_base_architecture: string | null
          model_format: string | null
          model_license: string | null
          model_parameters: string | null
          model_run_with: string[] | null
          models_referenced: string[]
          monetisation_type: string
          other_tool_name: string | null
          outcome: string | null
          post_type: string
          prerequisites: string | null
          price_gbp: number | null
          published_at: string | null
          pwyw_avg_paid_gbp: number | null
          pwyw_enabled: boolean | null
          pwyw_floor_gbp: number | null
          pwyw_purchase_count: number | null
          rating_count: number
          reading_completion_count: number
          reblog_count: number
          results: Json | null
          slug: string | null
          stage_count: number
          stage_grids: Json | null
          star_rating: number
          status: string
          subtitle: string | null
          tags: string[]
          title: string
          tool_subtype: string | null
          tool_url: string | null
          tools_referenced: string[]
          topics: string[] | null
          use_case: string | null
          use_cases: string[] | null
          use_instructions: string | null
          verification_count: number
          verified_by_creator_at: string | null
          view_count: number
          visibility: string
          what_to_expect: string | null
          what_to_expect_blocks: Json | null
          word_count: number
        }
        Insert: {
          ai_pdf_generated_at?: string | null
          ai_pdf_url?: string | null
          ai_tools?: string[] | null
          approved_at?: string | null
          article_body?: Json | null
          avg_rating?: number
          block_count?: number
          block_types_used?: string[]
          blog_referenced_post_ids?: string[] | null
          blog_topic_category?: string | null
          bounty_acceptance_criteria?: string | null
          bounty_active_solvers?: number
          bounty_deadline?: string | null
          bounty_health_score?: number | null
          bounty_is_meta?: boolean
          bounty_meta_parent_id?: string | null
          bounty_reward_amount?: number | null
          bounty_reward_currency?: string | null
          bounty_reward_type?: string | null
          bounty_sequential_id?: number | null
          bounty_solved_count?: number
          bounty_status?: string | null
          bounty_submissions_paused?: boolean
          bounty_total_slots?: number
          bounty_total_submissions?: number
          canonical_export_payload?: Json | null
          comment_count?: number
          compatibility_status?: string | null
          connection_count?: number
          content_type: string
          cover_image_focal_x?: number | null
          cover_image_focal_y?: number | null
          cover_image_path?: string | null
          cover_image_url?: string | null
          created_at?: string
          creator_id: string
          current_version?: string
          custom_tags?: string[] | null
          custom_use_case_description?: string | null
          description?: string | null
          difficulty: string
          domain?: string | null
          donation_enabled?: boolean
          download_count?: number
          draft_name?: string | null
          draft_saved_at?: string | null
          embedding?: string | null
          estimated_read_minutes?: number | null
          estimated_reading_minutes?: number | null
          evidence_caption?: string | null
          evidence_media_type?: string | null
          evidence_media_urls?: string[] | null
          file_url?: string | null
          fork_count?: number
          fork_of_content_id?: string | null
          fork_of_creator_id?: string | null
          forked_from_solution_id?: string | null
          has_curator_recommendation?: boolean | null
          id?: string
          is_pwyw?: boolean
          is_verified?: boolean
          last_metadata_recompute_at?: string | null
          last_verified_at?: string | null
          missing_block_count?: number
          missing_stage_count?: number
          model_base_architecture?: string | null
          model_format?: string | null
          model_license?: string | null
          model_parameters?: string | null
          model_run_with?: string[] | null
          models_referenced?: string[]
          monetisation_type?: string
          other_tool_name?: string | null
          outcome?: string | null
          post_type?: string
          prerequisites?: string | null
          price_gbp?: number | null
          published_at?: string | null
          pwyw_avg_paid_gbp?: number | null
          pwyw_enabled?: boolean | null
          pwyw_floor_gbp?: number | null
          pwyw_purchase_count?: number | null
          rating_count?: number
          reading_completion_count?: number
          reblog_count?: number
          results?: Json | null
          slug?: string | null
          stage_count?: number
          stage_grids?: Json | null
          star_rating?: number
          status?: string
          subtitle?: string | null
          tags?: string[]
          title: string
          tool_subtype?: string | null
          tool_url?: string | null
          tools_referenced?: string[]
          topics?: string[] | null
          use_case?: string | null
          use_cases?: string[] | null
          use_instructions?: string | null
          verification_count?: number
          verified_by_creator_at?: string | null
          view_count?: number
          visibility?: string
          what_to_expect?: string | null
          what_to_expect_blocks?: Json | null
          word_count?: number
        }
        Update: {
          ai_pdf_generated_at?: string | null
          ai_pdf_url?: string | null
          ai_tools?: string[] | null
          approved_at?: string | null
          article_body?: Json | null
          avg_rating?: number
          block_count?: number
          block_types_used?: string[]
          blog_referenced_post_ids?: string[] | null
          blog_topic_category?: string | null
          bounty_acceptance_criteria?: string | null
          bounty_active_solvers?: number
          bounty_deadline?: string | null
          bounty_health_score?: number | null
          bounty_is_meta?: boolean
          bounty_meta_parent_id?: string | null
          bounty_reward_amount?: number | null
          bounty_reward_currency?: string | null
          bounty_reward_type?: string | null
          bounty_sequential_id?: number | null
          bounty_solved_count?: number
          bounty_status?: string | null
          bounty_submissions_paused?: boolean
          bounty_total_slots?: number
          bounty_total_submissions?: number
          canonical_export_payload?: Json | null
          comment_count?: number
          compatibility_status?: string | null
          connection_count?: number
          content_type?: string
          cover_image_focal_x?: number | null
          cover_image_focal_y?: number | null
          cover_image_path?: string | null
          cover_image_url?: string | null
          created_at?: string
          creator_id?: string
          current_version?: string
          custom_tags?: string[] | null
          custom_use_case_description?: string | null
          description?: string | null
          difficulty?: string
          domain?: string | null
          donation_enabled?: boolean
          download_count?: number
          draft_name?: string | null
          draft_saved_at?: string | null
          embedding?: string | null
          estimated_read_minutes?: number | null
          estimated_reading_minutes?: number | null
          evidence_caption?: string | null
          evidence_media_type?: string | null
          evidence_media_urls?: string[] | null
          file_url?: string | null
          fork_count?: number
          fork_of_content_id?: string | null
          fork_of_creator_id?: string | null
          forked_from_solution_id?: string | null
          has_curator_recommendation?: boolean | null
          id?: string
          is_pwyw?: boolean
          is_verified?: boolean
          last_metadata_recompute_at?: string | null
          last_verified_at?: string | null
          missing_block_count?: number
          missing_stage_count?: number
          model_base_architecture?: string | null
          model_format?: string | null
          model_license?: string | null
          model_parameters?: string | null
          model_run_with?: string[] | null
          models_referenced?: string[]
          monetisation_type?: string
          other_tool_name?: string | null
          outcome?: string | null
          post_type?: string
          prerequisites?: string | null
          price_gbp?: number | null
          published_at?: string | null
          pwyw_avg_paid_gbp?: number | null
          pwyw_enabled?: boolean | null
          pwyw_floor_gbp?: number | null
          pwyw_purchase_count?: number | null
          rating_count?: number
          reading_completion_count?: number
          reblog_count?: number
          results?: Json | null
          slug?: string | null
          stage_count?: number
          stage_grids?: Json | null
          star_rating?: number
          status?: string
          subtitle?: string | null
          tags?: string[]
          title?: string
          tool_subtype?: string | null
          tool_url?: string | null
          tools_referenced?: string[]
          topics?: string[] | null
          use_case?: string | null
          use_cases?: string[] | null
          use_instructions?: string | null
          verification_count?: number
          verified_by_creator_at?: string | null
          view_count?: number
          visibility?: string
          what_to_expect?: string | null
          what_to_expect_blocks?: Json | null
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_items_bounty_meta_parent_id_fkey"
            columns: ["bounty_meta_parent_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
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
      content_share_views: {
        Row: {
          id: string
          message_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          id?: string
          message_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          id?: string
          message_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_share_views_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "dm_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_share_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "content_share_views_viewer_id_fkey"
            columns: ["viewer_id"]
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
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
      creator_marks: {
        Row: {
          display_order: number
          earned_at: string
          id: string
          mark_key: string
          metadata: Json
          pinned: boolean
          user_id: string
        }
        Insert: {
          display_order?: number
          earned_at?: string
          id?: string
          mark_key: string
          metadata?: Json
          pinned?: boolean
          user_id: string
        }
        Update: {
          display_order?: number
          earned_at?: string
          id?: string
          mark_key?: string
          metadata?: Json
          pinned?: boolean
          user_id?: string
        }
        Relationships: []
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
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
      daily_challenges: {
        Row: {
          challenge_key: string
          claimed: boolean
          created_at: string
          description: string | null
          expires_at: string
          id: string
          progress: number
          target: number
          title: string
          user_id: string
          xp_reward: number
        }
        Insert: {
          challenge_key: string
          claimed?: boolean
          created_at?: string
          description?: string | null
          expires_at?: string
          id?: string
          progress?: number
          target?: number
          title: string
          user_id: string
          xp_reward?: number
        }
        Update: {
          challenge_key?: string
          claimed?: boolean
          created_at?: string
          description?: string | null
          expires_at?: string
          id?: string
          progress?: number
          target?: number
          title?: string
          user_id?: string
          xp_reward?: number
        }
        Relationships: []
      }
      dm_messages: {
        Row: {
          body: string | null
          delivered_at: string | null
          edited_at: string | null
          id: string
          image_url: string | null
          is_liked: boolean | null
          is_unsent: boolean | null
          kind: string
          message_type: string
          read_at: string | null
          reply_to_message_id: string | null
          sender_id: string
          sent_at: string | null
          shared_content_id: string | null
          shared_content_meta: Json | null
          shared_content_type: string | null
          shared_reblog_id: string | null
          text_content: string | null
          thread_id: string
          voice_duration_seconds: number | null
          voice_url: string | null
        }
        Insert: {
          body?: string | null
          delivered_at?: string | null
          edited_at?: string | null
          id?: string
          image_url?: string | null
          is_liked?: boolean | null
          is_unsent?: boolean | null
          kind?: string
          message_type?: string
          read_at?: string | null
          reply_to_message_id?: string | null
          sender_id: string
          sent_at?: string | null
          shared_content_id?: string | null
          shared_content_meta?: Json | null
          shared_content_type?: string | null
          shared_reblog_id?: string | null
          text_content?: string | null
          thread_id: string
          voice_duration_seconds?: number | null
          voice_url?: string | null
        }
        Update: {
          body?: string | null
          delivered_at?: string | null
          edited_at?: string | null
          id?: string
          image_url?: string | null
          is_liked?: boolean | null
          is_unsent?: boolean | null
          kind?: string
          message_type?: string
          read_at?: string | null
          reply_to_message_id?: string | null
          sender_id?: string
          sent_at?: string | null
          shared_content_id?: string | null
          shared_content_meta?: Json | null
          shared_content_type?: string | null
          shared_reblog_id?: string | null
          text_content?: string | null
          thread_id?: string
          voice_duration_seconds?: number | null
          voice_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dm_messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "dm_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "dm_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_messages_shared_content_id_fkey"
            columns: ["shared_content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_messages_shared_reblog_id_fkey"
            columns: ["shared_reblog_id"]
            isOneToOne: false
            referencedRelation: "reblogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "dm_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_presence: {
        Row: {
          is_online: boolean | null
          last_seen_at: string | null
          user_id: string
        }
        Insert: {
          is_online?: boolean | null
          last_seen_at?: string | null
          user_id: string
        }
        Update: {
          is_online?: boolean | null
          last_seen_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "dm_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_reactions: {
        Row: {
          emoji: string
          id: string
          message_id: string
          reacted_at: string | null
          user_id: string
        }
        Insert: {
          emoji: string
          id?: string
          message_id: string
          reacted_at?: string | null
          user_id: string
        }
        Update: {
          emoji?: string
          id?: string
          message_id?: string
          reacted_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "dm_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "dm_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_thread_members: {
        Row: {
          is_admin: boolean
          is_muted: boolean
          is_pinned: boolean
          joined_at: string
          last_read_at: string | null
          thread_id: string
          user_id: string
        }
        Insert: {
          is_admin?: boolean
          is_muted?: boolean
          is_pinned?: boolean
          joined_at?: string
          last_read_at?: string | null
          thread_id: string
          user_id: string
        }
        Update: {
          is_admin?: boolean
          is_muted?: boolean
          is_pinned?: boolean
          joined_at?: string
          last_read_at?: string | null
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_thread_members_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "dm_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_thread_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "dm_thread_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_threads: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_archived: boolean
          is_deleted_a: boolean | null
          is_deleted_b: boolean | null
          is_muted_a: boolean | null
          is_muted_b: boolean | null
          is_pinned_a: boolean | null
          is_pinned_b: boolean | null
          last_message_at: string | null
          last_message_preview: string | null
          last_message_sender_id: string | null
          participant_a: string | null
          participant_b: string | null
          pinned_content_id: string | null
          pinned_content_type: string | null
          request_status: string | null
          title: string | null
          type: string
          unread_count_a: number | null
          unread_count_b: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_archived?: boolean
          is_deleted_a?: boolean | null
          is_deleted_b?: boolean | null
          is_muted_a?: boolean | null
          is_muted_b?: boolean | null
          is_pinned_a?: boolean | null
          is_pinned_b?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          last_message_sender_id?: string | null
          participant_a?: string | null
          participant_b?: string | null
          pinned_content_id?: string | null
          pinned_content_type?: string | null
          request_status?: string | null
          title?: string | null
          type?: string
          unread_count_a?: number | null
          unread_count_b?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_archived?: boolean
          is_deleted_a?: boolean | null
          is_deleted_b?: boolean | null
          is_muted_a?: boolean | null
          is_muted_b?: boolean | null
          is_pinned_a?: boolean | null
          is_pinned_b?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          last_message_sender_id?: string | null
          participant_a?: string | null
          participant_b?: string | null
          pinned_content_id?: string | null
          pinned_content_type?: string | null
          request_status?: string | null
          title?: string | null
          type?: string
          unread_count_a?: number | null
          unread_count_b?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dm_threads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "dm_threads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_threads_last_message_sender_id_fkey"
            columns: ["last_message_sender_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "dm_threads_last_message_sender_id_fkey"
            columns: ["last_message_sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_threads_participant_a_fkey"
            columns: ["participant_a"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "dm_threads_participant_a_fkey"
            columns: ["participant_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_threads_participant_b_fkey"
            columns: ["participant_b"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "dm_threads_participant_b_fkey"
            columns: ["participant_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_threads_pinned_content_id_fkey"
            columns: ["pinned_content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      document_comments: {
        Row: {
          anchor_data: Json
          anchor_type: string
          author_id: string
          body: string
          created_at: string
          document_id: string
          id: string
          parent_comment_id: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          thread_id: string
          updated_at: string
        }
        Insert: {
          anchor_data?: Json
          anchor_type: string
          author_id: string
          body: string
          created_at?: string
          document_id: string
          id?: string
          parent_comment_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          thread_id: string
          updated_at?: string
        }
        Update: {
          anchor_data?: Json
          anchor_type?: string
          author_id?: string
          body?: string
          created_at?: string
          document_id?: string
          id?: string
          parent_comment_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "document_comments"
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
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
      draft_autosave_log: {
        Row: {
          content_id: string
          field_changed: string | null
          id: string
          saved_at: string
        }
        Insert: {
          content_id: string
          field_changed?: string | null
          id?: string
          saved_at?: string
        }
        Update: {
          content_id?: string
          field_changed?: string | null
          id?: string
          saved_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_autosave_log_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          enabled: boolean
          key: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          key: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          key?: string
          updated_at?: string
        }
        Relationships: []
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "learning_paths_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      library_folders: {
        Row: {
          created_at: string
          emoji: string | null
          id: string
          item_count: number
          name: string
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string | null
          id?: string
          item_count?: number
          name: string
          position?: number
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string | null
          id?: string
          item_count?: number
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_folders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "library_folders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_bounty_pledges: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          is_anonymous: boolean
          meta_bounty_id: string
          note: string | null
          pledger_id: string
          status: string
          sub_definition_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          is_anonymous?: boolean
          meta_bounty_id: string
          note?: string | null
          pledger_id: string
          status?: string
          sub_definition_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          is_anonymous?: boolean
          meta_bounty_id?: string
          note?: string | null
          pledger_id?: string
          status?: string
          sub_definition_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_bounty_pledges_meta_bounty_id_fkey"
            columns: ["meta_bounty_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_bounty_pledges_sub_def_fkey"
            columns: ["sub_definition_id"]
            isOneToOne: false
            referencedRelation: "meta_bounty_sub_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_bounty_sub_definitions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          meta_bounty_id: string
          position: number
          spawn_threshold_pct: number
          spawned_bounty_id: string | null
          target_amount: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          meta_bounty_id: string
          position?: number
          spawn_threshold_pct?: number
          spawned_bounty_id?: string | null
          target_amount: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          meta_bounty_id?: string
          position?: number
          spawn_threshold_pct?: number
          spawned_bounty_id?: string | null
          target_amount?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_bounty_sub_definitions_meta_bounty_id_fkey"
            columns: ["meta_bounty_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_bounty_sub_definitions_spawned_bounty_id_fkey"
            columns: ["spawned_bounty_id"]
            isOneToOne: false
            referencedRelation: "content_items"
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
      node_types: {
        Row: {
          category: string
          colour: string
          copyable: boolean
          icon: string | null
          is_active: boolean
          key: string
          label: string
          renderer: string
          schema: Json
          sort: number
        }
        Insert: {
          category: string
          colour: string
          copyable?: boolean
          icon?: string | null
          is_active?: boolean
          key: string
          label: string
          renderer: string
          schema?: Json
          sort?: number
        }
        Update: {
          category?: string
          colour?: string
          copyable?: boolean
          icon?: string | null
          is_active?: boolean
          key?: string
          label?: string
          renderer?: string
          schema?: Json
          sort?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          collection_id: string | null
          content_id: string | null
          created_at: string
          id: string
          is_read: boolean
          metadata: Json | null
          notification_type: string
          project_id: string | null
          read_at: string | null
          recipient_id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          collection_id?: string | null
          content_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          notification_type: string
          project_id?: string | null
          read_at?: string | null
          recipient_id: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          collection_id?: string | null
          content_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          notification_type?: string
          project_id?: string | null
          read_at?: string | null
          recipient_id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
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
      perks: {
        Row: {
          description: string
          effect_key: string
          icon_name: string
          is_active: boolean
          name: string
          slug: string
          tier: number
          track: string
        }
        Insert: {
          description: string
          effect_key: string
          icon_name?: string
          is_active?: boolean
          name: string
          slug: string
          tier: number
          track: string
        }
        Update: {
          description?: string
          effect_key?: string
          icon_name?: string
          is_active?: boolean
          name?: string
          slug?: string
          tier?: number
          track?: string
        }
        Relationships: []
      }
      post_lineage: {
        Row: {
          created_at: string
          parent_post_id: string
          post_id: string
          root_post_id: string
        }
        Insert: {
          created_at?: string
          parent_post_id: string
          post_id: string
          root_post_id: string
        }
        Update: {
          created_at?: string
          parent_post_id?: string
          post_id?: string
          root_post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_lineage_parent_post_id_fkey"
            columns: ["parent_post_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_lineage_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_lineage_root_post_id_fkey"
            columns: ["root_post_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      post_view_log: {
        Row: {
          id: string
          is_bot_or_crawler: boolean
          post_id: string
          referrer: string | null
          user_agent: string | null
          viewed_at: string
          viewer_id: string | null
        }
        Insert: {
          id?: string
          is_bot_or_crawler?: boolean
          post_id: string
          referrer?: string | null
          user_agent?: string | null
          viewed_at?: string
          viewer_id?: string | null
        }
        Update: {
          id?: string
          is_bot_or_crawler?: boolean
          post_id?: string
          referrer?: string | null
          user_agent?: string | null
          viewed_at?: string
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_view_log_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      primitive_comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          reaction: string
          reactor_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          reaction: string
          reactor_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          reaction?: string
          reactor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "primitive_comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "primitive_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      primitive_comments: {
        Row: {
          anchor_id: string
          anchor_type: string
          author_id: string
          body: Json
          body_text: string
          created_at: string
          deleted_at: string | null
          id: string
          is_edited: boolean
          parent_comment_id: string | null
          reply_count: number
          updated_at: string
        }
        Insert: {
          anchor_id: string
          anchor_type: string
          author_id: string
          body?: Json
          body_text?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_edited?: boolean
          parent_comment_id?: string | null
          reply_count?: number
          updated_at?: string
        }
        Update: {
          anchor_id?: string
          anchor_type?: string
          author_id?: string
          body?: Json
          body_text?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_edited?: boolean
          parent_comment_id?: string | null
          reply_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "primitive_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "primitive_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          bounty_lifetime_acceptances: number
          bounty_lifetime_submissions: number
          bounty_lifetime_votes_received: number
          bounty_solutions_accepted: number
          bounty_solutions_submitted: number
          bounty_solver_acceptance_rate: number | null
          bounty_total_reward_earned: number
          created_at: string
          curator_application_status: string | null
          derived_bio: string | null
          display_name: string | null
          follower_count: number
          following_count: number
          id: string
          is_admin: boolean
          is_creator: boolean
          is_curator: boolean | null
          is_private: boolean
          is_trusted_solver: boolean
          is_verified: boolean
          joined_at: string
          last_derived_at: string | null
          level: string
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
          banner_url?: string | null
          bio?: string | null
          bounty_lifetime_acceptances?: number
          bounty_lifetime_submissions?: number
          bounty_lifetime_votes_received?: number
          bounty_solutions_accepted?: number
          bounty_solutions_submitted?: number
          bounty_solver_acceptance_rate?: number | null
          bounty_total_reward_earned?: number
          created_at?: string
          curator_application_status?: string | null
          derived_bio?: string | null
          display_name?: string | null
          follower_count?: number
          following_count?: number
          id: string
          is_admin?: boolean
          is_creator?: boolean
          is_curator?: boolean | null
          is_private?: boolean
          is_trusted_solver?: boolean
          is_verified?: boolean
          joined_at?: string
          last_derived_at?: string | null
          level?: string
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
          banner_url?: string | null
          bio?: string | null
          bounty_lifetime_acceptances?: number
          bounty_lifetime_submissions?: number
          bounty_lifetime_votes_received?: number
          bounty_solutions_accepted?: number
          bounty_solutions_submitted?: number
          bounty_solver_acceptance_rate?: number | null
          bounty_total_reward_earned?: number
          created_at?: string
          curator_application_status?: string | null
          derived_bio?: string | null
          display_name?: string | null
          follower_count?: number
          following_count?: number
          id?: string
          is_admin?: boolean
          is_creator?: boolean
          is_curator?: boolean | null
          is_private?: boolean
          is_trusted_solver?: boolean
          is_verified?: boolean
          joined_at?: string
          last_derived_at?: string | null
          level?: string
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "projects_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_progress: {
        Row: {
          completed_at: string | null
          first_read_at: string
          last_progress_pct: number
          last_read_at: string
          post_id: string
          reader_id: string
        }
        Insert: {
          completed_at?: string | null
          first_read_at?: string
          last_progress_pct?: number
          last_read_at?: string
          post_id: string
          reader_id: string
        }
        Update: {
          completed_at?: string | null
          first_read_at?: string
          last_progress_pct?: number
          last_read_at?: string
          post_id?: string
          reader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_progress_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      reblog_bookmarks: {
        Row: {
          bookmarker_id: string
          created_at: string
          reblog_id: string
        }
        Insert: {
          bookmarker_id: string
          created_at?: string
          reblog_id: string
        }
        Update: {
          bookmarker_id?: string
          created_at?: string
          reblog_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reblog_bookmarks_reblog_id_fkey"
            columns: ["reblog_id"]
            isOneToOne: false
            referencedRelation: "reblogs"
            referencedColumns: ["id"]
          },
        ]
      }
      reblog_likes: {
        Row: {
          created_at: string
          liker_id: string
          reblog_id: string
        }
        Insert: {
          created_at?: string
          liker_id: string
          reblog_id: string
        }
        Update: {
          created_at?: string
          liker_id?: string
          reblog_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reblog_likes_reblog_id_fkey"
            columns: ["reblog_id"]
            isOneToOne: false
            referencedRelation: "reblogs"
            referencedColumns: ["id"]
          },
        ]
      }
      reblog_reports: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          reblog_id: string
          reporter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          reblog_id: string
          reporter_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          reblog_id?: string
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reblog_reports_reblog_id_fkey"
            columns: ["reblog_id"]
            isOneToOne: false
            referencedRelation: "reblogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reblog_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reblog_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reblogs: {
        Row: {
          bookmark_count: number
          comment_count: number
          created_at: string
          deleted_at: string | null
          excerpt_source_block_id: string | null
          excerpt_source_block_type_label: string | null
          excerpt_text: string | null
          excerpt_text_hash: string | null
          hidden_at: string | null
          id: string
          is_self_reblog: boolean
          like_count: number
          media_kind: string
          media_thumbnail_url: string | null
          media_url: string | null
          original_post_id: string
          parent_reblog_id: string | null
          reblog_count: number
          reblogger_id: string
          report_count: number
          root_original_post_id: string
          slug: string
          text: string | null
          updated_at: string
        }
        Insert: {
          bookmark_count?: number
          comment_count?: number
          created_at?: string
          deleted_at?: string | null
          excerpt_source_block_id?: string | null
          excerpt_source_block_type_label?: string | null
          excerpt_text?: string | null
          excerpt_text_hash?: string | null
          hidden_at?: string | null
          id?: string
          is_self_reblog?: boolean
          like_count?: number
          media_kind?: string
          media_thumbnail_url?: string | null
          media_url?: string | null
          original_post_id: string
          parent_reblog_id?: string | null
          reblog_count?: number
          reblogger_id: string
          report_count?: number
          root_original_post_id: string
          slug: string
          text?: string | null
          updated_at?: string
        }
        Update: {
          bookmark_count?: number
          comment_count?: number
          created_at?: string
          deleted_at?: string | null
          excerpt_source_block_id?: string | null
          excerpt_source_block_type_label?: string | null
          excerpt_text?: string | null
          excerpt_text_hash?: string | null
          hidden_at?: string | null
          id?: string
          is_self_reblog?: boolean
          like_count?: number
          media_kind?: string
          media_thumbnail_url?: string | null
          media_url?: string | null
          original_post_id?: string
          parent_reblog_id?: string | null
          reblog_count?: number
          reblogger_id?: string
          report_count?: number
          root_original_post_id?: string
          slug?: string
          text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reblogs_excerpt_source_block_id_fkey"
            columns: ["excerpt_source_block_id"]
            isOneToOne: false
            referencedRelation: "content_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reblogs_original_post_id_fkey"
            columns: ["original_post_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reblogs_parent_reblog_id_fkey"
            columns: ["parent_reblog_id"]
            isOneToOne: false
            referencedRelation: "reblogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reblogs_root_original_post_id_fkey"
            columns: ["root_original_post_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_splits: {
        Row: {
          content_id: string | null
          created_at: string | null
          id: string
          is_contested: boolean
          percentage: number
          project_id: string | null
          recipient_id: string
          set_by: string
        }
        Insert: {
          content_id?: string | null
          created_at?: string | null
          id?: string
          is_contested?: boolean
          percentage: number
          project_id?: string | null
          recipient_id: string
          set_by: string
        }
        Update: {
          content_id?: string | null
          created_at?: string | null
          id?: string
          is_contested?: boolean
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "service_listings_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      solution_acceptance_log: {
        Row: {
          accepted_at: string
          bounty_author_id: string
          bounty_id: string
          id: string
          slot_id: string
          slot_kind: string
          solution_id: string
          solver_id: string
        }
        Insert: {
          accepted_at?: string
          bounty_author_id: string
          bounty_id: string
          id?: string
          slot_id: string
          slot_kind: string
          solution_id: string
          solver_id: string
        }
        Update: {
          accepted_at?: string
          bounty_author_id?: string
          bounty_id?: string
          id?: string
          slot_id?: string
          slot_kind?: string
          solution_id?: string
          solver_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solution_acceptance_log_bounty_id_fkey"
            columns: ["bounty_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solution_acceptance_log_solution_id_fkey"
            columns: ["solution_id"]
            isOneToOne: false
            referencedRelation: "solutions"
            referencedColumns: ["id"]
          },
        ]
      }
      solution_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          parent_comment_id: string | null
          solution_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          solution_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          solution_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solution_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "solution_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solution_comments_solution_id_fkey"
            columns: ["solution_id"]
            isOneToOne: false
            referencedRelation: "solutions"
            referencedColumns: ["id"]
          },
        ]
      }
      solution_votes: {
        Row: {
          created_at: string
          id: string
          solution_id: string
          vote_kind: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          solution_id: string
          vote_kind: string
          voter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          solution_id?: string
          vote_kind?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solution_votes_solution_id_fkey"
            columns: ["solution_id"]
            isOneToOne: false
            referencedRelation: "solutions"
            referencedColumns: ["id"]
          },
        ]
      }
      solutions: {
        Row: {
          accepted_at: string | null
          bounty_id: string
          content_payload: Json
          created_at: string
          i_would_implement_count: number
          id: string
          slot_id: string
          slot_kind: string
          solver_id: string
          solver_note: string | null
          status: string
          submitted_at: string | null
          updated_at: string
          vote_count: number
        }
        Insert: {
          accepted_at?: string | null
          bounty_id: string
          content_payload?: Json
          created_at?: string
          i_would_implement_count?: number
          id?: string
          slot_id: string
          slot_kind: string
          solver_id: string
          solver_note?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          vote_count?: number
        }
        Update: {
          accepted_at?: string | null
          bounty_id?: string
          content_payload?: Json
          created_at?: string
          i_would_implement_count?: number
          id?: string
          slot_id?: string
          slot_kind?: string
          solver_id?: string
          solver_note?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          vote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "solutions_bounty_id_fkey"
            columns: ["bounty_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      solver_leaderboard_cache: {
        Row: {
          acceptance_count: number
          bounty_id: string
          computed_at: string
          id: string
          rank: number
          submission_count: number
          user_id: string
          vote_total: number
        }
        Insert: {
          acceptance_count?: number
          bounty_id: string
          computed_at?: string
          id?: string
          rank: number
          submission_count?: number
          user_id: string
          vote_total?: number
        }
        Update: {
          acceptance_count?: number
          bounty_id?: string
          computed_at?: string
          id?: string
          rank?: number
          submission_count?: number
          user_id?: string
          vote_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "solver_leaderboard_cache_bounty_id_fkey"
            columns: ["bounty_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_days: {
        Row: {
          date: string
          kind: string
          user_id: string
        }
        Insert: {
          date: string
          kind?: string
          user_id: string
        }
        Update: {
          date?: string
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streak_days_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "streak_days_user_id_fkey"
            columns: ["user_id"]
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
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
      tool_compatibility: {
        Row: {
          content_id: string
          id: string
          notes: string | null
          status: string
          tool_name: string
          tool_version: string | null
          verified_at: string
          verified_by: string | null
        }
        Insert: {
          content_id: string
          id?: string
          notes?: string | null
          status?: string
          tool_name: string
          tool_version?: string | null
          verified_at?: string
          verified_by?: string | null
        }
        Update: {
          content_id?: string
          id?: string
          notes?: string | null
          status?: string
          tool_name?: string
          tool_version?: string | null
          verified_at?: string
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tool_compatibility_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_compatibility_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tool_compatibility_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_key: string
          created_at: string
          description: string | null
          earned_at: string
          id: string
          metadata: Json
          revealed_at: string | null
          state: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          badge_key: string
          created_at?: string
          description?: string | null
          earned_at?: string
          id?: string
          metadata?: Json
          revealed_at?: string | null
          state?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          badge_key?: string
          created_at?: string
          description?: string | null
          earned_at?: string
          id?: string
          metadata?: Json
          revealed_at?: string | null
          state?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
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
          folder_id: string | null
          has_update: boolean | null
          id: string
          last_seen_version: string | null
          project_id: string | null
          user_id: string
        }
        Insert: {
          added_at?: string | null
          content_id: string
          folder_id?: string | null
          has_update?: boolean | null
          id?: string
          last_seen_version?: string | null
          project_id?: string | null
          user_id: string
        }
        Update: {
          added_at?: string | null
          content_id?: string
          folder_id?: string | null
          has_update?: boolean | null
          id?: string
          last_seen_version?: string | null
          project_id?: string | null
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
            foreignKeyName: "user_library_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "library_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_library_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_library_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
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
      user_perks: {
        Row: {
          earned_at: string
          perk_slug: string
          user_id: string
        }
        Insert: {
          earned_at?: string
          perk_slug: string
          user_id: string
        }
        Update: {
          earned_at?: string
          perk_slug?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_perks_perk_slug_fkey"
            columns: ["perk_slug"]
            isOneToOne: false
            referencedRelation: "perks"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "user_perks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_perks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_progress: {
        Row: {
          counters: Json
          created_at: string
          depth_revealed_at: string | null
          eligible_at: string | null
          freezes_used_month: number
          last_active_date: string | null
          last_respec_at: string | null
          level: number
          quest_state: Json
          streak_best: number
          streak_current: number
          streak_days: number
          track: string | null
          track_xp: number
          updated_at: string
          user_id: string
          welcome_xp_shown_at: string | null
          xp_total: number
        }
        Insert: {
          counters?: Json
          created_at?: string
          depth_revealed_at?: string | null
          eligible_at?: string | null
          freezes_used_month?: number
          last_active_date?: string | null
          last_respec_at?: string | null
          level?: number
          quest_state?: Json
          streak_best?: number
          streak_current?: number
          streak_days?: number
          track?: string | null
          track_xp?: number
          updated_at?: string
          user_id: string
          welcome_xp_shown_at?: string | null
          xp_total?: number
        }
        Update: {
          counters?: Json
          created_at?: string
          depth_revealed_at?: string | null
          eligible_at?: string | null
          freezes_used_month?: number
          last_active_date?: string | null
          last_respec_at?: string | null
          level?: number
          quest_state?: Json
          streak_best?: number
          streak_current?: number
          streak_days?: number
          track?: string | null
          track_xp?: number
          updated_at?: string
          user_id?: string
          welcome_xp_shown_at?: string | null
          xp_total?: number
        }
        Relationships: []
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
            referencedRelation: "profile_stats"
            referencedColumns: ["user_id"]
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
      xp_events: {
        Row: {
          amount: number
          created_at: string
          id: string
          metadata: Json
          reason: string
          source_id: string | null
          source_type: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          metadata?: Json
          reason: string
          source_id?: string | null
          source_type?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string
          source_id?: string | null
          source_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      profile_stats: {
        Row: {
          avg_reading_minutes: number | null
          blogs_count: number | null
          blueprints_count: number | null
          bounties_posted: number | null
          bounties_solved: number | null
          total_views: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      award_xp: {
        Args: {
          _amount: number
          _metadata?: Json
          _reason: string
          _source_id?: string
          _source_type?: string
          _user_id: string
        }
        Returns: Json
      }
      calc_level_from_xp: { Args: { _xp: number }; Returns: number }
      can_delete_primitive_comment: {
        Args: { _comment_id: string; _user_id: string }
        Returns: boolean
      }
      claim_challenge: { Args: { _challenge_id: string }; Returns: Json }
      gallery_facets: { Args: { thresholds?: Json }; Returns: Json }
      get_email_by_username: { Args: { _username: string }; Returns: string }
      get_post_lineage: {
        Args: { _root_id: string }
        Returns: {
          creator_id: string
          depth: number
          parent_post_id: string
          post_id: string
          root_post_id: string
          slug: string
          title: string
        }[]
      }
      get_quest_state: { Args: { _user_id?: string }; Returns: Json }
      get_visible_surfaces: { Args: { _user_id?: string }; Returns: Json }
      has_perk: { Args: { _slug: string; _user_id: string }; Returns: boolean }
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
      is_thread_admin: {
        Args: { _thread_id: string; _user_id: string }
        Returns: boolean
      }
      is_thread_member: {
        Args: { _thread_id: string; _user_id: string }
        Returns: boolean
      }
      mark_depth_revealed: { Args: never; Returns: string }
      mark_welcome_xp_shown: { Args: never; Returns: string }
      record_daily_activity: { Args: never; Returns: Json }
      respec_track: { Args: { _track: string }; Returns: string }
      semantic_search: {
        Args: { match_count: number; query_embedding: string }
        Returns: {
          id: string
          similarity: number
          title: string
        }[]
      }
      set_user_track: { Args: { _track: string }; Returns: undefined }
      soft_delete_primitive_comment: {
        Args: { _comment_id: string }
        Returns: undefined
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
