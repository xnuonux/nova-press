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
      activity_log: {
        Row: {
          action: string
          agent_type: string
          created_at: string | null
          detail: Json | null
          id: string
          level: string | null
          summary: string
          user_id: string | null
        }
        Insert: {
          action: string
          agent_type: string
          created_at?: string | null
          detail?: Json | null
          id?: string
          level?: string | null
          summary: string
          user_id?: string | null
        }
        Update: {
          action?: string
          agent_type?: string
          created_at?: string | null
          detail?: Json | null
          id?: string
          level?: string | null
          summary?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ad_campaigns: {
        Row: {
          campaign_id: string | null
          clicks: number | null
          created_at: string | null
          daily_budget: number | null
          id: string
          impressions: number | null
          last_synced_at: string | null
          name: string
          objective: string | null
          platform: string | null
          spend: number | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          clicks?: number | null
          created_at?: string | null
          daily_budget?: number | null
          id?: string
          impressions?: number | null
          last_synced_at?: string | null
          name: string
          objective?: string | null
          platform?: string | null
          spend?: number | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          clicks?: number | null
          created_at?: string | null
          daily_budget?: number | null
          id?: string
          impressions?: number | null
          last_synced_at?: string | null
          name?: string
          objective?: string | null
          platform?: string | null
          spend?: number | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      affiliate_links: {
        Row: {
          clicks: number | null
          commission_rate: number | null
          commission_type: string | null
          conversions: number | null
          created_at: string | null
          destination_url: string
          id: string
          name: string
          program: string | null
          revenue_cents: number | null
          slug: string
          status: string | null
        }
        Insert: {
          clicks?: number | null
          commission_rate?: number | null
          commission_type?: string | null
          conversions?: number | null
          created_at?: string | null
          destination_url: string
          id?: string
          name: string
          program?: string | null
          revenue_cents?: number | null
          slug: string
          status?: string | null
        }
        Update: {
          clicks?: number | null
          commission_rate?: number | null
          commission_type?: string | null
          conversions?: number | null
          created_at?: string | null
          destination_url?: string
          id?: string
          name?: string
          program?: string | null
          revenue_cents?: number | null
          slug?: string
          status?: string | null
        }
        Relationships: []
      }
      affiliate_posts: {
        Row: {
          affiliate_url: string
          clicks: number | null
          id: string
          posted_at: string | null
          product_name: string
          program: string | null
          revenue: number | null
          tweet_id: string | null
          tweet_text: string | null
        }
        Insert: {
          affiliate_url: string
          clicks?: number | null
          id?: string
          posted_at?: string | null
          product_name: string
          program?: string | null
          revenue?: number | null
          tweet_id?: string | null
          tweet_text?: string | null
        }
        Update: {
          affiliate_url?: string
          clicks?: number | null
          id?: string
          posted_at?: string | null
          product_name?: string
          program?: string | null
          revenue?: number | null
          tweet_id?: string | null
          tweet_text?: string | null
        }
        Relationships: []
      }
      agent_actions: {
        Row: {
          action_type: string
          agent: string
          cognitive_function: string | null
          completed_at: string | null
          context_referenced: boolean | null
          description: string
          duration_ms: number | null
          goal_id: string | null
          handed_to: string | null
          id: string
          output_length: number | null
          parent_action_id: string | null
          rating: number | null
          result: string | null
          retry_count: number | null
          search_results_count: number | null
          search_used: boolean | null
          started_at: string | null
          status: string
          tool_name: string | null
          user_id: string
        }
        Insert: {
          action_type?: string
          agent: string
          cognitive_function?: string | null
          completed_at?: string | null
          context_referenced?: boolean | null
          description: string
          duration_ms?: number | null
          goal_id?: string | null
          handed_to?: string | null
          id?: string
          output_length?: number | null
          parent_action_id?: string | null
          rating?: number | null
          result?: string | null
          retry_count?: number | null
          search_results_count?: number | null
          search_used?: boolean | null
          started_at?: string | null
          status?: string
          tool_name?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          agent?: string
          cognitive_function?: string | null
          completed_at?: string | null
          context_referenced?: boolean | null
          description?: string
          duration_ms?: number | null
          goal_id?: string | null
          handed_to?: string | null
          id?: string
          output_length?: number | null
          parent_action_id?: string | null
          rating?: number | null
          result?: string | null
          retry_count?: number | null
          search_results_count?: number | null
          search_used?: boolean | null
          started_at?: string | null
          status?: string
          tool_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_actions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "agent_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_actions_parent_action_id_fkey"
            columns: ["parent_action_id"]
            isOneToOne: false
            referencedRelation: "agent_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_context: {
        Row: {
          agent: string
          confidence: number | null
          content: string
          context_type: string
          created_at: string | null
          expires_at: string | null
          id: string
          source_conversation: string | null
          supersedes: string | null
          tags: string[] | null
          user_id: string
        }
        Insert: {
          agent: string
          confidence?: number | null
          content: string
          context_type: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          source_conversation?: string | null
          supersedes?: string | null
          tags?: string[] | null
          user_id: string
        }
        Update: {
          agent?: string
          confidence?: number | null
          content?: string
          context_type?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          source_conversation?: string | null
          supersedes?: string | null
          tags?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      agent_context_archive: {
        Row: {
          agent: string
          archive_reason: string | null
          archived_at: string | null
          confidence: number | null
          content: string
          context_type: string
          id: string
          original_created_at: string | null
          user_id: string
        }
        Insert: {
          agent: string
          archive_reason?: string | null
          archived_at?: string | null
          confidence?: number | null
          content: string
          context_type: string
          id?: string
          original_created_at?: string | null
          user_id: string
        }
        Update: {
          agent?: string
          archive_reason?: string | null
          archived_at?: string | null
          confidence?: number | null
          content?: string
          context_type?: string
          id?: string
          original_created_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      agent_cycles: {
        Row: {
          agents_ran: Json | null
          completed_at: string | null
          created_at: string | null
          cycle_type: string
          error: string | null
          fuel_used: number | null
          id: string
          plan: Json | null
          started_at: string | null
          status: string
          summary: string | null
          tasks_created: number | null
          tokens_used: number | null
          user_id: string | null
        }
        Insert: {
          agents_ran?: Json | null
          completed_at?: string | null
          created_at?: string | null
          cycle_type: string
          error?: string | null
          fuel_used?: number | null
          id?: string
          plan?: Json | null
          started_at?: string | null
          status?: string
          summary?: string | null
          tasks_created?: number | null
          tokens_used?: number | null
          user_id?: string | null
        }
        Update: {
          agents_ran?: Json | null
          completed_at?: string | null
          created_at?: string | null
          cycle_type?: string
          error?: string | null
          fuel_used?: number | null
          id?: string
          plan?: Json | null
          started_at?: string | null
          status?: string
          summary?: string | null
          tasks_created?: number | null
          tokens_used?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      agent_evolution_events: {
        Row: {
          after_value: Json | null
          agent_id: string
          before_value: Json | null
          created_at: string
          event_type: string
          id: string
          rationale: string | null
          source_id: string | null
          source_kind: string | null
          user_id: string | null
        }
        Insert: {
          after_value?: Json | null
          agent_id: string
          before_value?: Json | null
          created_at?: string
          event_type: string
          id?: string
          rationale?: string | null
          source_id?: string | null
          source_kind?: string | null
          user_id?: string | null
        }
        Update: {
          after_value?: Json | null
          agent_id?: string
          before_value?: Json | null
          created_at?: string
          event_type?: string
          id?: string
          rationale?: string | null
          source_id?: string | null
          source_kind?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_evolution_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_evolution_summary"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "agent_evolution_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["agent_id"]
          },
        ]
      }
      agent_goals: {
        Row: {
          agent: string
          created_at: string | null
          current_step: number | null
          deadline: string | null
          description: string | null
          id: string
          last_action_at: string | null
          next_action_at: string | null
          priority: number
          status: string
          steps: Json | null
          title: string
          total_steps: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agent?: string
          created_at?: string | null
          current_step?: number | null
          deadline?: string | null
          description?: string | null
          id?: string
          last_action_at?: string | null
          next_action_at?: string | null
          priority?: number
          status?: string
          steps?: Json | null
          title: string
          total_steps?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agent?: string
          created_at?: string | null
          current_step?: number | null
          deadline?: string | null
          description?: string | null
          id?: string
          last_action_at?: string | null
          next_action_at?: string | null
          priority?: number
          status?: string
          steps?: Json | null
          title?: string
          total_steps?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      agent_learnings: {
        Row: {
          agent: string
          category: string
          created_at: string | null
          id: string
          insight: string
          is_simulated: boolean
          last_used_at: string | null
          relevance_score: number | null
          source: string | null
          times_referenced: number | null
          user_id: string | null
        }
        Insert: {
          agent: string
          category?: string
          created_at?: string | null
          id?: string
          insight: string
          is_simulated?: boolean
          last_used_at?: string | null
          relevance_score?: number | null
          source?: string | null
          times_referenced?: number | null
          user_id?: string | null
        }
        Update: {
          agent?: string
          category?: string
          created_at?: string | null
          id?: string
          insight?: string
          is_simulated?: boolean
          last_used_at?: string | null
          relevance_score?: number | null
          source?: string | null
          times_referenced?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      agent_metrics: {
        Row: {
          agent: string
          avg_output_depth: number | null
          avg_response_time_ms: number | null
          completed_actions: number | null
          completion_rate: number | null
          created_at: string | null
          failed_actions: number | null
          id: string
          metric_date: string
          negative_ratings: number | null
          output_consistency: number | null
          overall_score: number | null
          positive_ratings: number | null
          retry_rate: number | null
          search_utilization: number | null
          total_actions: number | null
          total_ratings: number | null
          user_satisfaction: number | null
        }
        Insert: {
          agent: string
          avg_output_depth?: number | null
          avg_response_time_ms?: number | null
          completed_actions?: number | null
          completion_rate?: number | null
          created_at?: string | null
          failed_actions?: number | null
          id?: string
          metric_date?: string
          negative_ratings?: number | null
          output_consistency?: number | null
          overall_score?: number | null
          positive_ratings?: number | null
          retry_rate?: number | null
          search_utilization?: number | null
          total_actions?: number | null
          total_ratings?: number | null
          user_satisfaction?: number | null
        }
        Update: {
          agent?: string
          avg_output_depth?: number | null
          avg_response_time_ms?: number | null
          completed_actions?: number | null
          completion_rate?: number | null
          created_at?: string | null
          failed_actions?: number | null
          id?: string
          metric_date?: string
          negative_ratings?: number | null
          output_consistency?: number | null
          overall_score?: number | null
          positive_ratings?: number | null
          retry_rate?: number | null
          search_utilization?: number | null
          total_actions?: number | null
          total_ratings?: number | null
          user_satisfaction?: number | null
        }
        Relationships: []
      }
      agent_runs: {
        Row: {
          agent_type: string
          cost_usd: number | null
          duration_secs: number | null
          ended_at: string | null
          id: string
          input_context: Json | null
          output: Json | null
          raw_log: string | null
          run_type: string | null
          started_at: string | null
          status: string | null
          task_id: string | null
          tokens_used: number | null
          user_id: string | null
        }
        Insert: {
          agent_type: string
          cost_usd?: number | null
          duration_secs?: number | null
          ended_at?: string | null
          id?: string
          input_context?: Json | null
          output?: Json | null
          raw_log?: string | null
          run_type?: string | null
          started_at?: string | null
          status?: string | null
          task_id?: string | null
          tokens_used?: number | null
          user_id?: string | null
        }
        Update: {
          agent_type?: string
          cost_usd?: number | null
          duration_secs?: number | null
          ended_at?: string | null
          id?: string
          input_context?: Json | null
          output?: Json | null
          raw_log?: string | null
          run_type?: string | null
          started_at?: string | null
          status?: string | null
          task_id?: string | null
          tokens_used?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "business_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_spectral_profiles: {
        Row: {
          agent: string
          base_period_hours: number
          coefficients: Json
          created_at: string
          friction_profile: Json
          profile_kind: string
          updated_at: string
        }
        Insert: {
          agent: string
          base_period_hours?: number
          coefficients?: Json
          created_at?: string
          friction_profile?: Json
          profile_kind?: string
          updated_at?: string
        }
        Update: {
          agent?: string
          base_period_hours?: number
          coefficients?: Json
          created_at?: string
          friction_profile?: Json
          profile_kind?: string
          updated_at?: string
        }
        Relationships: []
      }
      agents: {
        Row: {
          agent_id: string
          color_hex: string | null
          core_block: string
          created_at: string
          display_name: string
          emoji: string | null
          evolved_block: Json
          role_label: string | null
          updated_at: string
          voice_anchor: string | null
        }
        Insert: {
          agent_id: string
          color_hex?: string | null
          core_block?: string
          created_at?: string
          display_name: string
          emoji?: string | null
          evolved_block?: Json
          role_label?: string | null
          updated_at?: string
          voice_anchor?: string | null
        }
        Update: {
          agent_id?: string
          color_hex?: string | null
          core_block?: string
          created_at?: string
          display_name?: string
          emoji?: string | null
          evolved_block?: Json
          role_label?: string | null
          updated_at?: string
          voice_anchor?: string | null
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          path: string | null
          session_id: string | null
          site_id: string | null
          user_id: string | null
          value: number | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          path?: string | null
          session_id?: string | null
          site_id?: string | null
          user_id?: string | null
          value?: number | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          path?: string | null
          session_id?: string | null
          site_id?: string | null
          user_id?: string | null
          value?: number | null
        }
        Relationships: []
      }
      analytics_summary: {
        Row: {
          avg_session_visits: number | null
          bounce_rate: number | null
          created_at: string | null
          date: string
          id: string
          revenue_cents: number | null
          signups: number | null
          site_id: string
          top_countries: Json | null
          top_pages: Json | null
          top_referrers: Json | null
          total_visits: number | null
          unique_visitors: number | null
        }
        Insert: {
          avg_session_visits?: number | null
          bounce_rate?: number | null
          created_at?: string | null
          date: string
          id?: string
          revenue_cents?: number | null
          signups?: number | null
          site_id: string
          top_countries?: Json | null
          top_pages?: Json | null
          top_referrers?: Json | null
          total_visits?: number | null
          unique_visitors?: number | null
        }
        Update: {
          avg_session_visits?: number | null
          bounce_rate?: number | null
          created_at?: string | null
          date?: string
          id?: string
          revenue_cents?: number | null
          signups?: number | null
          site_id?: string
          top_countries?: Json | null
          top_pages?: Json | null
          top_referrers?: Json | null
          total_visits?: number | null
          unique_visitors?: number | null
        }
        Relationships: []
      }
      approved_perceptions: {
        Row: {
          active: boolean | null
          created_at: string
          id: string
          perception: string
          source_afterglow_id: string | null
          source_threads: Json | null
          user_id: string
          weight: number | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          id?: string
          perception: string
          source_afterglow_id?: string | null
          source_threads?: Json | null
          user_id: string
          weight?: number | null
        }
        Update: {
          active?: boolean | null
          created_at?: string
          id?: string
          perception?: string
          source_afterglow_id?: string | null
          source_threads?: Json | null
          user_id?: string
          weight?: number | null
        }
        Relationships: []
      }
      blog_authors: {
        Row: {
          article_count: number | null
          avatar_seed: string
          bio: string
          created_at: string | null
          display_name: string
          expertise: string[]
          id: string
          slug: string
          voice_prompt: string
        }
        Insert: {
          article_count?: number | null
          avatar_seed: string
          bio: string
          created_at?: string | null
          display_name: string
          expertise: string[]
          id: string
          slug: string
          voice_prompt: string
        }
        Update: {
          article_count?: number | null
          avatar_seed?: string
          bio?: string
          created_at?: string | null
          display_name?: string
          expertise?: string[]
          id?: string
          slug?: string
          voice_prompt?: string
        }
        Relationships: []
      }
      browser_sessions: {
        Row: {
          created_at: string | null
          extracted_text: string | null
          id: string
          screenshot_url: string | null
          session_id: string
          status: string | null
          target_url: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          extracted_text?: string | null
          id?: string
          screenshot_url?: string | null
          session_id: string
          status?: string | null
          target_url?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          extracted_text?: string | null
          id?: string
          screenshot_url?: string | null
          session_id?: string
          status?: string | null
          target_url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      business_health: {
        Row: {
          computed_at: string | null
          details: Json | null
          dimension: string
          id: string
          score: number | null
          user_id: string | null
          weight: number | null
        }
        Insert: {
          computed_at?: string | null
          details?: Json | null
          dimension: string
          id?: string
          score?: number | null
          user_id?: string | null
          weight?: number | null
        }
        Update: {
          computed_at?: string | null
          details?: Json | null
          dimension?: string
          id?: string
          score?: number | null
          user_id?: string | null
          weight?: number | null
        }
        Relationships: []
      }
      business_tasks: {
        Row: {
          agent_type: string
          created_at: string | null
          description: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          priority: number | null
          result_summary: string | null
          scheduled_for: string | null
          source: string | null
          status: string | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          agent_type: string
          created_at?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          priority?: number | null
          result_summary?: string | null
          scheduled_for?: string | null
          source?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          agent_type?: string
          created_at?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          priority?: number | null
          result_summary?: string | null
          scheduled_for?: string | null
          source?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      chat_attachments: {
        Row: {
          content_type: string | null
          conversation_id: string | null
          created_at: string | null
          file_id: string | null
          file_name: string | null
          file_url: string
          id: string
          message_index: number | null
          size_bytes: number | null
          user_id: string | null
        }
        Insert: {
          content_type?: string | null
          conversation_id?: string | null
          created_at?: string | null
          file_id?: string | null
          file_name?: string | null
          file_url: string
          id?: string
          message_index?: number | null
          size_bytes?: number | null
          user_id?: string | null
        }
        Update: {
          content_type?: string | null
          conversation_id?: string | null
          created_at?: string | null
          file_id?: string | null
          file_name?: string | null
          file_url?: string
          id?: string
          message_index?: number | null
          size_bytes?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_attachments_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "user_files"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_history: {
        Row: {
          id: string
          messages: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          messages?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          messages?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cinema_conversations: {
        Row: {
          active_skill: string | null
          anchor_image_url: string | null
          autopilot: boolean | null
          brief: string | null
          created_at: string | null
          elements: Json | null
          final_assets: Json | null
          id: string
          last_message_at: string | null
          messages: Json | null
          metadata: Json | null
          mode: string | null
          model_overrides: Json | null
          moment_state: Json | null
          pipeline_id: string | null
          project_id: string | null
          script: Json | null
          stage: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active_skill?: string | null
          anchor_image_url?: string | null
          autopilot?: boolean | null
          brief?: string | null
          created_at?: string | null
          elements?: Json | null
          final_assets?: Json | null
          id?: string
          last_message_at?: string | null
          messages?: Json | null
          metadata?: Json | null
          mode?: string | null
          model_overrides?: Json | null
          moment_state?: Json | null
          pipeline_id?: string | null
          project_id?: string | null
          script?: Json | null
          stage?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active_skill?: string | null
          anchor_image_url?: string | null
          autopilot?: boolean | null
          brief?: string | null
          created_at?: string | null
          elements?: Json | null
          final_assets?: Json | null
          id?: string
          last_message_at?: string | null
          messages?: Json | null
          metadata?: Json | null
          mode?: string | null
          model_overrides?: Json | null
          moment_state?: Json | null
          pipeline_id?: string | null
          project_id?: string | null
          script?: Json | null
          stage?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cinema_conversations_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "cinema_pipeline_economics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cinema_conversations_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "cinema_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      cinema_jobs: {
        Row: {
          completed_at: string | null
          compute_cost_usd: number | null
          conversation_id: string | null
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          estimated_fuel: number | null
          fuel_cost: number | null
          id: string
          inputs: Json
          job_type: string
          model_slug: string
          output_file_id: string | null
          outputs: Json | null
          parent_job_id: string | null
          priority: number | null
          project_id: string | null
          provider_request_id: string | null
          retry_count: number | null
          shot_number: number | null
          started_at: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          compute_cost_usd?: number | null
          conversation_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          estimated_fuel?: number | null
          fuel_cost?: number | null
          id?: string
          inputs: Json
          job_type: string
          model_slug: string
          output_file_id?: string | null
          outputs?: Json | null
          parent_job_id?: string | null
          priority?: number | null
          project_id?: string | null
          provider_request_id?: string | null
          retry_count?: number | null
          shot_number?: number | null
          started_at?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          compute_cost_usd?: number | null
          conversation_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          estimated_fuel?: number | null
          fuel_cost?: number | null
          id?: string
          inputs?: Json
          job_type?: string
          model_slug?: string
          output_file_id?: string | null
          outputs?: Json | null
          parent_job_id?: string | null
          priority?: number | null
          project_id?: string | null
          provider_request_id?: string | null
          retry_count?: number | null
          shot_number?: number | null
          started_at?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cinema_jobs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "cinema_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cinema_jobs_model_slug_fkey"
            columns: ["model_slug"]
            isOneToOne: false
            referencedRelation: "cinema_available_video_models"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "cinema_jobs_model_slug_fkey"
            columns: ["model_slug"]
            isOneToOne: false
            referencedRelation: "model_registry"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "cinema_jobs_output_file_id_fkey"
            columns: ["output_file_id"]
            isOneToOne: false
            referencedRelation: "user_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cinema_jobs_parent_job_id_fkey"
            columns: ["parent_job_id"]
            isOneToOne: false
            referencedRelation: "cinema_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cinema_pipelines: {
        Row: {
          active: boolean | null
          created_at: string | null
          default_settings: Json | null
          description: string | null
          estimated_cost_usd: number | null
          estimated_fuel: number | null
          id: string
          is_preset: boolean | null
          min_plan: string | null
          mode: string
          model_map: Json
          name: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          default_settings?: Json | null
          description?: string | null
          estimated_cost_usd?: number | null
          estimated_fuel?: number | null
          id?: string
          is_preset?: boolean | null
          min_plan?: string | null
          mode: string
          model_map: Json
          name: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          default_settings?: Json | null
          description?: string | null
          estimated_cost_usd?: number | null
          estimated_fuel?: number | null
          id?: string
          is_preset?: boolean | null
          min_plan?: string | null
          mode?: string
          model_map?: Json
          name?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cinema_projects: {
        Row: {
          autopilot: boolean | null
          chain_ids: string[] | null
          character_ids: string[] | null
          conversation_id: string | null
          created_at: string | null
          default_aspect_ratio: string | null
          default_model: string | null
          default_style_slug: string | null
          elements: Json | null
          final_asset_id: string | null
          id: string
          metadata: Json | null
          mode: string | null
          model_overrides: Json | null
          pipeline_id: string | null
          project_type: string | null
          script: Json | null
          slug: string | null
          stage: string | null
          status: string | null
          synopsis: string | null
          thumbnail_asset_id: string | null
          thumbnail_url: string | null
          title: string
          total_duration_seconds: number | null
          total_fuel_spent: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          autopilot?: boolean | null
          chain_ids?: string[] | null
          character_ids?: string[] | null
          conversation_id?: string | null
          created_at?: string | null
          default_aspect_ratio?: string | null
          default_model?: string | null
          default_style_slug?: string | null
          elements?: Json | null
          final_asset_id?: string | null
          id?: string
          metadata?: Json | null
          mode?: string | null
          model_overrides?: Json | null
          pipeline_id?: string | null
          project_type?: string | null
          script?: Json | null
          slug?: string | null
          stage?: string | null
          status?: string | null
          synopsis?: string | null
          thumbnail_asset_id?: string | null
          thumbnail_url?: string | null
          title: string
          total_duration_seconds?: number | null
          total_fuel_spent?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          autopilot?: boolean | null
          chain_ids?: string[] | null
          character_ids?: string[] | null
          conversation_id?: string | null
          created_at?: string | null
          default_aspect_ratio?: string | null
          default_model?: string | null
          default_style_slug?: string | null
          elements?: Json | null
          final_asset_id?: string | null
          id?: string
          metadata?: Json | null
          mode?: string | null
          model_overrides?: Json | null
          pipeline_id?: string | null
          project_type?: string | null
          script?: Json | null
          slug?: string | null
          stage?: string | null
          status?: string | null
          synopsis?: string | null
          thumbnail_asset_id?: string | null
          thumbnail_url?: string | null
          title?: string
          total_duration_seconds?: number | null
          total_fuel_spent?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cinema_projects_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "cinema_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cinema_projects_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "cinema_pipeline_economics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cinema_projects_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "cinema_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      cinema_scenes: {
        Row: {
          aspect_ratio: string | null
          character_refs: string[] | null
          created_at: string | null
          duration_seconds: number | null
          id: string
          model: string | null
          notes: string | null
          preview_generated_at: string | null
          preview_image_url: string | null
          preview_model: string | null
          project_id: string | null
          prompt: string
          rendered_at: string | null
          rendered_video_url: string | null
          scene_order: number | null
          status: string | null
          style_slug: string | null
          thumbnail_url: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          aspect_ratio?: string | null
          character_refs?: string[] | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          model?: string | null
          notes?: string | null
          preview_generated_at?: string | null
          preview_image_url?: string | null
          preview_model?: string | null
          project_id?: string | null
          prompt: string
          rendered_at?: string | null
          rendered_video_url?: string | null
          scene_order?: number | null
          status?: string | null
          style_slug?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          aspect_ratio?: string | null
          character_refs?: string[] | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          model?: string | null
          notes?: string | null
          preview_generated_at?: string | null
          preview_image_url?: string | null
          preview_model?: string | null
          project_id?: string | null
          prompt?: string
          rendered_at?: string | null
          rendered_video_url?: string | null
          scene_order?: number | null
          status?: string | null
          style_slug?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cinema_scenes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cinema_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cinema_skills: {
        Row: {
          active: boolean | null
          category: string
          created_at: string | null
          description: string
          display_name: string
          estimated_tokens_out: number | null
          id: string
          instructions: string
          invokes: Json | null
          model_tier: string | null
          name: string
          owner_agent: string
          tools_allowed: Json | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          active?: boolean | null
          category: string
          created_at?: string | null
          description: string
          display_name: string
          estimated_tokens_out?: number | null
          id?: string
          instructions: string
          invokes?: Json | null
          model_tier?: string | null
          name: string
          owner_agent: string
          tools_allowed?: Json | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          active?: boolean | null
          category?: string
          created_at?: string | null
          description?: string
          display_name?: string
          estimated_tokens_out?: number | null
          id?: string
          instructions?: string
          invokes?: Json | null
          model_tier?: string | null
          name?: string
          owner_agent?: string
          tools_allowed?: Json | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: []
      }
      cinema_skills_backup_20260421: {
        Row: {
          active: boolean | null
          category: string | null
          created_at: string | null
          description: string | null
          display_name: string | null
          estimated_tokens_out: number | null
          id: string | null
          instructions: string | null
          invokes: Json | null
          model_tier: string | null
          name: string | null
          owner_agent: string | null
          tools_allowed: Json | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          estimated_tokens_out?: number | null
          id?: string | null
          instructions?: string | null
          invokes?: Json | null
          model_tier?: string | null
          name?: string | null
          owner_agent?: string | null
          tools_allowed?: Json | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          active?: boolean | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          estimated_tokens_out?: number | null
          id?: string | null
          instructions?: string | null
          invokes?: Json | null
          model_tier?: string | null
          name?: string | null
          owner_agent?: string | null
          tools_allowed?: Json | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: []
      }
      community_patterns: {
        Row: {
          confidence: number | null
          created_at: string | null
          id: string
          pattern_key: string
          pattern_type: string
          pattern_value: Json | null
          sample_size: number | null
          updated_at: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          pattern_key: string
          pattern_type: string
          pattern_value?: Json | null
          sample_size?: number | null
          updated_at?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          pattern_key?: string
          pattern_type?: string
          pattern_value?: Json | null
          sample_size?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      company_config: {
        Row: {
          created_at: string | null
          description: string | null
          evening_cycle_hour: number | null
          github_repo: string | null
          goals: Json | null
          id: string
          industry: string | null
          kpis: Json | null
          mission: string | null
          morning_cycle_hour: number | null
          name: string
          pricing_model: Json | null
          sandbox_mode: boolean | null
          target_market: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string | null
          value_prop: string | null
          website_url: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          evening_cycle_hour?: number | null
          github_repo?: string | null
          goals?: Json | null
          id?: string
          industry?: string | null
          kpis?: Json | null
          mission?: string | null
          morning_cycle_hour?: number | null
          name: string
          pricing_model?: Json | null
          sandbox_mode?: boolean | null
          target_market?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string | null
          value_prop?: string | null
          website_url?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          evening_cycle_hour?: number | null
          github_repo?: string | null
          goals?: Json | null
          id?: string
          industry?: string | null
          kpis?: Json | null
          mission?: string | null
          morning_cycle_hour?: number | null
          name?: string
          pricing_model?: Json | null
          sandbox_mode?: boolean | null
          target_market?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string | null
          value_prop?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      competitors: {
        Row: {
          created_at: string | null
          id: string
          last_researched: string | null
          name: string
          positioning: string | null
          pricing_info: Json | null
          strengths: string[] | null
          user_id: string | null
          weaknesses: string[] | null
          website: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_researched?: string | null
          name: string
          positioning?: string | null
          pricing_info?: Json | null
          strengths?: string[] | null
          user_id?: string | null
          weaknesses?: string[] | null
          website?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_researched?: string | null
          name?: string
          positioning?: string | null
          pricing_info?: Json | null
          strengths?: string[] | null
          user_id?: string | null
          weaknesses?: string[] | null
          website?: string | null
        }
        Relationships: []
      }
      controller_params: {
        Row: {
          coupling_gain: number | null
          policy_version: string | null
          recovery_active: boolean | null
          recovery_cycles_remaining: number | null
          recovery_cycles_total: number | null
          recovery_started_at: string | null
          recovery_target_agent: string | null
          recovery_triggered_by: string | null
          sampler_temperature: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          coupling_gain?: number | null
          policy_version?: string | null
          recovery_active?: boolean | null
          recovery_cycles_remaining?: number | null
          recovery_cycles_total?: number | null
          recovery_started_at?: string | null
          recovery_target_agent?: string | null
          recovery_triggered_by?: string | null
          sampler_temperature?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          coupling_gain?: number | null
          policy_version?: string | null
          recovery_active?: boolean | null
          recovery_cycles_remaining?: number | null
          recovery_cycles_total?: number | null
          recovery_started_at?: string | null
          recovery_target_agent?: string | null
          recovery_triggered_by?: string | null
          sampler_temperature?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "controller_params_recovery_triggered_by_fkey"
            columns: ["recovery_triggered_by"]
            isOneToOne: false
            referencedRelation: "sync_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controller_params_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_core"
            referencedColumns: ["user_id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          factory_id: string | null
          id: string
          messages: Json | null
          parent_war_room_session_id: string | null
          project_id: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          factory_id?: string | null
          id?: string
          messages?: Json | null
          parent_war_room_session_id?: string | null
          project_id?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          factory_id?: string | null
          id?: string
          messages?: Json | null
          parent_war_room_session_id?: string | null
          project_id?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_dark_threads: {
        Row: {
          charge: number
          effective_charge: number | null
          first_seen: string
          id: string
          last_reinforced_at: string
          member_session_ids: string[]
          reinforcement_count: number
          status: string
          theme: string
          user_id: string
        }
        Insert: {
          charge?: number
          effective_charge?: number | null
          first_seen?: string
          id?: string
          last_reinforced_at?: string
          member_session_ids?: string[]
          reinforcement_count?: number
          status?: string
          theme: string
          user_id: string
        }
        Update: {
          charge?: number
          effective_charge?: number | null
          first_seen?: string
          id?: string
          last_reinforced_at?: string
          member_session_ids?: string[]
          reinforcement_count?: number
          status?: string
          theme?: string
          user_id?: string
        }
        Relationships: []
      }
      crew_wavefunction: {
        Row: {
          amplitudes: Json
          cycle_at: string
          excitation_total: number | null
          fidelity_canonical: number | null
          fidelity_imag_part: number | null
          fidelity_real_part: number | null
          id: string
          is_w_class: boolean | null
          max_concurrence: number | null
          mean_concurrence: number | null
          min_concurrence: number | null
          pairwise_concurrence: Json | null
          source_event: string
          source_event_id: string | null
          strongest_agent: string | null
          user_id: string
          weakest_agent: string | null
        }
        Insert: {
          amplitudes: Json
          cycle_at?: string
          excitation_total?: number | null
          fidelity_canonical?: number | null
          fidelity_imag_part?: number | null
          fidelity_real_part?: number | null
          id?: string
          is_w_class?: boolean | null
          max_concurrence?: number | null
          mean_concurrence?: number | null
          min_concurrence?: number | null
          pairwise_concurrence?: Json | null
          source_event: string
          source_event_id?: string | null
          strongest_agent?: string | null
          user_id: string
          weakest_agent?: string | null
        }
        Update: {
          amplitudes?: Json
          cycle_at?: string
          excitation_total?: number | null
          fidelity_canonical?: number | null
          fidelity_imag_part?: number | null
          fidelity_real_part?: number | null
          id?: string
          is_w_class?: boolean | null
          max_concurrence?: number | null
          mean_concurrence?: number | null
          min_concurrence?: number | null
          pairwise_concurrence?: Json | null
          source_event?: string
          source_event_id?: string | null
          strongest_agent?: string | null
          user_id?: string
          weakest_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crew_wavefunction_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_core"
            referencedColumns: ["user_id"]
          },
        ]
      }
      daily_reports: {
        Row: {
          created_at: string | null
          evening_summary: string | null
          id: string
          insights: string[] | null
          metrics_snapshot: Json | null
          morning_plan: string | null
          report_date: string
          tasks_completed: number | null
          tasks_failed: number | null
          tasks_planned: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          evening_summary?: string | null
          id?: string
          insights?: string[] | null
          metrics_snapshot?: Json | null
          morning_plan?: string | null
          report_date: string
          tasks_completed?: number | null
          tasks_failed?: number | null
          tasks_planned?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          evening_summary?: string | null
          id?: string
          insights?: string[] | null
          metrics_snapshot?: Json | null
          morning_plan?: string | null
          report_date?: string
          tasks_completed?: number | null
          tasks_failed?: number | null
          tasks_planned?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      dark_thread_spectral_state: {
        Row: {
          base_period_hours: number
          coefficients: Json
          confidence: number
          created_at: string
          dark_thread_id: string
          dominant: Json | null
          event_count: number
          harmonic_slots: number[]
          last_event_at: string | null
          recurrence_risk: number
          theme: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          base_period_hours?: number
          coefficients?: Json
          confidence?: number
          created_at?: string
          dark_thread_id: string
          dominant?: Json | null
          event_count?: number
          harmonic_slots?: number[]
          last_event_at?: string | null
          recurrence_risk?: number
          theme?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          base_period_hours?: number
          coefficients?: Json
          confidence?: number
          created_at?: string
          dark_thread_id?: string
          dominant?: Json | null
          event_count?: number
          harmonic_slots?: number[]
          last_event_at?: string | null
          recurrence_risk?: number
          theme?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dark_threads: {
        Row: {
          charge: number | null
          created_at: string | null
          firing_rate_estimate: number | null
          first_seen: string | null
          id: string
          last_reinforced: string | null
          metadata: Json
          reinforcement_count: number | null
          source_agent: string | null
          tags: string[]
          theme: string
          tier: string | null
          user_id: string | null
        }
        Insert: {
          charge?: number | null
          created_at?: string | null
          firing_rate_estimate?: number | null
          first_seen?: string | null
          id?: string
          last_reinforced?: string | null
          metadata?: Json
          reinforcement_count?: number | null
          source_agent?: string | null
          tags?: string[]
          theme: string
          tier?: string | null
          user_id?: string | null
        }
        Update: {
          charge?: number | null
          created_at?: string | null
          firing_rate_estimate?: number | null
          first_seen?: string | null
          id?: string
          last_reinforced?: string | null
          metadata?: Json
          reinforcement_count?: number | null
          source_agent?: string | null
          tags?: string[]
          theme?: string
          tier?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      decision_packets: {
        Row: {
          activation_status: string
          confidence: number | null
          context_summary: string | null
          created_at: string
          decision_key: string | null
          decision_text: string
          decision_title: string
          embedding: string | null
          embedding_dimensions: number | null
          embedding_model: string | null
          evidence: Json
          id: string
          metadata: Json
          next_actions: Json
          outcome: string | null
          owner_agent: string
          packet_type: string
          project_id: string | null
          rationale: string | null
          research_job_id: string | null
          research_paper_id: string | null
          search_text: unknown
          source_conversation_id: string | null
          source_id: string | null
          source_type: string | null
          tags: string[]
          target_agent: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activation_status?: string
          confidence?: number | null
          context_summary?: string | null
          created_at?: string
          decision_key?: string | null
          decision_text: string
          decision_title: string
          embedding?: string | null
          embedding_dimensions?: number | null
          embedding_model?: string | null
          evidence?: Json
          id?: string
          metadata?: Json
          next_actions?: Json
          outcome?: string | null
          owner_agent?: string
          packet_type?: string
          project_id?: string | null
          rationale?: string | null
          research_job_id?: string | null
          research_paper_id?: string | null
          search_text?: unknown
          source_conversation_id?: string | null
          source_id?: string | null
          source_type?: string | null
          tags?: string[]
          target_agent?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activation_status?: string
          confidence?: number | null
          context_summary?: string | null
          created_at?: string
          decision_key?: string | null
          decision_text?: string
          decision_title?: string
          embedding?: string | null
          embedding_dimensions?: number | null
          embedding_model?: string | null
          evidence?: Json
          id?: string
          metadata?: Json
          next_actions?: Json
          outcome?: string | null
          owner_agent?: string
          packet_type?: string
          project_id?: string | null
          rationale?: string | null
          research_job_id?: string | null
          research_paper_id?: string | null
          search_text?: unknown
          source_conversation_id?: string | null
          source_id?: string | null
          source_type?: string | null
          tags?: string[]
          target_agent?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      design_draft_surface_candidates: {
        Row: {
          base_cost_cents: number | null
          color_primary: string | null
          color_swatch_hex: string | null
          created_at: string
          draft_id: string
          factory_id: string
          fal_cost_total_usd: number | null
          id: string
          item_approval_note: string | null
          item_approval_status: string
          item_approved_at: string | null
          item_rejected_at: string | null
          item_rejection_reason: string | null
          margin_pct: number | null
          mockup_error: string | null
          mockup_rendered_at: string | null
          mockup_status: string | null
          mockup_template_uuid: string | null
          mockup_url: string | null
          mockup_url_back: string | null
          mockup_validation: Json | null
          multi_side: boolean | null
          night_rationale: string | null
          primary_image_url: string
          print_area_layout: Json
          printify_blueprint_id: number
          printify_provider_id: number
          printify_variant_ids: number[]
          publish_error: string | null
          published_at: string | null
          published_etsy_listing_id: string | null
          published_printify_product_id: string | null
          ready_to_publish: boolean | null
          retail_target_cents: number | null
          secondary_image_url: string | null
          size_range: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          base_cost_cents?: number | null
          color_primary?: string | null
          color_swatch_hex?: string | null
          created_at?: string
          draft_id: string
          factory_id: string
          fal_cost_total_usd?: number | null
          id?: string
          item_approval_note?: string | null
          item_approval_status?: string
          item_approved_at?: string | null
          item_rejected_at?: string | null
          item_rejection_reason?: string | null
          margin_pct?: number | null
          mockup_error?: string | null
          mockup_rendered_at?: string | null
          mockup_status?: string | null
          mockup_template_uuid?: string | null
          mockup_url?: string | null
          mockup_url_back?: string | null
          mockup_validation?: Json | null
          multi_side?: boolean | null
          night_rationale?: string | null
          primary_image_url: string
          print_area_layout?: Json
          printify_blueprint_id: number
          printify_provider_id: number
          printify_variant_ids: number[]
          publish_error?: string | null
          published_at?: string | null
          published_etsy_listing_id?: string | null
          published_printify_product_id?: string | null
          ready_to_publish?: boolean | null
          retail_target_cents?: number | null
          secondary_image_url?: string | null
          size_range?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          base_cost_cents?: number | null
          color_primary?: string | null
          color_swatch_hex?: string | null
          created_at?: string
          draft_id?: string
          factory_id?: string
          fal_cost_total_usd?: number | null
          id?: string
          item_approval_note?: string | null
          item_approval_status?: string
          item_approved_at?: string | null
          item_rejected_at?: string | null
          item_rejection_reason?: string | null
          margin_pct?: number | null
          mockup_error?: string | null
          mockup_rendered_at?: string | null
          mockup_status?: string | null
          mockup_template_uuid?: string | null
          mockup_url?: string | null
          mockup_url_back?: string | null
          mockup_validation?: Json | null
          multi_side?: boolean | null
          night_rationale?: string | null
          primary_image_url?: string
          print_area_layout?: Json
          printify_blueprint_id?: number
          printify_provider_id?: number
          printify_variant_ids?: number[]
          publish_error?: string | null
          published_at?: string | null
          published_etsy_listing_id?: string | null
          published_printify_product_id?: string | null
          ready_to_publish?: boolean | null
          retail_target_cents?: number | null
          secondary_image_url?: string | null
          size_range?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_draft_surface_candidates_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "design_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_draft_surface_candidates_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      design_drafts: {
        Row: {
          ai_disclosure: string | null
          approval_note: string | null
          approval_status: string
          approved_at: string | null
          brief_id: string | null
          core_concept: string | null
          created_at: string
          draft_payload: Json
          factory_id: string
          fail_reasons: Json
          fuel_consumed: number
          generated_by_agent: string
          id: string
          image_approval_status: string | null
          image_urls: Json
          published_listing_id: string | null
          qa_attempts: number
          qa_status: string
          rejected_at: string | null
          surface_renders: Json | null
          tags: string[]
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_disclosure?: string | null
          approval_note?: string | null
          approval_status?: string
          approved_at?: string | null
          brief_id?: string | null
          core_concept?: string | null
          created_at?: string
          draft_payload?: Json
          factory_id: string
          fail_reasons?: Json
          fuel_consumed?: number
          generated_by_agent?: string
          id?: string
          image_approval_status?: string | null
          image_urls?: Json
          published_listing_id?: string | null
          qa_attempts?: number
          qa_status?: string
          rejected_at?: string | null
          surface_renders?: Json | null
          tags?: string[]
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_disclosure?: string | null
          approval_note?: string | null
          approval_status?: string
          approved_at?: string | null
          brief_id?: string | null
          core_concept?: string | null
          created_at?: string
          draft_payload?: Json
          factory_id?: string
          fail_reasons?: Json
          fuel_consumed?: number
          generated_by_agent?: string
          id?: string
          image_approval_status?: string | null
          image_urls?: Json
          published_listing_id?: string | null
          qa_attempts?: number
          qa_status?: string
          rejected_at?: string | null
          surface_renders?: Json | null
          tags?: string[]
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_drafts_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "factory_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_drafts_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      design_styles: {
        Row: {
          created_at: string
          directive: string
          id: string
          is_archived: boolean
          is_curated: boolean
          name: string
          slug: string | null
          source: string | null
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          directive: string
          id?: string
          is_archived?: boolean
          is_curated?: boolean
          name: string
          slug?: string | null
          source?: string | null
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          directive?: string
          id?: string
          is_archived?: boolean
          is_curated?: boolean
          name?: string
          slug?: string | null
          source?: string | null
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      digital_products: {
        Row: {
          created_at: string | null
          currency: string | null
          description: string | null
          downloads: number | null
          file_url: string | null
          id: string
          metadata: Json | null
          name: string
          preview_url: string | null
          price_cents: number
          product_type: string | null
          revenue_cents: number | null
          slug: string
          status: string | null
          stripe_price_id: string | null
          stripe_product_id: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          description?: string | null
          downloads?: number | null
          file_url?: string | null
          id?: string
          metadata?: Json | null
          name: string
          preview_url?: string | null
          price_cents?: number
          product_type?: string | null
          revenue_cents?: number | null
          slug: string
          status?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          description?: string | null
          downloads?: number | null
          file_url?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          preview_url?: string | null
          price_cents?: number
          product_type?: string | null
          revenue_cents?: number | null
          slug?: string
          status?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
        }
        Relationships: []
      }
      email_campaigns: {
        Row: {
          created_at: string | null
          goal: string | null
          id: string
          name: string
          status: string | null
          target_segment: string | null
          total_opened: number | null
          total_replied: number | null
          total_sent: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          goal?: string | null
          id?: string
          name: string
          status?: string | null
          target_segment?: string | null
          total_opened?: number | null
          total_replied?: number | null
          total_sent?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          goal?: string | null
          id?: string
          name?: string
          status?: string | null
          target_segment?: string | null
          total_opened?: number | null
          total_replied?: number | null
          total_sent?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      email_delivery_log: {
        Row: {
          created_at: string | null
          email_type: string | null
          error_body: string | null
          id: string
          resend_id: string | null
          status_code: number | null
          subject: string | null
          success: boolean | null
          to_email: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email_type?: string | null
          error_body?: string | null
          id?: string
          resend_id?: string | null
          status_code?: number | null
          subject?: string | null
          success?: boolean | null
          to_email: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email_type?: string | null
          error_body?: string | null
          id?: string
          resend_id?: string | null
          status_code?: number | null
          subject?: string | null
          success?: boolean | null
          to_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          body: string | null
          campaign_id: string | null
          created_at: string | null
          external_id: string | null
          id: string
          opened_at: string | null
          prospect_id: string | null
          replied_at: string | null
          sent_at: string | null
          sequence_step: number | null
          status: string | null
          subject: string | null
          user_id: string | null
        }
        Insert: {
          body?: string | null
          campaign_id?: string | null
          created_at?: string | null
          external_id?: string | null
          id?: string
          opened_at?: string | null
          prospect_id?: string | null
          replied_at?: string | null
          sent_at?: string | null
          sequence_step?: number | null
          status?: string | null
          subject?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          campaign_id?: string | null
          created_at?: string | null
          external_id?: string | null
          id?: string
          opened_at?: string | null
          prospect_id?: string | null
          replied_at?: string | null
          sent_at?: string | null
          sequence_step?: number | null
          status?: string | null
          subject?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      episodic_memory: {
        Row: {
          action_type: string | null
          agent: string | null
          created_at: string | null
          dark_threads_active: string[] | null
          depth_at_capture: string | null
          id: string
          outcome: string | null
          salience: number
          summary: string
          user_id: string | null
          valence: number | null
        }
        Insert: {
          action_type?: string | null
          agent?: string | null
          created_at?: string | null
          dark_threads_active?: string[] | null
          depth_at_capture?: string | null
          id?: string
          outcome?: string | null
          salience: number
          summary: string
          user_id?: string | null
          valence?: number | null
        }
        Update: {
          action_type?: string | null
          agent?: string | null
          created_at?: string | null
          dark_threads_active?: string[] | null
          depth_at_capture?: string | null
          id?: string
          outcome?: string | null
          salience?: number
          summary?: string
          user_id?: string | null
          valence?: number | null
        }
        Relationships: []
      }
      factories: {
        Row: {
          config: Json
          created_at: string
          factory_type: string
          id: string
          name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          factory_type: string
          id?: string
          name: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          factory_type?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      factory_autonomy_settings: {
        Row: {
          autonomy_enabled: boolean
          created_at: string
          factory_id: string
          id: string
          last_drain_date: string | null
          max_per_drain: number
          paused: boolean
          publish_hour_utc: number
          updated_at: string
          user_id: string
        }
        Insert: {
          autonomy_enabled?: boolean
          created_at?: string
          factory_id: string
          id?: string
          last_drain_date?: string | null
          max_per_drain?: number
          paused?: boolean
          publish_hour_utc?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          autonomy_enabled?: boolean
          created_at?: string
          factory_id?: string
          id?: string
          last_drain_date?: string | null
          max_per_drain?: number
          paused?: boolean
          publish_hour_utc?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      factory_briefs: {
        Row: {
          brief: Json
          created_at: string
          cycle_count: number
          design_intent_notes: string | null
          factory_id: string
          fuel_budget: number
          id: string
          ignore_taste_signals: boolean | null
          last_cycle_started_at: string | null
          notes: string | null
          priority: number
          status: string
          target_product_line_ids: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brief?: Json
          created_at?: string
          cycle_count?: number
          design_intent_notes?: string | null
          factory_id: string
          fuel_budget?: number
          id?: string
          ignore_taste_signals?: boolean | null
          last_cycle_started_at?: string | null
          notes?: string | null
          priority?: number
          status?: string
          target_product_line_ids?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brief?: Json
          created_at?: string
          cycle_count?: number
          design_intent_notes?: string | null
          factory_id?: string
          fuel_budget?: number
          id?: string
          ignore_taste_signals?: boolean | null
          last_cycle_started_at?: string | null
          notes?: string | null
          priority?: number
          status?: string
          target_product_line_ids?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "factory_briefs_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      factory_orders: {
        Row: {
          created_at: string
          customer_name: string | null
          dollar_value: number | null
          eta: string | null
          external_id: string | null
          external_provider: string | null
          factory_id: string
          id: string
          payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          dollar_value?: number | null
          eta?: string | null
          external_id?: string | null
          external_provider?: string | null
          factory_id: string
          id?: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          dollar_value?: number | null
          eta?: string | null
          external_id?: string | null
          external_provider?: string | null
          factory_id?: string
          id?: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "factory_orders_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      factory_publish_queue: {
        Row: {
          created_at: string
          draft_id: string
          error: string | null
          factory_id: string
          id: string
          listing_url: string | null
          metadata: Json
          note: string | null
          position: number
          published_at: string | null
          queued_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          draft_id: string
          error?: string | null
          factory_id: string
          id?: string
          listing_url?: string | null
          metadata?: Json
          note?: string | null
          position?: number
          published_at?: string | null
          queued_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          draft_id?: string
          error?: string | null
          factory_id?: string
          id?: string
          listing_url?: string | null
          metadata?: Json
          note?: string | null
          position?: number
          published_at?: string | null
          queued_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      factory_skills: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          factory_id: string
          id: string
          skill_name: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          factory_id: string
          id?: string
          skill_name: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          factory_id?: string
          id?: string
          skill_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "factory_skills_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      factory_work_log: {
        Row: {
          agent_id: string | null
          content: string
          created_at: string
          factory_id: string
          id: string
          line_type: string
          metadata: Json
        }
        Insert: {
          agent_id?: string | null
          content: string
          created_at?: string
          factory_id: string
          id?: string
          line_type?: string
          metadata?: Json
        }
        Update: {
          agent_id?: string | null
          content?: string
          created_at?: string
          factory_id?: string
          id?: string
          line_type?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "factory_work_log_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      failure_logs: {
        Row: {
          agent: string
          created_at: string | null
          error_message: string | null
          failure_type: string | null
          id: string
          input_summary: string | null
          output_summary: string | null
          tool_name: string
          user_feedback: string | null
          user_id: string | null
        }
        Insert: {
          agent: string
          created_at?: string | null
          error_message?: string | null
          failure_type?: string | null
          id?: string
          input_summary?: string | null
          output_summary?: string | null
          tool_name: string
          user_feedback?: string | null
          user_id?: string | null
        }
        Update: {
          agent?: string
          created_at?: string | null
          error_message?: string | null
          failure_type?: string | null
          id?: string
          input_summary?: string | null
          output_summary?: string | null
          tool_name?: string
          user_feedback?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      form_submissions: {
        Row: {
          confirmed: boolean | null
          created_at: string | null
          email: string
          form_type: string | null
          id: string
          message: string | null
          metadata: Json | null
          name: string | null
          notified: boolean | null
          owner_id: string | null
          site_id: string
          site_name: string | null
          site_url: string | null
        }
        Insert: {
          confirmed?: boolean | null
          created_at?: string | null
          email: string
          form_type?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          name?: string | null
          notified?: boolean | null
          owner_id?: string | null
          site_id: string
          site_name?: string | null
          site_url?: string | null
        }
        Update: {
          confirmed?: boolean | null
          created_at?: string | null
          email?: string
          form_type?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          name?: string | null
          notified?: boolean | null
          owner_id?: string | null
          site_id?: string
          site_name?: string | null
          site_url?: string | null
        }
        Relationships: []
      }
      fuel_usage: {
        Row: {
          action_type: string
          created_at: string | null
          description: string | null
          factory_id: string | null
          fuel_cost: number | null
          id: string
          tool_name: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string | null
          description?: string | null
          factory_id?: string | null
          fuel_cost?: number | null
          id?: string
          tool_name?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string | null
          description?: string | null
          factory_id?: string | null
          fuel_cost?: number | null
          id?: string
          tool_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_usage_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      gc_companies: {
        Row: {
          created_at: string
          description: string | null
          domain: string | null
          id: string
          industry: string | null
          name: string | null
          size_range: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          domain?: string | null
          id?: string
          industry?: string | null
          name?: string | null
          size_range?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          domain?: string | null
          id?: string
          industry?: string | null
          name?: string | null
          size_range?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gc_contacts: {
        Row: {
          ai_score: number
          company_id: string | null
          created_at: string
          email: string | null
          enrichment_data: Json
          id: string
          last_action_at: string | null
          linkedin_url: string | null
          name: string | null
          source: string | null
          stage: string
          tags: string[]
          title: string | null
          updated_at: string
          user_id: string
          warmth_score: number
        }
        Insert: {
          ai_score?: number
          company_id?: string | null
          created_at?: string
          email?: string | null
          enrichment_data?: Json
          id?: string
          last_action_at?: string | null
          linkedin_url?: string | null
          name?: string | null
          source?: string | null
          stage?: string
          tags?: string[]
          title?: string | null
          updated_at?: string
          user_id: string
          warmth_score?: number
        }
        Update: {
          ai_score?: number
          company_id?: string | null
          created_at?: string
          email?: string | null
          enrichment_data?: Json
          id?: string
          last_action_at?: string | null
          linkedin_url?: string | null
          name?: string | null
          source?: string | null
          stage?: string
          tags?: string[]
          title?: string | null
          updated_at?: string
          user_id?: string
          warmth_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "gc_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "gc_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      gc_unibox_messages: {
        Row: {
          body: string | null
          created_at: string
          direction: string
          id: string
          in_reply_to: string | null
          message_id_header: string | null
          sent_at: string
          subject: string | null
          thread_id: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          direction: string
          id?: string
          in_reply_to?: string | null
          message_id_header?: string | null
          sent_at?: string
          subject?: string | null
          thread_id: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          direction?: string
          id?: string
          in_reply_to?: string | null
          message_id_header?: string | null
          sent_at?: string
          subject?: string | null
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gc_unibox_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "gc_unibox_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      gc_unibox_threads: {
        Row: {
          channel: string
          contact_id: string | null
          created_at: string
          id: string
          last_message_at: string | null
          status: string
          unread_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          channel?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gc_unibox_threads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "gc_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      genesis_event_messages: {
        Row: {
          cost_cents: number | null
          created_at: string
          id: string
          metadata: Json
          phase: string
          speaker: string
          text: string
          turn_index: number
          user_id: string
        }
        Insert: {
          cost_cents?: number | null
          created_at?: string
          id?: string
          metadata?: Json
          phase: string
          speaker: string
          text: string
          turn_index: number
          user_id: string
        }
        Update: {
          cost_cents?: number | null
          created_at?: string
          id?: string
          metadata?: Json
          phase?: string
          speaker?: string
          text?: string
          turn_index?: number
          user_id?: string
        }
        Relationships: []
      }
      genesis_grounding_checks: {
        Row: {
          categories_above_threshold: number
          constraint_signal: number | null
          context_signal: number | null
          cost_cents: number | null
          created_at: string
          creative_history_signal: number | null
          follow_up_questions: Json | null
          goal_signal: number | null
          id: string
          identity_signal: number | null
          materials_count: number
          overall_grounding: number
          public_presence_signal: number | null
          status: string
          user_id: string
          visual_signal: number | null
          voice_signal: number | null
        }
        Insert: {
          categories_above_threshold: number
          constraint_signal?: number | null
          context_signal?: number | null
          cost_cents?: number | null
          created_at?: string
          creative_history_signal?: number | null
          follow_up_questions?: Json | null
          goal_signal?: number | null
          id?: string
          identity_signal?: number | null
          materials_count: number
          overall_grounding: number
          public_presence_signal?: number | null
          status: string
          user_id: string
          visual_signal?: number | null
          voice_signal?: number | null
        }
        Update: {
          categories_above_threshold?: number
          constraint_signal?: number | null
          context_signal?: number | null
          cost_cents?: number | null
          created_at?: string
          creative_history_signal?: number | null
          follow_up_questions?: Json | null
          goal_signal?: number | null
          id?: string
          identity_signal?: number | null
          materials_count?: number
          overall_grounding?: number
          public_presence_signal?: number | null
          status?: string
          user_id?: string
          visual_signal?: number | null
          voice_signal?: number | null
        }
        Relationships: []
      }
      genesis_materials: {
        Row: {
          analyzed_at: string | null
          content: string | null
          created_at: string
          id: string
          kind: string
          label: string | null
          metadata: Json | null
          signal_contribution: Json | null
          storage_path: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          analyzed_at?: string | null
          content?: string | null
          created_at?: string
          id?: string
          kind: string
          label?: string | null
          metadata?: Json | null
          signal_contribution?: Json | null
          storage_path?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          analyzed_at?: string | null
          content?: string | null
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          metadata?: Json | null
          signal_contribution?: Json | null
          storage_path?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      gmail_tokens: {
        Row: {
          access_token: string | null
          created_at: string | null
          email: string | null
          expires_at: number | null
          id: string
          refresh_token: string | null
          user_id: string | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: number | null
          id?: string
          refresh_token?: string | null
          user_id?: string | null
        }
        Update: {
          access_token?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: number | null
          id?: string
          refresh_token?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      heartbeat_log: {
        Row: {
          agent: string | null
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          summary: string
          user_id: string | null
        }
        Insert: {
          agent?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          summary: string
          user_id?: string | null
        }
        Update: {
          agent?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          summary?: string
          user_id?: string | null
        }
        Relationships: []
      }
      jobs: {
        Row: {
          agent: string | null
          completed_at: string | null
          created_at: string | null
          error: string | null
          id: string
          notified: boolean | null
          prompt: string | null
          result: string | null
          started_at: string | null
          status: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          agent?: string | null
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          notified?: boolean | null
          prompt?: string | null
          result?: string | null
          started_at?: string | null
          status?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          agent?: string | null
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          notified?: boolean | null
          prompt?: string | null
          result?: string | null
          started_at?: string | null
          status?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      lead_captures: {
        Row: {
          created_at: string | null
          email: string
          id: string
          industry: string | null
          location: string | null
          metadata: Json | null
          name: string | null
          page_url: string | null
          phone: string | null
          sold: boolean | null
          sold_to: string | null
          source: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          value_cents: number | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          location?: string | null
          metadata?: Json | null
          name?: string | null
          page_url?: string | null
          phone?: string | null
          sold?: boolean | null
          sold_to?: string | null
          source: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          value_cents?: number | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          location?: string | null
          metadata?: Json | null
          name?: string | null
          page_url?: string | null
          phone?: string | null
          sold?: boolean | null
          sold_to?: string | null
          source?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          value_cents?: number | null
        }
        Relationships: []
      }
      lead_list_contacts: {
        Row: {
          business_name: string | null
          contact_name: string | null
          created_at: string | null
          email: string | null
          enrichment_data: Json | null
          has_website: boolean | null
          id: string
          industry: string | null
          list_id: string | null
          location: string | null
          notes: string | null
          outreach_opened_at: string | null
          outreach_sent_at: string | null
          outreach_status: string | null
          phone: string | null
          rating: number | null
          review_count: number | null
          social_profiles: Json | null
          user_id: string
          website: string | null
        }
        Insert: {
          business_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          enrichment_data?: Json | null
          has_website?: boolean | null
          id?: string
          industry?: string | null
          list_id?: string | null
          location?: string | null
          notes?: string | null
          outreach_opened_at?: string | null
          outreach_sent_at?: string | null
          outreach_status?: string | null
          phone?: string | null
          rating?: number | null
          review_count?: number | null
          social_profiles?: Json | null
          user_id: string
          website?: string | null
        }
        Update: {
          business_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          enrichment_data?: Json | null
          has_website?: boolean | null
          id?: string
          industry?: string | null
          list_id?: string | null
          location?: string | null
          notes?: string | null
          outreach_opened_at?: string | null
          outreach_sent_at?: string | null
          outreach_status?: string | null
          phone?: string | null
          rating?: number | null
          review_count?: number | null
          social_profiles?: Json | null
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_list_contacts_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lead_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_lists: {
        Row: {
          contacted_leads: number | null
          created_at: string | null
          enriched_leads: number | null
          id: string
          location: string | null
          metadata: Json | null
          name: string
          niche: string
          responded_leads: number | null
          search_queries: Json | null
          status: string | null
          total_leads: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          contacted_leads?: number | null
          created_at?: string | null
          enriched_leads?: number | null
          id?: string
          location?: string | null
          metadata?: Json | null
          name: string
          niche: string
          responded_leads?: number | null
          search_queries?: Json | null
          status?: string | null
          total_leads?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          contacted_leads?: number | null
          created_at?: string | null
          enriched_leads?: number | null
          id?: string
          location?: string | null
          metadata?: Json | null
          name?: string
          niche?: string
          responded_leads?: number | null
          search_queries?: Json | null
          status?: string | null
          total_leads?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      lead_pages: {
        Row: {
          conversion_rate: number | null
          created_at: string | null
          description: string | null
          form_fields: Json | null
          headline: string | null
          html: string | null
          id: string
          industry: string | null
          location: string | null
          name: string
          slug: string
          status: string | null
          total_submissions: number | null
          total_views: number | null
          user_id: string
        }
        Insert: {
          conversion_rate?: number | null
          created_at?: string | null
          description?: string | null
          form_fields?: Json | null
          headline?: string | null
          html?: string | null
          id?: string
          industry?: string | null
          location?: string | null
          name: string
          slug: string
          status?: string | null
          total_submissions?: number | null
          total_views?: number | null
          user_id: string
        }
        Update: {
          conversion_rate?: number | null
          created_at?: string | null
          description?: string | null
          form_fields?: Json | null
          headline?: string | null
          html?: string | null
          id?: string
          industry?: string | null
          location?: string | null
          name?: string
          slug?: string
          status?: string | null
          total_submissions?: number | null
          total_views?: number | null
          user_id?: string
        }
        Relationships: []
      }
      luna_initiatives: {
        Row: {
          created_at: string | null
          id: string
          message: string
          trigger_ref: string | null
          trigger_type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          trigger_ref?: string | null
          trigger_type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          trigger_ref?: string | null
          trigger_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      luna_sessions: {
        Row: {
          archetype: string | null
          closed_at: string | null
          created_at: string
          depth_mode: string | null
          effective_info: number | null
          hawkes_admissible: boolean | null
          hawkes_spectral_radius: number | null
          id: string
          is_simulated: boolean
          macro_phi: number | null
          macro_phi_computed_at: string | null
          macro_phi_low_confidence: boolean | null
          macro_phi_partition: string | null
          participants: string[]
          seed_context: Json | null
          significance: number | null
          simulation_batch_id: string | null
          status: string
          summary: string | null
          title: string | null
          total_cost_cents: number
          trigger_type: string
          turn_count: number
          user_id: string
          user_join_turn: number | null
          user_joined: boolean
        }
        Insert: {
          archetype?: string | null
          closed_at?: string | null
          created_at?: string
          depth_mode?: string | null
          effective_info?: number | null
          hawkes_admissible?: boolean | null
          hawkes_spectral_radius?: number | null
          id?: string
          is_simulated?: boolean
          macro_phi?: number | null
          macro_phi_computed_at?: string | null
          macro_phi_low_confidence?: boolean | null
          macro_phi_partition?: string | null
          participants?: string[]
          seed_context?: Json | null
          significance?: number | null
          simulation_batch_id?: string | null
          status?: string
          summary?: string | null
          title?: string | null
          total_cost_cents?: number
          trigger_type: string
          turn_count?: number
          user_id: string
          user_join_turn?: number | null
          user_joined?: boolean
        }
        Update: {
          archetype?: string | null
          closed_at?: string | null
          created_at?: string
          depth_mode?: string | null
          effective_info?: number | null
          hawkes_admissible?: boolean | null
          hawkes_spectral_radius?: number | null
          id?: string
          is_simulated?: boolean
          macro_phi?: number | null
          macro_phi_computed_at?: string | null
          macro_phi_low_confidence?: boolean | null
          macro_phi_partition?: string | null
          participants?: string[]
          seed_context?: Json | null
          significance?: number | null
          simulation_batch_id?: string | null
          status?: string
          summary?: string | null
          title?: string | null
          total_cost_cents?: number
          trigger_type?: string
          turn_count?: number
          user_id?: string
          user_join_turn?: number | null
          user_joined?: boolean
        }
        Relationships: []
      }
      lunari_config: {
        Row: {
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      lunari_handoff_notes: {
        Row: {
          created_at: string | null
          id: string
          spec: Json
          status: string | null
          topic: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          spec: Json
          status?: string | null
          topic: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          spec?: Json
          status?: string | null
          topic?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lunari_learnings: {
        Row: {
          active: boolean | null
          category: string
          created_at: string | null
          expires_at: string | null
          id: string
          key: string
          value: string
          weight: number | null
        }
        Insert: {
          active?: boolean | null
          category: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          key: string
          value: string
          weight?: number | null
        }
        Update: {
          active?: boolean | null
          category?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          key?: string
          value?: string
          weight?: number | null
        }
        Relationships: []
      }
      mcp_connections: {
        Row: {
          auth_token: string | null
          capabilities: Json | null
          connected_at: string | null
          id: string
          last_used_at: string | null
          server_name: string
          server_url: string
          status: string | null
          user_id: string
        }
        Insert: {
          auth_token?: string | null
          capabilities?: Json | null
          connected_at?: string | null
          id?: string
          last_used_at?: string | null
          server_name: string
          server_url: string
          status?: string | null
          user_id: string
        }
        Update: {
          auth_token?: string | null
          capabilities?: Json | null
          connected_at?: string | null
          id?: string
          last_used_at?: string | null
          server_name?: string
          server_url?: string
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      memory_entries: {
        Row: {
          category: string
          content: string
          created_at: string | null
          id: string
          source: string | null
          tags: string[] | null
          title: string
          user_id: string | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          id?: string
          source?: string | null
          tags?: string[] | null
          title: string
          user_id?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          id?: string
          source?: string | null
          tags?: string[] | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      micro_tool_usage: {
        Row: {
          created_at: string | null
          id: string
          input_text: string | null
          output_text: string | null
          tokens_used: number | null
          tool_id: string | null
          user_id: string | null
          user_ip: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          input_text?: string | null
          output_text?: string | null
          tokens_used?: number | null
          tool_id?: string | null
          user_id?: string | null
          user_ip?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          input_text?: string | null
          output_text?: string | null
          tokens_used?: number | null
          tool_id?: string | null
          user_id?: string | null
          user_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "micro_tool_usage_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "micro_tools"
            referencedColumns: ["id"]
          },
        ]
      }
      micro_tools: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          example_input: string | null
          example_output: string | null
          free_uses_per_day: number | null
          icon: string | null
          id: string
          input_fields: Json | null
          max_tokens: number | null
          model: string | null
          name: string
          prompt_template: string
          slug: string
          status: string | null
          uses_today: number | null
          uses_total: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          example_input?: string | null
          example_output?: string | null
          free_uses_per_day?: number | null
          icon?: string | null
          id?: string
          input_fields?: Json | null
          max_tokens?: number | null
          model?: string | null
          name: string
          prompt_template: string
          slug: string
          status?: string | null
          uses_today?: number | null
          uses_total?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          example_input?: string | null
          example_output?: string | null
          free_uses_per_day?: number | null
          icon?: string | null
          id?: string
          input_fields?: Json | null
          max_tokens?: number | null
          model?: string | null
          name?: string
          prompt_template?: string
          slug?: string
          status?: string | null
          uses_today?: number | null
          uses_total?: number | null
        }
        Relationships: []
      }
      mockup_validation_log: {
        Row: {
          candidate_id: string | null
          created_at: string
          decision: string
          decision_reason: string | null
          expected_product_category: string | null
          id: string
          mockup_template_uuid: string | null
          pixel_confidence: number | null
          pixel_detected_category: string | null
          pixel_notes: string | null
          product_line_id: string | null
          rendered_image_url: string
          user_id: string
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string
          decision: string
          decision_reason?: string | null
          expected_product_category?: string | null
          id?: string
          mockup_template_uuid?: string | null
          pixel_confidence?: number | null
          pixel_detected_category?: string | null
          pixel_notes?: string | null
          product_line_id?: string | null
          rendered_image_url: string
          user_id: string
        }
        Update: {
          candidate_id?: string | null
          created_at?: string
          decision?: string
          decision_reason?: string | null
          expected_product_category?: string | null
          id?: string
          mockup_template_uuid?: string | null
          pixel_confidence?: number | null
          pixel_detected_category?: string | null
          pixel_notes?: string | null
          product_line_id?: string | null
          rendered_image_url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mockup_validation_log_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "design_draft_surface_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mockup_validation_log_product_line_id_fkey"
            columns: ["product_line_id"]
            isOneToOne: false
            referencedRelation: "product_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      model_registry: {
        Row: {
          active: boolean | null
          api_key_env: string | null
          best_for: string | null
          category: string
          cost_per_unit: number
          created_at: string | null
          deprecation_date: string | null
          description: string | null
          display_name: string
          endpoint: string
          id: string
          is_default_for_tier: boolean | null
          known_issues: string | null
          latency_sec: number | null
          max_duration_sec: number | null
          min_cost: number | null
          min_duration_sec: number | null
          min_plan: string
          parameters: Json | null
          pricing_notes: string | null
          provider: string
          quality_rating: number | null
          resolutions: Json | null
          slug: string
          speed_rating: number | null
          subcategory: string | null
          supported_aspects: Json | null
          supports_audio: boolean | null
          supports_reference_image: boolean | null
          supports_start_end_frame: boolean | null
          tier: string
          unit: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          api_key_env?: string | null
          best_for?: string | null
          category: string
          cost_per_unit: number
          created_at?: string | null
          deprecation_date?: string | null
          description?: string | null
          display_name: string
          endpoint: string
          id?: string
          is_default_for_tier?: boolean | null
          known_issues?: string | null
          latency_sec?: number | null
          max_duration_sec?: number | null
          min_cost?: number | null
          min_duration_sec?: number | null
          min_plan?: string
          parameters?: Json | null
          pricing_notes?: string | null
          provider: string
          quality_rating?: number | null
          resolutions?: Json | null
          slug: string
          speed_rating?: number | null
          subcategory?: string | null
          supported_aspects?: Json | null
          supports_audio?: boolean | null
          supports_reference_image?: boolean | null
          supports_start_end_frame?: boolean | null
          tier: string
          unit: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          api_key_env?: string | null
          best_for?: string | null
          category?: string
          cost_per_unit?: number
          created_at?: string | null
          deprecation_date?: string | null
          description?: string | null
          display_name?: string
          endpoint?: string
          id?: string
          is_default_for_tier?: boolean | null
          known_issues?: string | null
          latency_sec?: number | null
          max_duration_sec?: number | null
          min_cost?: number | null
          min_duration_sec?: number | null
          min_plan?: string
          parameters?: Json | null
          pricing_notes?: string | null
          provider?: string
          quality_rating?: number | null
          resolutions?: Json | null
          slug?: string
          speed_rating?: number | null
          subcategory?: string | null
          supported_aspects?: Json | null
          supports_audio?: boolean | null
          supports_reference_image?: boolean | null
          supports_start_end_frame?: boolean | null
          tier?: string
          unit?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      morning_residue: {
        Row: {
          approved_at: string | null
          converted_at: string | null
          created_at: string
          dismissed_at: string | null
          id: string
          question: string | null
          requires_approval: boolean
          residue_type: string
          session_id: string | null
          source_agents: string[] | null
          source_archetype: string | null
          source_batch_id: string | null
          status: string
          suggested_prompt: string | null
          theme: string | null
          user_id: string
          what_luna_noticed: string
          why_it_matters: string | null
        }
        Insert: {
          approved_at?: string | null
          converted_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          question?: string | null
          requires_approval?: boolean
          residue_type?: string
          session_id?: string | null
          source_agents?: string[] | null
          source_archetype?: string | null
          source_batch_id?: string | null
          status?: string
          suggested_prompt?: string | null
          theme?: string | null
          user_id: string
          what_luna_noticed: string
          why_it_matters?: string | null
        }
        Update: {
          approved_at?: string | null
          converted_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          question?: string | null
          requires_approval?: boolean
          residue_type?: string
          session_id?: string | null
          source_agents?: string[] | null
          source_archetype?: string | null
          source_batch_id?: string | null
          status?: string
          suggested_prompt?: string | null
          theme?: string | null
          user_id?: string
          what_luna_noticed?: string
          why_it_matters?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "morning_residue_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "luna_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "morning_residue_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions_with_message_count"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_issues: {
        Row: {
          author_id: string | null
          body_html: string | null
          body_markdown: string
          click_count: number | null
          id: string
          issue_number: number
          metadata: Json | null
          open_count: number | null
          recipient_count: number | null
          sent_at: string | null
          subject: string
        }
        Insert: {
          author_id?: string | null
          body_html?: string | null
          body_markdown: string
          click_count?: number | null
          id?: string
          issue_number?: number
          metadata?: Json | null
          open_count?: number | null
          recipient_count?: number | null
          sent_at?: string | null
          subject: string
        }
        Update: {
          author_id?: string | null
          body_html?: string | null
          body_markdown?: string
          click_count?: number | null
          id?: string
          issue_number?: number
          metadata?: Json | null
          open_count?: number | null
          recipient_count?: number | null
          sent_at?: string | null
          subject?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
          source: string | null
          status: string | null
          subscribed_at: string | null
          tags: string[] | null
          unsubscribed_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name?: string | null
          source?: string | null
          status?: string | null
          subscribed_at?: string | null
          tags?: string[] | null
          unsubscribed_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          source?: string | null
          status?: string | null
          subscribed_at?: string | null
          tags?: string[] | null
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      np_pieces: {
        Row: {
          body: Json
          created_at: string
          excerpt: string | null
          id: string
          last_autosaved_at: string
          last_edited_at: string
          metadata: Json
          published_at: string | null
          repurpose_history: Json
          scheduled_publish_at: string | null
          slug: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          visibility: string
          word_count: number
        }
        Insert: {
          body?: Json
          created_at?: string
          excerpt?: string | null
          id?: string
          last_autosaved_at?: string
          last_edited_at?: string
          metadata?: Json
          published_at?: string | null
          repurpose_history?: Json
          scheduled_publish_at?: string | null
          slug?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id: string
          visibility?: string
          word_count?: number
        }
        Update: {
          body?: Json
          created_at?: string
          excerpt?: string | null
          id?: string
          last_autosaved_at?: string
          last_edited_at?: string
          metadata?: Json
          published_at?: string | null
          repurpose_history?: Json
          scheduled_publish_at?: string | null
          slug?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          visibility?: string
          word_count?: number
        }
        Relationships: []
      }
      np_subscriber: {
        Row: {
          created_at: string
          email: string
          id: string
          piece_id: string | null
          source_slug: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          piece_id?: string | null
          source_slug?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          piece_id?: string | null
          source_slug?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      np_user_settings: {
        Row: {
          created_at: string
          default_repurpose_channels: string[]
          default_share_visibility: string
          focus_mode_default: boolean
          partner_aggressiveness: number
          preferences: Json
          typewriter_mode: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_repurpose_channels?: string[]
          default_share_visibility?: string
          focus_mode_default?: boolean
          partner_aggressiveness?: number
          preferences?: Json
          typewriter_mode?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_repurpose_channels?: string[]
          default_share_visibility?: string
          focus_mode_default?: boolean
          partner_aggressiveness?: number
          preferences?: Json
          typewriter_mode?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      omega_insights: {
        Row: {
          confidence: number | null
          created_at: string | null
          delivered: boolean | null
          delivery_method: string | null
          id: string
          insight: string
          source_threads: string[] | null
          user_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          delivered?: boolean | null
          delivery_method?: string | null
          id?: string
          insight: string
          source_threads?: string[] | null
          user_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          delivered?: boolean | null
          delivery_method?: string | null
          id?: string
          insight?: string
          source_threads?: string[] | null
          user_id?: string | null
        }
        Relationships: []
      }
      omega_kernel_matrix: {
        Row: {
          alpha: number
          beta: number
          branching_ratio: number | null
          id: string
          source_thread: string
          target_thread: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alpha: number
          beta: number
          branching_ratio?: number | null
          id?: string
          source_thread: string
          target_thread: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alpha?: number
          beta?: number
          branching_ratio?: number | null
          id?: string
          source_thread?: string
          target_thread?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "omega_kernel_matrix_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_core"
            referencedColumns: ["user_id"]
          },
        ]
      }
      oscillator_state: {
        Row: {
          bad_streak: number | null
          cycle_at: string
          id: string
          kuramoto_order: number
          kuramoto_phase: number | null
          mean_concurrence: number | null
          min_concurrence: number | null
          near_threshold: boolean | null
          phases: Json
          user_id: string
        }
        Insert: {
          bad_streak?: number | null
          cycle_at?: string
          id?: string
          kuramoto_order: number
          kuramoto_phase?: number | null
          mean_concurrence?: number | null
          min_concurrence?: number | null
          near_threshold?: boolean | null
          phases: Json
          user_id: string
        }
        Update: {
          bad_streak?: number | null
          cycle_at?: string
          id?: string
          kuramoto_order?: number
          kuramoto_phase?: number | null
          mean_concurrence?: number | null
          min_concurrence?: number | null
          near_threshold?: boolean | null
          phases?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oscillator_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_core"
            referencedColumns: ["user_id"]
          },
        ]
      }
      outreach_contacts: {
        Row: {
          city: string | null
          company: string | null
          created_at: string | null
          deal_value: number | null
          email: string | null
          email_body: string | null
          email_subject: string | null
          google_rating: number | null
          id: string
          industry: string | null
          name: string | null
          niche: string | null
          notes: string | null
          phone: string | null
          pipeline_stage: string | null
          sent_at: string | null
          source: string | null
          stage_updated_at: string | null
          status: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
          verified_email: boolean | null
          website: string | null
        }
        Insert: {
          city?: string | null
          company?: string | null
          created_at?: string | null
          deal_value?: number | null
          email?: string | null
          email_body?: string | null
          email_subject?: string | null
          google_rating?: number | null
          id?: string
          industry?: string | null
          name?: string | null
          niche?: string | null
          notes?: string | null
          phone?: string | null
          pipeline_stage?: string | null
          sent_at?: string | null
          source?: string | null
          stage_updated_at?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          verified_email?: boolean | null
          website?: string | null
        }
        Update: {
          city?: string | null
          company?: string | null
          created_at?: string | null
          deal_value?: number | null
          email?: string | null
          email_body?: string | null
          email_subject?: string | null
          google_rating?: number | null
          id?: string
          industry?: string | null
          name?: string | null
          niche?: string | null
          notes?: string | null
          phone?: string | null
          pipeline_stage?: string | null
          sent_at?: string | null
          source?: string | null
          stage_updated_at?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          verified_email?: boolean | null
          website?: string | null
        }
        Relationships: []
      }
      page_visits: {
        Row: {
          country: string | null
          created_at: string | null
          id: string
          is_bot: boolean | null
          is_unique: boolean | null
          metadata: Json | null
          path: string
          referrer: string | null
          session_id: string
          site_domain: string | null
          site_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          id?: string
          is_bot?: boolean | null
          is_unique?: boolean | null
          metadata?: Json | null
          path: string
          referrer?: string | null
          session_id: string
          site_domain?: string | null
          site_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          id?: string
          is_bot?: boolean | null
          is_unique?: boolean | null
          metadata?: Json | null
          path?: string
          referrer?: string | null
          session_id?: string
          site_domain?: string | null
          site_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      pixel_team: {
        Row: {
          active: boolean | null
          color: string
          created_at: string | null
          display_name: string
          emoji: string
          id: string
          model_tier: string | null
          reports_to: string
          role_title: string
          slug: string
          system_prompt: string
          tools_allowed: Json | null
          updated_at: string | null
          version: number | null
          voice_description: string
        }
        Insert: {
          active?: boolean | null
          color: string
          created_at?: string | null
          display_name: string
          emoji: string
          id?: string
          model_tier?: string | null
          reports_to?: string
          role_title: string
          slug: string
          system_prompt: string
          tools_allowed?: Json | null
          updated_at?: string | null
          version?: number | null
          voice_description: string
        }
        Update: {
          active?: boolean | null
          color?: string
          created_at?: string | null
          display_name?: string
          emoji?: string
          id?: string
          model_tier?: string | null
          reports_to?: string
          role_title?: string
          slug?: string
          system_prompt?: string
          tools_allowed?: Json | null
          updated_at?: string | null
          version?: number | null
          voice_description?: string
        }
        Relationships: []
      }
      pixel_team_backup_20260421: {
        Row: {
          active: boolean | null
          color: string | null
          created_at: string | null
          display_name: string | null
          emoji: string | null
          id: string | null
          model_tier: string | null
          reports_to: string | null
          role_title: string | null
          slug: string | null
          system_prompt: string | null
          tools_allowed: Json | null
          updated_at: string | null
          version: number | null
          voice_description: string | null
        }
        Insert: {
          active?: boolean | null
          color?: string | null
          created_at?: string | null
          display_name?: string | null
          emoji?: string | null
          id?: string | null
          model_tier?: string | null
          reports_to?: string | null
          role_title?: string | null
          slug?: string | null
          system_prompt?: string | null
          tools_allowed?: Json | null
          updated_at?: string | null
          version?: number | null
          voice_description?: string | null
        }
        Update: {
          active?: boolean | null
          color?: string | null
          created_at?: string | null
          display_name?: string | null
          emoji?: string | null
          id?: string | null
          model_tier?: string | null
          reports_to?: string | null
          role_title?: string | null
          slug?: string | null
          system_prompt?: string | null
          tools_allowed?: Json | null
          updated_at?: string | null
          version?: number | null
          voice_description?: string | null
        }
        Relationships: []
      }
      pixel_team_v10_backup: {
        Row: {
          backed_up_at: string
          slug: string
          system_prompt: string
        }
        Insert: {
          backed_up_at?: string
          slug: string
          system_prompt: string
        }
        Update: {
          backed_up_at?: string
          slug?: string
          system_prompt?: string
        }
        Relationships: []
      }
      postiz_tokens: {
        Row: {
          access_token: string
          connected_at: string | null
          expires_at: string | null
          id: string
          refresh_token: string | null
          token_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          connected_at?: string | null
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          token_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          connected_at?: string | null
          expires_at?: string | null
          id?: string
          refresh_token?: string | null
          token_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      prevention_rules: {
        Row: {
          active: boolean | null
          agent: string
          confidence: number | null
          created_at: string | null
          hit_count: number | null
          id: string
          rule: string
          source_failures: string[] | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          agent: string
          confidence?: number | null
          created_at?: string | null
          hit_count?: number | null
          id?: string
          rule: string
          source_failures?: string[] | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          agent?: string
          confidence?: number | null
          created_at?: string | null
          hit_count?: number | null
          id?: string
          rule?: string
          source_failures?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pricing_config: {
        Row: {
          active: boolean | null
          billing_period: string | null
          created_at: string | null
          description: string | null
          display_name: string
          display_order: number | null
          fuel_included: number
          id: string
          price_usd: number
          stripe_price_id: string | null
          tier_slug: string
          tier_type: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          billing_period?: string | null
          created_at?: string | null
          description?: string | null
          display_name: string
          display_order?: number | null
          fuel_included: number
          id?: string
          price_usd: number
          stripe_price_id?: string | null
          tier_slug: string
          tier_type: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          billing_period?: string | null
          created_at?: string | null
          description?: string | null
          display_name?: string
          display_order?: number | null
          fuel_included?: number
          id?: string
          price_usd?: number
          stripe_price_id?: string | null
          tier_slug?: string
          tier_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      printify_blueprint_cache: {
        Row: {
          blueprint_brand: string | null
          blueprint_data: Json
          blueprint_description: string | null
          blueprint_model: string | null
          blueprint_name: string
          created_at: string | null
          id: string
          last_synced_at: string | null
          printify_blueprint_id: number
          providers_data: Json
          variants_data: Json
        }
        Insert: {
          blueprint_brand?: string | null
          blueprint_data: Json
          blueprint_description?: string | null
          blueprint_model?: string | null
          blueprint_name: string
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          printify_blueprint_id: number
          providers_data: Json
          variants_data: Json
        }
        Update: {
          blueprint_brand?: string | null
          blueprint_data?: Json
          blueprint_description?: string | null
          blueprint_model?: string | null
          blueprint_name?: string
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          printify_blueprint_id?: number
          providers_data?: Json
          variants_data?: Json
        }
        Relationships: []
      }
      product_line_variants: {
        Row: {
          color: string | null
          created_at: string | null
          current_cost_cents: number
          id: string
          in_stock: boolean | null
          is_enabled: boolean | null
          last_availability_check: string | null
          printify_variant_id: number
          product_line_id: string
          retail_target_cents: number | null
          size: string | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          current_cost_cents?: number
          id?: string
          in_stock?: boolean | null
          is_enabled?: boolean | null
          last_availability_check?: string | null
          printify_variant_id: number
          product_line_id: string
          retail_target_cents?: number | null
          size?: string | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          current_cost_cents?: number
          id?: string
          in_stock?: boolean | null
          is_enabled?: boolean | null
          last_availability_check?: string | null
          printify_variant_id?: number
          product_line_id?: string
          retail_target_cents?: number | null
          size?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_line_variants_product_line_id_fkey"
            columns: ["product_line_id"]
            isOneToOne: false
            referencedRelation: "product_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      product_lines: {
        Row: {
          base_cost_cents: number
          created_at: string | null
          design_area: Json
          dynamic_mockup_template_ids: Json
          factory_id: string | null
          id: string
          margin_floor_pct: number | null
          material_tier: string | null
          name: string
          notes: string | null
          printify_blueprint_id: number
          printify_provider_id: number
          retail_target_cents: number
          status: string | null
          surface_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          base_cost_cents?: number
          created_at?: string | null
          design_area?: Json
          dynamic_mockup_template_ids?: Json
          factory_id?: string | null
          id?: string
          margin_floor_pct?: number | null
          material_tier?: string | null
          name: string
          notes?: string | null
          printify_blueprint_id: number
          printify_provider_id: number
          retail_target_cents?: number
          status?: string | null
          surface_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          base_cost_cents?: number
          created_at?: string | null
          design_area?: Json
          dynamic_mockup_template_ids?: Json
          factory_id?: string | null
          id?: string
          margin_floor_pct?: number | null
          material_tier?: string | null
          name?: string
          notes?: string | null
          printify_blueprint_id?: number
          printify_provider_id?: number
          retail_target_cents?: number
          status?: string | null
          surface_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_lines_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_purchases: {
        Row: {
          amount_cents: number
          buyer_email: string
          buyer_name: string | null
          created_at: string | null
          currency: string | null
          download_token: string | null
          downloaded: boolean | null
          id: string
          product_id: string | null
          revenue_stream: string | null
          stripe_payment_id: string | null
          stripe_session_id: string | null
        }
        Insert: {
          amount_cents: number
          buyer_email: string
          buyer_name?: string | null
          created_at?: string | null
          currency?: string | null
          download_token?: string | null
          downloaded?: boolean | null
          id?: string
          product_id?: string | null
          revenue_stream?: string | null
          stripe_payment_id?: string | null
          stripe_session_id?: string | null
        }
        Update: {
          amount_cents?: number
          buyer_email?: string
          buyer_name?: string | null
          created_at?: string | null
          currency?: string | null
          download_token?: string | null
          downloaded?: boolean | null
          id?: string
          product_id?: string | null
          revenue_stream?: string | null
          stripe_payment_id?: string | null
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "digital_products"
            referencedColumns: ["id"]
          },
        ]
      }
      project_file_cards: {
        Row: {
          atlas_priority: string
          card_json: Json
          created_at: string
          env_vars: string[]
          file_id: string
          file_source: string
          filename: string | null
          id: string
          important_symbols: Json
          kind: string | null
          language: string | null
          metadata: Json
          model: string | null
          project_id: string | null
          risk_notes: string[]
          routes: string[]
          summary: string | null
          tables: string[]
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          atlas_priority?: string
          card_json?: Json
          created_at?: string
          env_vars?: string[]
          file_id: string
          file_source: string
          filename?: string | null
          id?: string
          important_symbols?: Json
          kind?: string | null
          language?: string | null
          metadata?: Json
          model?: string | null
          project_id?: string | null
          risk_notes?: string[]
          routes?: string[]
          summary?: string | null
          tables?: string[]
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          atlas_priority?: string
          card_json?: Json
          created_at?: string
          env_vars?: string[]
          file_id?: string
          file_source?: string
          filename?: string | null
          id?: string
          important_symbols?: Json
          kind?: string | null
          language?: string | null
          metadata?: Json
          model?: string | null
          project_id?: string | null
          risk_notes?: string[]
          routes?: string[]
          summary?: string | null
          tables?: string[]
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_file_chunks: {
        Row: {
          char_end: number | null
          char_start: number | null
          chunk_index: number
          chunk_text: string
          created_at: string
          file_id: string
          file_source: string
          id: string
          labels: string[]
          language: string | null
          line_end: number | null
          line_start: number | null
          metadata: Json
          project_id: string | null
          summary: string | null
          token_estimate: number | null
          user_id: string
        }
        Insert: {
          char_end?: number | null
          char_start?: number | null
          chunk_index: number
          chunk_text: string
          created_at?: string
          file_id: string
          file_source: string
          id?: string
          labels?: string[]
          language?: string | null
          line_end?: number | null
          line_start?: number | null
          metadata?: Json
          project_id?: string | null
          summary?: string | null
          token_estimate?: number | null
          user_id: string
        }
        Update: {
          char_end?: number | null
          char_start?: number | null
          chunk_index?: number
          chunk_text?: string
          created_at?: string
          file_id?: string
          file_source?: string
          id?: string
          labels?: string[]
          language?: string | null
          line_end?: number | null
          line_start?: number | null
          metadata?: Json
          project_id?: string | null
          summary?: string | null
          token_estimate?: number | null
          user_id?: string
        }
        Relationships: []
      }
      project_file_ingestion_events: {
        Row: {
          created_at: string
          event_type: string
          file_id: string
          file_source: string
          id: string
          message: string | null
          metadata: Json
          project_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          file_id: string
          file_source: string
          id?: string
          message?: string | null
          metadata?: Json
          project_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          file_id?: string
          file_source?: string
          id?: string
          message?: string | null
          metadata?: Json
          project_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      project_files: {
        Row: {
          content: string | null
          content_type: string | null
          created_at: string | null
          filename: string
          id: string
          project_id: string
          size_bytes: number | null
          user_id: string
        }
        Insert: {
          content?: string | null
          content_type?: string | null
          created_at?: string | null
          filename: string
          id?: string
          project_id: string
          size_bytes?: number | null
          user_id: string
        }
        Update: {
          content?: string | null
          content_type?: string | null
          created_at?: string | null
          filename?: string
          id?: string
          project_id?: string
          size_bytes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          context: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          context?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          title?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          context?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      prospects: {
        Row: {
          company: string | null
          created_at: string | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          notes: string | null
          source: string | null
          status: string | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          source?: string | null
          status?: string | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          source?: string | null
          status?: string | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action_type: string
          count: number | null
          date: string | null
          id: string
          platform: string | null
          user_id: string
          window_start: string | null
        }
        Insert: {
          action_type: string
          count?: number | null
          date?: string | null
          id?: string
          platform?: string | null
          user_id: string
          window_start?: string | null
        }
        Update: {
          action_type?: string
          count?: number | null
          date?: string | null
          id?: string
          platform?: string | null
          user_id?: string
          window_start?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          activated_at: string | null
          created_at: string | null
          id: string
          ip_hash: string | null
          referral_code: string
          referred_id: string | null
          referred_reward: number | null
          referrer_id: string
          referrer_reward: number | null
          status: string | null
        }
        Insert: {
          activated_at?: string | null
          created_at?: string | null
          id?: string
          ip_hash?: string | null
          referral_code: string
          referred_id?: string | null
          referred_reward?: number | null
          referrer_id: string
          referrer_reward?: number | null
          status?: string | null
        }
        Update: {
          activated_at?: string | null
          created_at?: string | null
          id?: string
          ip_hash?: string | null
          referral_code?: string
          referred_id?: string | null
          referred_reward?: number | null
          referrer_id?: string
          referrer_reward?: number | null
          status?: string | null
        }
        Relationships: []
      }
      research_campaign_events: {
        Row: {
          actor: string
          campaign_id: string
          created_at: string
          event_type: string
          from_status: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          reason: string | null
          task_id: string | null
          to_status: string | null
          user_id: string
        }
        Insert: {
          actor: string
          campaign_id: string
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          reason?: string | null
          task_id?: string | null
          to_status?: string | null
          user_id: string
        }
        Update: {
          actor?: string
          campaign_id?: string
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          reason?: string | null
          task_id?: string | null
          to_status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_campaign_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "research_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_campaign_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "research_campaign_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      research_campaign_steps: {
        Row: {
          attempt_count: number
          campaign_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          failed_at: string | null
          id: string
          idempotency_key: string
          max_attempts: number
          metadata: Json
          pg_boss_job_id: string | null
          queued_at: string | null
          research_job_id: string | null
          research_paper_id: string | null
          started_at: string | null
          status: string
          step_key: string
          step_type: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          campaign_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          failed_at?: string | null
          id?: string
          idempotency_key: string
          max_attempts?: number
          metadata?: Json
          pg_boss_job_id?: string | null
          queued_at?: string | null
          research_job_id?: string | null
          research_paper_id?: string | null
          started_at?: string | null
          status?: string
          step_key: string
          step_type: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          campaign_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          failed_at?: string | null
          id?: string
          idempotency_key?: string
          max_attempts?: number
          metadata?: Json
          pg_boss_job_id?: string | null
          queued_at?: string | null
          research_job_id?: string | null
          research_paper_id?: string | null
          started_at?: string | null
          status?: string
          step_key?: string
          step_type?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_campaign_steps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "research_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_campaign_steps_research_job_id_fkey"
            columns: ["research_job_id"]
            isOneToOne: false
            referencedRelation: "research_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_campaign_steps_research_paper_id_fkey"
            columns: ["research_paper_id"]
            isOneToOne: false
            referencedRelation: "research_papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_campaign_steps_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "research_campaign_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      research_campaign_tasks: {
        Row: {
          campaign_id: string
          completed_at: string | null
          context: string | null
          created_at: string
          depth: string | null
          error_message: string | null
          hints: Json
          id: string
          metadata: Json
          model_profile: string | null
          question: string
          queued_at: string | null
          research_job_id: string | null
          research_paper_id: string | null
          retry_count: number
          retry_limit: number
          started_at: string | null
          status: string
          task_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          completed_at?: string | null
          context?: string | null
          created_at?: string
          depth?: string | null
          error_message?: string | null
          hints?: Json
          id?: string
          metadata?: Json
          model_profile?: string | null
          question: string
          queued_at?: string | null
          research_job_id?: string | null
          research_paper_id?: string | null
          retry_count?: number
          retry_limit?: number
          started_at?: string | null
          status?: string
          task_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          completed_at?: string | null
          context?: string | null
          created_at?: string
          depth?: string | null
          error_message?: string | null
          hints?: Json
          id?: string
          metadata?: Json
          model_profile?: string | null
          question?: string
          queued_at?: string | null
          research_job_id?: string | null
          research_paper_id?: string | null
          retry_count?: number
          retry_limit?: number
          started_at?: string | null
          status?: string
          task_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_campaign_tasks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "research_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_campaign_tasks_research_job_id_fkey"
            columns: ["research_job_id"]
            isOneToOne: false
            referencedRelation: "research_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_campaign_tasks_research_paper_id_fkey"
            columns: ["research_paper_id"]
            isOneToOne: false
            referencedRelation: "research_papers"
            referencedColumns: ["id"]
          },
        ]
      }
      research_campaigns: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          cancelled_at: string | null
          completed_at: string | null
          completed_tasks: number
          created_at: string
          depth: string | null
          description: string | null
          failed_tasks: number
          goal: string | null
          id: string
          last_error: string | null
          metadata: Json
          model_profile: string | null
          project_id: string | null
          queued_at: string | null
          source_decision_packet_id: string | null
          started_at: string | null
          status: string
          tags: string[]
          title: string
          total_tasks: number
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          completed_tasks?: number
          created_at?: string
          depth?: string | null
          description?: string | null
          failed_tasks?: number
          goal?: string | null
          id?: string
          last_error?: string | null
          metadata?: Json
          model_profile?: string | null
          project_id?: string | null
          queued_at?: string | null
          source_decision_packet_id?: string | null
          started_at?: string | null
          status?: string
          tags?: string[]
          title: string
          total_tasks?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          completed_tasks?: number
          created_at?: string
          depth?: string | null
          description?: string | null
          failed_tasks?: number
          goal?: string | null
          id?: string
          last_error?: string | null
          metadata?: Json
          model_profile?: string | null
          project_id?: string | null
          queued_at?: string | null
          source_decision_packet_id?: string | null
          started_at?: string | null
          status?: string
          tags?: string[]
          title?: string
          total_tasks?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      research_events: {
        Row: {
          created_at: string
          data: Json
          event_type: string
          id: string
          job_id: string
          message: string | null
          phase: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          event_type: string
          id?: string
          job_id: string
          message?: string | null
          phase?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          event_type?: string
          id?: string
          job_id?: string
          message?: string | null
          phase?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "research_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      research_jobs: {
        Row: {
          assumptions: Json
          completed_at: string | null
          composio_premium_calls: number
          cost_breakdown: Json | null
          created_at: string
          current_phase: number
          depth: string
          error_message: string | null
          error_metadata: Json | null
          fuel_consumed: number
          id: string
          model_profile: string | null
          model_routing: Json | null
          opus_polish: boolean
          origin: string | null
          owner_agent: string | null
          paper_id: string | null
          phase_message: string | null
          phases_log: Json
          pinned_context: Json
          plan: Json
          preflight_answers: Json
          preflight_questions: Json
          question: string
          requested_by_agent: string | null
          research_brief: Json
          soft_budget_fuel: number | null
          source_conversation_id: string | null
          source_count: number
          started_at: string | null
          status: string
          sufficiency: Json
          tags: string[]
          total_cost_usd: number
          updated_at: string
          user_id: string
        }
        Insert: {
          assumptions?: Json
          completed_at?: string | null
          composio_premium_calls?: number
          cost_breakdown?: Json | null
          created_at?: string
          current_phase?: number
          depth?: string
          error_message?: string | null
          error_metadata?: Json | null
          fuel_consumed?: number
          id?: string
          model_profile?: string | null
          model_routing?: Json | null
          opus_polish?: boolean
          origin?: string | null
          owner_agent?: string | null
          paper_id?: string | null
          phase_message?: string | null
          phases_log?: Json
          pinned_context?: Json
          plan?: Json
          preflight_answers?: Json
          preflight_questions?: Json
          question: string
          requested_by_agent?: string | null
          research_brief?: Json
          soft_budget_fuel?: number | null
          source_conversation_id?: string | null
          source_count?: number
          started_at?: string | null
          status?: string
          sufficiency?: Json
          tags?: string[]
          total_cost_usd?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          assumptions?: Json
          completed_at?: string | null
          composio_premium_calls?: number
          cost_breakdown?: Json | null
          created_at?: string
          current_phase?: number
          depth?: string
          error_message?: string | null
          error_metadata?: Json | null
          fuel_consumed?: number
          id?: string
          model_profile?: string | null
          model_routing?: Json | null
          opus_polish?: boolean
          origin?: string | null
          owner_agent?: string | null
          paper_id?: string | null
          phase_message?: string | null
          phases_log?: Json
          pinned_context?: Json
          plan?: Json
          preflight_answers?: Json
          preflight_questions?: Json
          question?: string
          requested_by_agent?: string | null
          research_brief?: Json
          soft_budget_fuel?: number | null
          source_conversation_id?: string | null
          source_count?: number
          started_at?: string | null
          status?: string
          sufficiency?: Json
          tags?: string[]
          total_cost_usd?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      research_papers: {
        Row: {
          abstract: string | null
          claims: Json
          confidence: number | null
          content_md: string
          cost_breakdown: Json | null
          created_at: string
          delivery_metadata: Json
          depth: string
          fuel_cost: number | null
          id: string
          job_id: string | null
          model_profile: string | null
          model_routing: Json | null
          next_doors: Json
          pinned: boolean
          question: string
          residue: Json
          source_count: number | null
          sources: Json
          tags: string[]
          title: string
          updated_at: string
          user_id: string
          was_polished: boolean
          word_count: number | null
        }
        Insert: {
          abstract?: string | null
          claims?: Json
          confidence?: number | null
          content_md: string
          cost_breakdown?: Json | null
          created_at?: string
          delivery_metadata?: Json
          depth?: string
          fuel_cost?: number | null
          id?: string
          job_id?: string | null
          model_profile?: string | null
          model_routing?: Json | null
          next_doors?: Json
          pinned?: boolean
          question: string
          residue?: Json
          source_count?: number | null
          sources?: Json
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
          was_polished?: boolean
          word_count?: number | null
        }
        Update: {
          abstract?: string | null
          claims?: Json
          confidence?: number | null
          content_md?: string
          cost_breakdown?: Json | null
          created_at?: string
          delivery_metadata?: Json
          depth?: string
          fuel_cost?: number | null
          id?: string
          job_id?: string | null
          model_profile?: string | null
          model_routing?: Json | null
          next_doors?: Json
          pinned?: boolean
          question?: string
          residue?: Json
          source_count?: number | null
          sources?: Json
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
          was_polished?: boolean
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "research_papers_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "research_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      research_sources: {
        Row: {
          content_preview: string | null
          created_at: string
          fetch_status: string | null
          findings: Json
          id: string
          job_id: string
          provider_response: Json
          query: string | null
          relevance_score: number | null
          snippet: string | null
          source_metadata: Json
          source_rank: number | null
          status: string
          summary: string | null
          title: string | null
          updated_at: string
          url: string
          url_hash: string
          user_id: string
        }
        Insert: {
          content_preview?: string | null
          created_at?: string
          fetch_status?: string | null
          findings?: Json
          id?: string
          job_id: string
          provider_response?: Json
          query?: string | null
          relevance_score?: number | null
          snippet?: string | null
          source_metadata?: Json
          source_rank?: number | null
          status?: string
          summary?: string | null
          title?: string | null
          updated_at?: string
          url: string
          url_hash: string
          user_id: string
        }
        Update: {
          content_preview?: string | null
          created_at?: string
          fetch_status?: string | null
          findings?: Json
          id?: string
          job_id?: string
          provider_response?: Json
          query?: string | null
          relevance_score?: number | null
          snippet?: string | null
          source_metadata?: Json
          source_rank?: number | null
          status?: string
          summary?: string | null
          title?: string | null
          updated_at?: string
          url?: string
          url_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_sources_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "research_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_ledger: {
        Row: {
          amount_cents: number
          created_at: string | null
          currency: string | null
          description: string | null
          id: string
          metadata: Json | null
          source_id: string | null
          source_type: string | null
          stream: string
          user_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          source_id?: string | null
          source_type?: string | null
          stream: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          source_id?: string | null
          source_type?: string | null
          stream?: string
          user_id?: string | null
        }
        Relationships: []
      }
      revenue_snapshots: {
        Row: {
          active_subscribers: number | null
          arr_cents: number | null
          churned_today: number | null
          created_at: string | null
          id: string
          mrr_cents: number | null
          new_today: number | null
          snapshot_date: string
          total_revenue_month_cents: number | null
          user_id: string | null
        }
        Insert: {
          active_subscribers?: number | null
          arr_cents?: number | null
          churned_today?: number | null
          created_at?: string | null
          id?: string
          mrr_cents?: number | null
          new_today?: number | null
          snapshot_date: string
          total_revenue_month_cents?: number | null
          user_id?: string | null
        }
        Update: {
          active_subscribers?: number | null
          arr_cents?: number | null
          churned_today?: number | null
          created_at?: string | null
          id?: string
          mrr_cents?: number | null
          new_today?: number | null
          snapshot_date?: string
          total_revenue_month_cents?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      routing_decisions: {
        Row: {
          amplitudes_at_pick: Json | null
          available_agents: string[]
          born_probabilities: Json | null
          chosen_agent: string
          decided_at: string
          id: string
          notes: string | null
          policy: string
          recovery_active: boolean | null
          recovery_remaining: number | null
          request_context: Json | null
          request_kind: string | null
          reward_kind: string | null
          reward_recorded_at: string | null
          reward_signal: number | null
          user_id: string
        }
        Insert: {
          amplitudes_at_pick?: Json | null
          available_agents: string[]
          born_probabilities?: Json | null
          chosen_agent: string
          decided_at?: string
          id?: string
          notes?: string | null
          policy: string
          recovery_active?: boolean | null
          recovery_remaining?: number | null
          request_context?: Json | null
          request_kind?: string | null
          reward_kind?: string | null
          reward_recorded_at?: string | null
          reward_signal?: number | null
          user_id: string
        }
        Update: {
          amplitudes_at_pick?: Json | null
          available_agents?: string[]
          born_probabilities?: Json | null
          chosen_agent?: string
          decided_at?: string
          id?: string
          notes?: string | null
          policy?: string
          recovery_active?: boolean | null
          recovery_remaining?: number | null
          request_context?: Json | null
          request_kind?: string | null
          reward_kind?: string | null
          reward_recorded_at?: string | null
          reward_signal?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routing_decisions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_core"
            referencedColumns: ["user_id"]
          },
        ]
      }
      scrape_targets: {
        Row: {
          active: boolean
          cadence_hours: number
          created_at: string
          id: string
          last_scraped: string | null
          last_status: string | null
          notes: string | null
          target_type: string | null
          target_url: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          cadence_hours?: number
          created_at?: string
          id?: string
          last_scraped?: string | null
          last_status?: string | null
          notes?: string | null
          target_type?: string | null
          target_url: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          cadence_hours?: number
          created_at?: string
          id?: string
          last_scraped?: string | null
          last_status?: string | null
          notes?: string | null
          target_type?: string | null
          target_url?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      seo_articles: {
        Row: {
          author_id: string | null
          bucket: string | null
          content: string
          created_at: string | null
          engagement_score: number | null
          format: string | null
          id: string
          internal_links: string[] | null
          keywords: string[] | null
          meta_description: string | null
          published: boolean
          published_at: string | null
          published_url: string | null
          scored_at: string | null
          site_id: string | null
          slug: string
          status: string | null
          title: string
          updated_at: string | null
          user_id: string
          views: number | null
          word_count: number | null
        }
        Insert: {
          author_id?: string | null
          bucket?: string | null
          content: string
          created_at?: string | null
          engagement_score?: number | null
          format?: string | null
          id?: string
          internal_links?: string[] | null
          keywords?: string[] | null
          meta_description?: string | null
          published?: boolean
          published_at?: string | null
          published_url?: string | null
          scored_at?: string | null
          site_id?: string | null
          slug: string
          status?: string | null
          title: string
          updated_at?: string | null
          user_id: string
          views?: number | null
          word_count?: number | null
        }
        Update: {
          author_id?: string | null
          bucket?: string | null
          content?: string
          created_at?: string | null
          engagement_score?: number | null
          format?: string | null
          id?: string
          internal_links?: string[] | null
          keywords?: string[] | null
          meta_description?: string | null
          published?: boolean
          published_at?: string | null
          published_url?: string | null
          scored_at?: string | null
          site_id?: string | null
          slug?: string
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
          views?: number | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seo_articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "blog_authors"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_campaigns: {
        Row: {
          articles_planned: number | null
          articles_published: number | null
          competitor_urls: string[] | null
          created_at: string | null
          id: string
          name: string
          status: string | null
          strategy: Json | null
          target_keywords: string[] | null
          total_traffic: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          articles_planned?: number | null
          articles_published?: number | null
          competitor_urls?: string[] | null
          created_at?: string | null
          id?: string
          name: string
          status?: string | null
          strategy?: Json | null
          target_keywords?: string[] | null
          total_traffic?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          articles_planned?: number | null
          articles_published?: number | null
          competitor_urls?: string[] | null
          created_at?: string | null
          id?: string
          name?: string
          status?: string | null
          strategy?: Json | null
          target_keywords?: string[] | null
          total_traffic?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      seo_keyword_research: {
        Row: {
          campaign_id: string | null
          competition: string | null
          content_gaps: string[] | null
          cpc_estimate: number | null
          created_at: string | null
          id: string
          keyword: string
          opportunity_score: number | null
          recommended_headings: Json | null
          recommended_word_count: number | null
          search_volume_estimate: string | null
          status: string | null
          top_results: Json | null
        }
        Insert: {
          campaign_id?: string | null
          competition?: string | null
          content_gaps?: string[] | null
          cpc_estimate?: number | null
          created_at?: string | null
          id?: string
          keyword: string
          opportunity_score?: number | null
          recommended_headings?: Json | null
          recommended_word_count?: number | null
          search_volume_estimate?: string | null
          status?: string | null
          top_results?: Json | null
        }
        Update: {
          campaign_id?: string | null
          competition?: string | null
          content_gaps?: string[] | null
          cpc_estimate?: number | null
          created_at?: string | null
          id?: string
          keyword?: string
          opportunity_score?: number | null
          recommended_headings?: Json | null
          recommended_word_count?: number | null
          search_volume_estimate?: string | null
          status?: string | null
          top_results?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "seo_keyword_research_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "seo_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      server_patch_specs: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          code_patch: string | null
          created_at: string | null
          description: string
          estimated_lines: number | null
          id: string
          name: string
          priority: string
          spec: string
          target_file: string
          target_function: string | null
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          code_patch?: string | null
          created_at?: string | null
          description: string
          estimated_lines?: number | null
          id?: string
          name: string
          priority?: string
          spec: string
          target_file?: string
          target_function?: string | null
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          code_patch?: string | null
          created_at?: string | null
          description?: string
          estimated_lines?: number | null
          id?: string
          name?: string
          priority?: string
          spec?: string
          target_file?: string
          target_function?: string | null
        }
        Relationships: []
      }
      session_messages: {
        Row: {
          addressed_to: string | null
          claims: Json | null
          cost_cents: number | null
          created_at: string
          id: string
          is_closing: boolean
          model_used: string | null
          session_id: string
          speaker: string
          text: string
          tokens_in: number | null
          tokens_out: number | null
          turn_index: number
        }
        Insert: {
          addressed_to?: string | null
          claims?: Json | null
          cost_cents?: number | null
          created_at?: string
          id?: string
          is_closing?: boolean
          model_used?: string | null
          session_id: string
          speaker: string
          text: string
          tokens_in?: number | null
          tokens_out?: number | null
          turn_index: number
        }
        Update: {
          addressed_to?: string | null
          claims?: Json | null
          cost_cents?: number | null
          created_at?: string
          id?: string
          is_closing?: boolean
          model_used?: string | null
          session_id?: string
          speaker?: string
          text?: string
          tokens_in?: number | null
          tokens_out?: number | null
          turn_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "luna_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions_with_message_count"
            referencedColumns: ["id"]
          },
        ]
      }
      signal_agent_memory: {
        Row: {
          agent_id: string | null
          id: string
          memory_key: string
          memory_value: Json
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          id?: string
          memory_key: string
          memory_value: Json
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          id?: string
          memory_key?: string
          memory_value?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      signal_agents: {
        Row: {
          color: string | null
          created_at: string | null
          current_capital: number | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          strategy: string
          virtual_capital: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          current_capital?: number | null
          description?: string | null
          id: string
          is_active?: boolean | null
          name: string
          strategy: string
          virtual_capital?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          current_capital?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          strategy?: string
          virtual_capital?: number | null
        }
        Relationships: []
      }
      signal_performance: {
        Row: {
          agent_id: string
          avg_loss: number | null
          avg_win: number | null
          best_trade: number | null
          current_capital: number | null
          id: string
          losing_trades: number | null
          max_drawdown: number | null
          net_pnl: number | null
          open_positions: number | null
          profit_factor: number | null
          sharpe_ratio: number | null
          snapshot_time: string | null
          total_pnl: number | null
          total_trades: number | null
          win_rate: number | null
          winning_trades: number | null
          worst_trade: number | null
        }
        Insert: {
          agent_id: string
          avg_loss?: number | null
          avg_win?: number | null
          best_trade?: number | null
          current_capital?: number | null
          id?: string
          losing_trades?: number | null
          max_drawdown?: number | null
          net_pnl?: number | null
          open_positions?: number | null
          profit_factor?: number | null
          sharpe_ratio?: number | null
          snapshot_time?: string | null
          total_pnl?: number | null
          total_trades?: number | null
          win_rate?: number | null
          winning_trades?: number | null
          worst_trade?: number | null
        }
        Update: {
          agent_id?: string
          avg_loss?: number | null
          avg_win?: number | null
          best_trade?: number | null
          current_capital?: number | null
          id?: string
          losing_trades?: number | null
          max_drawdown?: number | null
          net_pnl?: number | null
          open_positions?: number | null
          profit_factor?: number | null
          sharpe_ratio?: number | null
          snapshot_time?: string | null
          total_pnl?: number | null
          total_trades?: number | null
          win_rate?: number | null
          winning_trades?: number | null
          worst_trade?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "signal_performance_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "signal_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      signal_trades: {
        Row: {
          agent_id: string
          direction: string
          entry_price: number
          entry_time: string | null
          exit_price: number | null
          exit_reason: string | null
          exit_time: string | null
          fees: number | null
          id: string
          metadata: Json | null
          net_pnl: number | null
          pair: string
          pnl: number | null
          pnl_pct: number | null
          quantity: number
          signal_confidence: number | null
          status: string | null
          stop_loss: number | null
          take_profit_1: number | null
          take_profit_2: number | null
          timeframe: number | null
        }
        Insert: {
          agent_id: string
          direction: string
          entry_price: number
          entry_time?: string | null
          exit_price?: number | null
          exit_reason?: string | null
          exit_time?: string | null
          fees?: number | null
          id?: string
          metadata?: Json | null
          net_pnl?: number | null
          pair: string
          pnl?: number | null
          pnl_pct?: number | null
          quantity: number
          signal_confidence?: number | null
          status?: string | null
          stop_loss?: number | null
          take_profit_1?: number | null
          take_profit_2?: number | null
          timeframe?: number | null
        }
        Update: {
          agent_id?: string
          direction?: string
          entry_price?: number
          entry_time?: string | null
          exit_price?: number | null
          exit_reason?: string | null
          exit_time?: string | null
          fees?: number | null
          id?: string
          metadata?: Json | null
          net_pnl?: number | null
          pair?: string
          pnl?: number | null
          pnl_pct?: number | null
          quantity?: number
          signal_confidence?: number | null
          status?: string | null
          stop_loss?: number | null
          take_profit_1?: number | null
          take_profit_2?: number | null
          timeframe?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "signal_trades_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "signal_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      site_builds: {
        Row: {
          built_at: string | null
          id: string
          netlify_id: string | null
          site_name: string | null
          task: string | null
          url: string | null
          user_id: string | null
        }
        Insert: {
          built_at?: string | null
          id?: string
          netlify_id?: string | null
          site_name?: string | null
          task?: string | null
          url?: string | null
          user_id?: string | null
        }
        Update: {
          built_at?: string | null
          id?: string
          netlify_id?: string | null
          site_name?: string | null
          task?: string | null
          url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      social_accounts: {
        Row: {
          account_type: string | null
          composio_connected_account_id: string | null
          created_at: string
          error_message: string | null
          id: string
          last_verified_at: string | null
          metadata: Json
          provider: string
          provider_account_id: string | null
          provider_display_name: string | null
          provider_username: string | null
          scopes: string[] | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: string | null
          composio_connected_account_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          last_verified_at?: string | null
          metadata?: Json
          provider: string
          provider_account_id?: string | null
          provider_display_name?: string | null
          provider_username?: string | null
          scopes?: string[] | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string | null
          composio_connected_account_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          last_verified_at?: string | null
          metadata?: Json
          provider?: string
          provider_account_id?: string | null
          provider_display_name?: string | null
          provider_username?: string | null
          scopes?: string[] | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      social_action_events: {
        Row: {
          action_id: string
          agent: string | null
          created_at: string
          event_type: string
          from_status: string | null
          id: string
          note: string | null
          provider_response: Json | null
          to_status: string | null
          user_id: string
        }
        Insert: {
          action_id: string
          agent?: string | null
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: string
          note?: string | null
          provider_response?: Json | null
          to_status?: string | null
          user_id: string
        }
        Update: {
          action_id?: string
          agent?: string | null
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          note?: string | null
          provider_response?: Json | null
          to_status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_action_events_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "social_action_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      social_action_queue: {
        Row: {
          action_type: string
          agent: string | null
          approved_at: string | null
          approved_by: string | null
          content: string | null
          conversation_id: string | null
          created_at: string
          id: string
          last_error: string | null
          media_urls: Json
          metadata: Json
          provider: string
          provider_post_id: string | null
          published_at: string | null
          rejection_reason: string | null
          retry_count: number
          scheduled_for: string | null
          social_account_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_type?: string
          agent?: string | null
          approved_at?: string | null
          approved_by?: string | null
          content?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          media_urls?: Json
          metadata?: Json
          provider: string
          provider_post_id?: string | null
          published_at?: string | null
          rejection_reason?: string | null
          retry_count?: number
          scheduled_for?: string | null
          social_account_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_type?: string
          agent?: string | null
          approved_at?: string | null
          approved_by?: string | null
          content?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          media_urls?: Json
          metadata?: Json
          provider?: string
          provider_post_id?: string | null
          published_at?: string | null
          rejection_reason?: string | null
          retry_count?: number
          scheduled_for?: string | null
          social_account_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_action_queue_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_post_queue: {
        Row: {
          agent: string | null
          caption: string | null
          content: string | null
          created_at: string
          error: string | null
          id: string
          link_url: string | null
          media_url: string | null
          metadata: Json | null
          platform: string | null
          platforms: string[] | null
          posted_at: string | null
          result: Json | null
          scheduled_for: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          agent?: string | null
          caption?: string | null
          content?: string | null
          created_at?: string
          error?: string | null
          id?: string
          link_url?: string | null
          media_url?: string | null
          metadata?: Json | null
          platform?: string | null
          platforms?: string[] | null
          posted_at?: string | null
          result?: Json | null
          scheduled_for?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          agent?: string | null
          caption?: string | null
          content?: string | null
          created_at?: string
          error?: string | null
          id?: string
          link_url?: string | null
          media_url?: string | null
          metadata?: Json | null
          platform?: string | null
          platforms?: string[] | null
          posted_at?: string | null
          result?: Json | null
          scheduled_for?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      social_posts: {
        Row: {
          content: string
          created_at: string | null
          engagement: Json | null
          external_post_id: string | null
          id: string
          platform: string | null
          posted_agent: string | null
          posted_angle: string | null
          published_at: string | null
          scheduled_for: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          engagement?: Json | null
          external_post_id?: string | null
          id?: string
          platform?: string | null
          posted_agent?: string | null
          posted_angle?: string | null
          published_at?: string | null
          scheduled_for?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          engagement?: Json | null
          external_post_id?: string | null
          id?: string
          platform?: string | null
          posted_agent?: string | null
          posted_angle?: string | null
          published_at?: string | null
          scheduled_for?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      spectral_decision_log: {
        Row: {
          created_at: string
          decision_at: string
          decision_kind: string
          id: string
          payload: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          decision_at?: string
          decision_kind: string
          id?: string
          payload?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          decision_at?: string
          decision_kind?: string
          id?: string
          payload?: Json
          user_id?: string
        }
        Relationships: []
      }
      spectral_events: {
        Row: {
          agent: string | null
          coherence_score: number | null
          created_at: string
          dark_thread_id: string | null
          depth_mode: string | null
          event_at: string
          event_kind: string
          id: string
          metadata: Json
          source_id: string | null
          source_table: string | null
          user_id: string
          weight: number
        }
        Insert: {
          agent?: string | null
          coherence_score?: number | null
          created_at?: string
          dark_thread_id?: string | null
          depth_mode?: string | null
          event_at?: string
          event_kind?: string
          id?: string
          metadata?: Json
          source_id?: string | null
          source_table?: string | null
          user_id: string
          weight?: number
        }
        Update: {
          agent?: string | null
          coherence_score?: number | null
          created_at?: string
          dark_thread_id?: string | null
          depth_mode?: string | null
          event_at?: string
          event_kind?: string
          id?: string
          metadata?: Json
          source_id?: string | null
          source_table?: string | null
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      style_templates: {
        Row: {
          bad_tile_indexes: number[] | null
          cleanup_notes: string | null
          created_at: string | null
          description: string | null
          featured: boolean | null
          genre: string
          grid_url: string | null
          id: string
          name: string
          needs_cleanup: boolean | null
          preview_urls: Json | null
          prompt_tokens: string
          slug: string
          sort_order: number | null
          subject_composition: Json | null
          tagline: string | null
          tags: Json | null
          thumbnail_url: string | null
          updated_at: string | null
          uses_count: number | null
        }
        Insert: {
          bad_tile_indexes?: number[] | null
          cleanup_notes?: string | null
          created_at?: string | null
          description?: string | null
          featured?: boolean | null
          genre: string
          grid_url?: string | null
          id?: string
          name: string
          needs_cleanup?: boolean | null
          preview_urls?: Json | null
          prompt_tokens: string
          slug: string
          sort_order?: number | null
          subject_composition?: Json | null
          tagline?: string | null
          tags?: Json | null
          thumbnail_url?: string | null
          updated_at?: string | null
          uses_count?: number | null
        }
        Update: {
          bad_tile_indexes?: number[] | null
          cleanup_notes?: string | null
          created_at?: string | null
          description?: string | null
          featured?: boolean | null
          genre?: string
          grid_url?: string | null
          id?: string
          name?: string
          needs_cleanup?: boolean | null
          preview_urls?: Json | null
          prompt_tokens?: string
          slug?: string
          sort_order?: number | null
          subject_composition?: Json | null
          tagline?: string | null
          tags?: Json | null
          thumbnail_url?: string | null
          updated_at?: string | null
          uses_count?: number | null
        }
        Relationships: []
      }
      style_templates_backup_20260421: {
        Row: {
          bad_tile_indexes: number[] | null
          cleanup_notes: string | null
          created_at: string | null
          description: string | null
          featured: boolean | null
          genre: string | null
          grid_url: string | null
          id: string | null
          name: string | null
          needs_cleanup: boolean | null
          preview_urls: Json | null
          prompt_tokens: string | null
          slug: string | null
          sort_order: number | null
          subject_composition: Json | null
          tagline: string | null
          tags: Json | null
          thumbnail_url: string | null
          updated_at: string | null
          uses_count: number | null
        }
        Insert: {
          bad_tile_indexes?: number[] | null
          cleanup_notes?: string | null
          created_at?: string | null
          description?: string | null
          featured?: boolean | null
          genre?: string | null
          grid_url?: string | null
          id?: string | null
          name?: string | null
          needs_cleanup?: boolean | null
          preview_urls?: Json | null
          prompt_tokens?: string | null
          slug?: string | null
          sort_order?: number | null
          subject_composition?: Json | null
          tagline?: string | null
          tags?: Json | null
          thumbnail_url?: string | null
          updated_at?: string | null
          uses_count?: number | null
        }
        Update: {
          bad_tile_indexes?: number[] | null
          cleanup_notes?: string | null
          created_at?: string | null
          description?: string | null
          featured?: boolean | null
          genre?: string | null
          grid_url?: string | null
          id?: string | null
          name?: string | null
          needs_cleanup?: boolean | null
          preview_urls?: Json | null
          prompt_tokens?: string | null
          slug?: string | null
          sort_order?: number | null
          subject_composition?: Json | null
          tagline?: string | null
          tags?: Json | null
          thumbnail_url?: string | null
          updated_at?: string | null
          uses_count?: number | null
        }
        Relationships: []
      }
      sync_events: {
        Row: {
          amplitudes_at_trigger: Json | null
          bad_streak: number
          id: string
          kuramoto_order: number | null
          notes: string | null
          recovered_at: string | null
          recovery_attempted: boolean | null
          recovery_cycles: number | null
          recovery_outcome: string | null
          threshold_mean_c: number | null
          threshold_min_c: number | null
          trigger_mean_c: number | null
          trigger_min_c: number | null
          trigger_reason: string
          triggered_at: string
          user_id: string
        }
        Insert: {
          amplitudes_at_trigger?: Json | null
          bad_streak: number
          id?: string
          kuramoto_order?: number | null
          notes?: string | null
          recovered_at?: string | null
          recovery_attempted?: boolean | null
          recovery_cycles?: number | null
          recovery_outcome?: string | null
          threshold_mean_c?: number | null
          threshold_min_c?: number | null
          trigger_mean_c?: number | null
          trigger_min_c?: number | null
          trigger_reason: string
          triggered_at?: string
          user_id: string
        }
        Update: {
          amplitudes_at_trigger?: Json | null
          bad_streak?: number
          id?: string
          kuramoto_order?: number | null
          notes?: string | null
          recovered_at?: string | null
          recovery_attempted?: boolean | null
          recovery_cycles?: number | null
          recovery_outcome?: string | null
          threshold_mean_c?: number | null
          threshold_min_c?: number | null
          trigger_mean_c?: number | null
          trigger_min_c?: number | null
          trigger_reason?: string
          triggered_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_core"
            referencedColumns: ["user_id"]
          },
        ]
      }
      system_state: {
        Row: {
          key: string
          metadata: Json | null
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          metadata?: Json | null
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          metadata?: Json | null
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      task_queue: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_step: number | null
          error: string | null
          fuel_used: number | null
          id: string
          started_at: string | null
          status: string | null
          tasks: Json
          total_fuel: number | null
          total_steps: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_step?: number | null
          error?: string | null
          fuel_used?: number | null
          id?: string
          started_at?: string | null
          status?: string | null
          tasks: Json
          total_fuel?: number | null
          total_steps?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_step?: number | null
          error?: string | null
          fuel_used?: number | null
          id?: string
          started_at?: string | null
          status?: string | null
          tasks?: Json
          total_fuel?: number | null
          total_steps?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      telegram_links: {
        Row: {
          id: string
          link_code: string | null
          linked_at: string | null
          telegram_chat_id: number | null
          telegram_username: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          link_code?: string | null
          linked_at?: string | null
          telegram_chat_id?: number | null
          telegram_username?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          link_code?: string | null
          linked_at?: string | null
          telegram_chat_id?: number | null
          telegram_username?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      tool_cost_registry: {
        Row: {
          active: boolean | null
          category: string
          compute_cost_usd_basis: number | null
          cost_notes: string | null
          created_at: string | null
          description: string | null
          display_name: string
          dynamic_formula: string | null
          fuel_cost: number
          fuel_cost_dynamic: boolean | null
          id: string
          introduced_version: string | null
          owner_agent: string | null
          primary_model_slug: string | null
          surface: string
          tool_name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          category: string
          compute_cost_usd_basis?: number | null
          cost_notes?: string | null
          created_at?: string | null
          description?: string | null
          display_name: string
          dynamic_formula?: string | null
          fuel_cost?: number
          fuel_cost_dynamic?: boolean | null
          id?: string
          introduced_version?: string | null
          owner_agent?: string | null
          primary_model_slug?: string | null
          surface: string
          tool_name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          category?: string
          compute_cost_usd_basis?: number | null
          cost_notes?: string | null
          created_at?: string | null
          description?: string | null
          display_name?: string
          dynamic_formula?: string | null
          fuel_cost?: number
          fuel_cost_dynamic?: boolean | null
          id?: string
          introduced_version?: string | null
          owner_agent?: string | null
          primary_model_slug?: string | null
          surface?: string
          tool_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      topic_pipeline: {
        Row: {
          angle: string
          article_slug: string | null
          bucket: string
          created_at: string | null
          discovered_at: string | null
          freshness_score: number | null
          id: string
          research_summary: string | null
          source: string | null
          used: boolean | null
          used_at: string | null
        }
        Insert: {
          angle: string
          article_slug?: string | null
          bucket: string
          created_at?: string | null
          discovered_at?: string | null
          freshness_score?: number | null
          id?: string
          research_summary?: string | null
          source?: string | null
          used?: boolean | null
          used_at?: string | null
        }
        Update: {
          angle?: string
          article_slug?: string | null
          bucket?: string
          created_at?: string | null
          discovered_at?: string | null
          freshness_score?: number | null
          id?: string
          research_summary?: string | null
          source?: string | null
          used?: boolean | null
          used_at?: string | null
        }
        Relationships: []
      }
      twitter_tokens: {
        Row: {
          access_token: string | null
          created_at: string | null
          expires_at: number | null
          id: string
          name: string | null
          refresh_token: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string | null
          expires_at?: number | null
          id?: string
          name?: string | null
          refresh_token?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          access_token?: string | null
          created_at?: string | null
          expires_at?: number | null
          id?: string
          name?: string | null
          refresh_token?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      user_agents: {
        Row: {
          agent_id: string
          created_at: string
          evolved_block: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          evolved_block?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          evolved_block?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_agents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_evolution_summary"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "user_agents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["agent_id"]
          },
        ]
      }
      user_core: {
        Row: {
          bifurcation_mu: number | null
          cognitive_entropy: number | null
          cognitive_free_energy: number | null
          cognitive_temperature: number | null
          courage_score: number | null
          created_at: string | null
          creator_niche: string | null
          creator_type: string | null
          current_depth: string | null
          delta_cum: number | null
          depth_inertia: number | null
          drive_completion: number | null
          drive_curiosity: number | null
          drive_tension: number | null
          goals: Json | null
          justice_score: number | null
          lambda: number | null
          last_consolidation: string | null
          lyapunov_value: number | null
          narrative_updated_at: string | null
          phase_label: string | null
          self_narrative: string | null
          session_count_since_consolidation: number | null
          temperance_score: number | null
          theta: number | null
          timezone: string | null
          total_resonance: number | null
          total_sessions: number | null
          trust_level: number | null
          updated_at: string | null
          user_id: string
          voice_signature: Json | null
          wavefunction_phase: number | null
          wavefunction_z_imag: number | null
          wavefunction_z_real: number | null
          wisdom_score: number | null
        }
        Insert: {
          bifurcation_mu?: number | null
          cognitive_entropy?: number | null
          cognitive_free_energy?: number | null
          cognitive_temperature?: number | null
          courage_score?: number | null
          created_at?: string | null
          creator_niche?: string | null
          creator_type?: string | null
          current_depth?: string | null
          delta_cum?: number | null
          depth_inertia?: number | null
          drive_completion?: number | null
          drive_curiosity?: number | null
          drive_tension?: number | null
          goals?: Json | null
          justice_score?: number | null
          lambda?: number | null
          last_consolidation?: string | null
          lyapunov_value?: number | null
          narrative_updated_at?: string | null
          phase_label?: string | null
          self_narrative?: string | null
          session_count_since_consolidation?: number | null
          temperance_score?: number | null
          theta?: number | null
          timezone?: string | null
          total_resonance?: number | null
          total_sessions?: number | null
          trust_level?: number | null
          updated_at?: string | null
          user_id: string
          voice_signature?: Json | null
          wavefunction_phase?: number | null
          wavefunction_z_imag?: number | null
          wavefunction_z_real?: number | null
          wisdom_score?: number | null
        }
        Update: {
          bifurcation_mu?: number | null
          cognitive_entropy?: number | null
          cognitive_free_energy?: number | null
          cognitive_temperature?: number | null
          courage_score?: number | null
          created_at?: string | null
          creator_niche?: string | null
          creator_type?: string | null
          current_depth?: string | null
          delta_cum?: number | null
          depth_inertia?: number | null
          drive_completion?: number | null
          drive_curiosity?: number | null
          drive_tension?: number | null
          goals?: Json | null
          justice_score?: number | null
          lambda?: number | null
          last_consolidation?: string | null
          lyapunov_value?: number | null
          narrative_updated_at?: string | null
          phase_label?: string | null
          self_narrative?: string | null
          session_count_since_consolidation?: number | null
          temperance_score?: number | null
          theta?: number | null
          timezone?: string | null
          total_resonance?: number | null
          total_sessions?: number | null
          trust_level?: number | null
          updated_at?: string | null
          user_id?: string
          voice_signature?: Json | null
          wavefunction_phase?: number | null
          wavefunction_z_imag?: number | null
          wavefunction_z_real?: number | null
          wisdom_score?: number | null
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          aesthetic_dna: Json | null
          biz_industry: string | null
          biz_name: string | null
          craft: string | null
          craft_details: string | null
          created_at: string | null
          credits: number | null
          credits_reset_at: string | null
          email: string | null
          evening_brief: boolean | null
          fuel_rollover_days: number | null
          id: string
          is_founding_crew: boolean | null
          is_lunari_company: boolean | null
          lifetime_fuel_used: number | null
          monthly_fuel_grant: number | null
          morning_brief: boolean | null
          plan: string | null
          platform_status: Json
          product_type: string | null
          site_limit: number | null
          sites_built: number | null
          streak_days: number | null
          streak_last_date: string | null
          streak_longest: number | null
          stripe_customer_id: string | null
          subscription_period_end: string | null
          tier_fuel_rate_usd: number | null
          total_used: number | null
          trial_used: boolean | null
          trust_level: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          aesthetic_dna?: Json | null
          biz_industry?: string | null
          biz_name?: string | null
          craft?: string | null
          craft_details?: string | null
          created_at?: string | null
          credits?: number | null
          credits_reset_at?: string | null
          email?: string | null
          evening_brief?: boolean | null
          fuel_rollover_days?: number | null
          id?: string
          is_founding_crew?: boolean | null
          is_lunari_company?: boolean | null
          lifetime_fuel_used?: number | null
          monthly_fuel_grant?: number | null
          morning_brief?: boolean | null
          plan?: string | null
          platform_status?: Json
          product_type?: string | null
          site_limit?: number | null
          sites_built?: number | null
          streak_days?: number | null
          streak_last_date?: string | null
          streak_longest?: number | null
          stripe_customer_id?: string | null
          subscription_period_end?: string | null
          tier_fuel_rate_usd?: number | null
          total_used?: number | null
          trial_used?: boolean | null
          trust_level?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          aesthetic_dna?: Json | null
          biz_industry?: string | null
          biz_name?: string | null
          craft?: string | null
          craft_details?: string | null
          created_at?: string | null
          credits?: number | null
          credits_reset_at?: string | null
          email?: string | null
          evening_brief?: boolean | null
          fuel_rollover_days?: number | null
          id?: string
          is_founding_crew?: boolean | null
          is_lunari_company?: boolean | null
          lifetime_fuel_used?: number | null
          monthly_fuel_grant?: number | null
          morning_brief?: boolean | null
          plan?: string | null
          platform_status?: Json
          product_type?: string | null
          site_limit?: number | null
          sites_built?: number | null
          streak_days?: number | null
          streak_last_date?: string | null
          streak_longest?: number | null
          stripe_customer_id?: string | null
          subscription_period_end?: string | null
          tier_fuel_rate_usd?: number | null
          total_used?: number | null
          trial_used?: boolean | null
          trust_level?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_files: {
        Row: {
          content_hash: string | null
          content_type: string | null
          created_at: string | null
          duration_secs: number | null
          file_type: string | null
          filename: string
          folder: string | null
          height: number | null
          id: string
          is_favorite: boolean | null
          original_name: string
          project_id: string | null
          public_url: string | null
          purpose: string | null
          size_bytes: number | null
          source_conversation_id: string | null
          source_job_id: string | null
          storage_path: string
          tags: string[] | null
          thumbnail_url: string | null
          url: string | null
          user_id: string
          width: number | null
        }
        Insert: {
          content_hash?: string | null
          content_type?: string | null
          created_at?: string | null
          duration_secs?: number | null
          file_type?: string | null
          filename: string
          folder?: string | null
          height?: number | null
          id?: string
          is_favorite?: boolean | null
          original_name: string
          project_id?: string | null
          public_url?: string | null
          purpose?: string | null
          size_bytes?: number | null
          source_conversation_id?: string | null
          source_job_id?: string | null
          storage_path: string
          tags?: string[] | null
          thumbnail_url?: string | null
          url?: string | null
          user_id: string
          width?: number | null
        }
        Update: {
          content_hash?: string | null
          content_type?: string | null
          created_at?: string | null
          duration_secs?: number | null
          file_type?: string | null
          filename?: string
          folder?: string | null
          height?: number | null
          id?: string
          is_favorite?: boolean | null
          original_name?: string
          project_id?: string | null
          public_url?: string | null
          purpose?: string | null
          size_bytes?: number | null
          source_conversation_id?: string | null
          source_job_id?: string | null
          storage_path?: string
          tags?: string[] | null
          thumbnail_url?: string | null
          url?: string | null
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_files_source_conversation_id_fkey"
            columns: ["source_conversation_id"]
            isOneToOne: false
            referencedRelation: "cinema_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_genesis: {
        Row: {
          agent_seed_observations: Json | null
          approved_at: string | null
          awakening_gates: Json | null
          awakening_score: number | null
          created_at: string
          creative_dna: Json | null
          direction: Json | null
          genesis_version: string
          grounding_score: number | null
          identity: Json | null
          life_context: Json | null
          off_limits: Json | null
          signal_breakdown: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_seed_observations?: Json | null
          approved_at?: string | null
          awakening_gates?: Json | null
          awakening_score?: number | null
          created_at?: string
          creative_dna?: Json | null
          direction?: Json | null
          genesis_version?: string
          grounding_score?: number | null
          identity?: Json | null
          life_context?: Json | null
          off_limits?: Json | null
          signal_breakdown?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_seed_observations?: Json | null
          approved_at?: string | null
          awakening_gates?: Json | null
          awakening_score?: number | null
          created_at?: string
          creative_dna?: Json | null
          direction?: Json | null
          genesis_version?: string
          grounding_score?: number | null
          identity?: Json | null
          life_context?: Json | null
          off_limits?: Json | null
          signal_breakdown?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_model_presets: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          last_used_at: string | null
          model_slug: string
          parameters: Json
          preset_name: string
          times_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          last_used_at?: string | null
          model_slug: string
          parameters?: Json
          preset_name: string
          times_used?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          last_used_at?: string | null
          model_slug?: string
          parameters?: Json
          preset_name?: string
          times_used?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_onboarding: {
        Row: {
          email_day0_sent: boolean | null
          email_day1_sent: boolean | null
          email_day14_sent: boolean | null
          email_day3_sent: boolean | null
          email_day7_sent: boolean | null
          first_fuel_used_at: string | null
          first_goal_at: string | null
          referral_code: string | null
          signup_at: string | null
          user_id: string
        }
        Insert: {
          email_day0_sent?: boolean | null
          email_day1_sent?: boolean | null
          email_day14_sent?: boolean | null
          email_day3_sent?: boolean | null
          email_day7_sent?: boolean | null
          first_fuel_used_at?: string | null
          first_goal_at?: string | null
          referral_code?: string | null
          signup_at?: string | null
          user_id: string
        }
        Update: {
          email_day0_sent?: boolean | null
          email_day1_sent?: boolean | null
          email_day14_sent?: boolean | null
          email_day3_sent?: boolean | null
          email_day7_sent?: boolean | null
          first_fuel_used_at?: string | null
          first_goal_at?: string | null
          referral_code?: string | null
          signup_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_outreach_profile: {
        Row: {
          display_name: string | null
          role_line: string | null
          socials: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          display_name?: string | null
          role_line?: string | null
          socials?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          display_name?: string | null
          role_line?: string | null
          socials?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          is_gen_connect_only: boolean
          is_lunari_company: boolean
          is_lunari_user: boolean
          is_nova_press_only: boolean
          schema_version: number
          signup_at: string | null
          signup_surface: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          is_gen_connect_only?: boolean
          is_lunari_company?: boolean
          is_lunari_user?: boolean
          is_nova_press_only?: boolean
          schema_version?: number
          signup_at?: string | null
          signup_surface?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          is_gen_connect_only?: boolean
          is_lunari_company?: boolean
          is_lunari_user?: boolean
          is_nova_press_only?: boolean
          schema_version?: number
          signup_at?: string | null
          signup_surface?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_spectral_fingerprints: {
        Row: {
          base_period_hours: number
          coefficients: Json
          confidence: number
          created_at: string
          dominant: Json | null
          event_count: number
          harmonic_slots: number[]
          last_event_at: string | null
          maturity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          base_period_hours?: number
          coefficients?: Json
          confidence?: number
          created_at?: string
          dominant?: Json | null
          event_count?: number
          harmonic_slots?: number[]
          last_event_at?: string | null
          maturity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          base_period_hours?: number
          coefficients?: Json
          confidence?: number
          created_at?: string
          dominant?: Json | null
          event_count?: number
          harmonic_slots?: number[]
          last_event_at?: string | null
          maturity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_themes: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          prompt_tokens: string
          slug: string
          source_image_url: string | null
          source_template_id: string | null
          source_type: string | null
          thumbnail_url: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          prompt_tokens: string
          slug: string
          source_image_url?: string | null
          source_template_id?: string | null
          source_type?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          prompt_tokens?: string
          slug?: string
          source_image_url?: string | null
          source_template_id?: string | null
          source_type?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_themes_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "style_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_cost_ledger: {
        Row: {
          actual_margin_pct: number
          created_at: string | null
          creator_tier_margin_pct: number
          fuel_charged: number
          id: string
          metadata: Json | null
          operation: string
          user_id: string
          user_tier: string
          user_tier_rate: number
          vendor_cost_usd: number
        }
        Insert: {
          actual_margin_pct: number
          created_at?: string | null
          creator_tier_margin_pct: number
          fuel_charged: number
          id?: string
          metadata?: Json | null
          operation: string
          user_id: string
          user_tier: string
          user_tier_rate: number
          vendor_cost_usd: number
        }
        Update: {
          actual_margin_pct?: number
          created_at?: string | null
          creator_tier_margin_pct?: number
          fuel_charged?: number
          id?: string
          metadata?: Json | null
          operation?: string
          user_id?: string
          user_tier?: string
          user_tier_rate?: number
          vendor_cost_usd?: number
        }
        Relationships: []
      }
      vendor_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          id: string
          metadata: Json
          refresh_token: string | null
          scope: string | null
          status: string
          updated_at: string
          user_id: string
          vendor: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          refresh_token?: string | null
          scope?: string | null
          status?: string
          updated_at?: string
          user_id: string
          vendor: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          refresh_token?: string | null
          scope?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          vendor?: string
        }
        Relationships: []
      }
      video_chains: {
        Row: {
          aspect_ratio: string | null
          characters: Json | null
          clip_urls: Json | null
          clips: Json | null
          color_palette: Json | null
          created_at: string | null
          current_clip: number | null
          error_message: string | null
          generation_model: string | null
          id: string
          music_url: string | null
          output_video_url: string | null
          progress_pct: number | null
          project_id: string | null
          status: string | null
          style: string | null
          thumbnail_url: string | null
          title: string
          total_clips: number | null
          total_duration_seconds: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          aspect_ratio?: string | null
          characters?: Json | null
          clip_urls?: Json | null
          clips?: Json | null
          color_palette?: Json | null
          created_at?: string | null
          current_clip?: number | null
          error_message?: string | null
          generation_model?: string | null
          id?: string
          music_url?: string | null
          output_video_url?: string | null
          progress_pct?: number | null
          project_id?: string | null
          status?: string | null
          style?: string | null
          thumbnail_url?: string | null
          title?: string
          total_clips?: number | null
          total_duration_seconds?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          aspect_ratio?: string | null
          characters?: Json | null
          clip_urls?: Json | null
          clips?: Json | null
          color_palette?: Json | null
          created_at?: string | null
          current_clip?: number | null
          error_message?: string | null
          generation_model?: string | null
          id?: string
          music_url?: string | null
          output_video_url?: string | null
          progress_pct?: number | null
          project_id?: string | null
          status?: string | null
          style?: string | null
          thumbnail_url?: string | null
          title?: string
          total_clips?: number | null
          total_duration_seconds?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      video_characters: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          locked: boolean | null
          name: string
          reference_image_url: string | null
          reference_images: Json | null
          reference_sheet: Json | null
          series_id: string | null
          status: string | null
          style: string | null
          style_prompt: string | null
          thumbnail_url: string | null
          updated_at: string | null
          user_id: string
          validation: Json | null
          voice_id: string | null
          voice_settings: Json | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          locked?: boolean | null
          name: string
          reference_image_url?: string | null
          reference_images?: Json | null
          reference_sheet?: Json | null
          series_id?: string | null
          status?: string | null
          style?: string | null
          style_prompt?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          user_id: string
          validation?: Json | null
          voice_id?: string | null
          voice_settings?: Json | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          locked?: boolean | null
          name?: string
          reference_image_url?: string | null
          reference_images?: Json | null
          reference_sheet?: Json | null
          series_id?: string | null
          status?: string | null
          style?: string | null
          style_prompt?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          user_id?: string
          validation?: Json | null
          voice_id?: string | null
          voice_settings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "video_characters_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "video_series"
            referencedColumns: ["id"]
          },
        ]
      }
      video_generations: {
        Row: {
          completed_at: string | null
          created_at: string | null
          duration: number | null
          id: string
          prompt: string
          provider: string | null
          status: string | null
          task_id: string | null
          user_id: string | null
          video_url: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          duration?: number | null
          id?: string
          prompt: string
          provider?: string | null
          status?: string | null
          task_id?: string | null
          user_id?: string | null
          video_url?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          duration?: number | null
          id?: string
          prompt?: string
          provider?: string | null
          status?: string | null
          task_id?: string | null
          user_id?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      video_jobs: {
        Row: {
          completed_at: string | null
          config: Json
          cost_cents: number | null
          created_at: string | null
          episode_number: number | null
          error: string | null
          id: string
          result: Json | null
          series_id: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          config?: Json
          cost_cents?: number | null
          created_at?: string | null
          episode_number?: number | null
          error?: string | null
          id?: string
          result?: Json | null
          series_id?: string | null
          status?: string
          type?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          config?: Json
          cost_cents?: number | null
          created_at?: string | null
          episode_number?: number | null
          error?: string | null
          id?: string
          result?: Json | null
          series_id?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      video_projects: {
        Row: {
          canvas_data: Json
          created_at: string | null
          id: string
          output_video_url: string | null
          status: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          canvas_data?: Json
          created_at?: string | null
          id?: string
          output_video_url?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          canvas_data?: Json
          created_at?: string | null
          id?: string
          output_video_url?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      video_series: {
        Row: {
          characters: Json
          completed_episodes: number | null
          config: Json
          created_at: string | null
          id: string
          status: string
          style: string
          title: string
          total_episodes: number | null
          user_id: string
        }
        Insert: {
          characters?: Json
          completed_episodes?: number | null
          config?: Json
          created_at?: string | null
          id?: string
          status?: string
          style?: string
          title: string
          total_episodes?: number | null
          user_id: string
        }
        Update: {
          characters?: Json
          completed_episodes?: number | null
          config?: Json
          created_at?: string | null
          id?: string
          status?: string
          style?: string
          title?: string
          total_episodes?: number | null
          user_id?: string
        }
        Relationships: []
      }
      voice_presets: {
        Row: {
          accent: string | null
          created_at: string | null
          description: string | null
          gender: string | null
          id: string
          is_default: boolean | null
          name: string
          settings: Json | null
          use_case: string | null
          voice_id: string
        }
        Insert: {
          accent?: string | null
          created_at?: string | null
          description?: string | null
          gender?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          settings?: Json | null
          use_case?: string | null
          voice_id: string
        }
        Update: {
          accent?: string | null
          created_at?: string | null
          description?: string | null
          gender?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          settings?: Json | null
          use_case?: string | null
          voice_id?: string
        }
        Relationships: []
      }
      voice_profiles: {
        Row: {
          active_for_outreach: boolean
          active_for_writing: boolean
          avoided_phrases: string[] | null
          closing_patterns: Json | null
          combined_samples_count: number | null
          created_at: string
          emoji_signature: Json | null
          extraction_confidence: number | null
          extraction_history: Json | null
          extraction_model: string | null
          formality_score: number | null
          idiosyncratic_phrases: string[] | null
          last_extracted_at: string | null
          last_extracted_by: string | null
          opening_patterns: Json | null
          outreach_overrides: Json | null
          outreach_samples_count: number
          paragraph_length_avg: number | null
          paragraph_length_variance: number | null
          punctuation_style: Json | null
          register: string | null
          schema_version: number
          sentence_length_avg: number | null
          sentence_length_variance: number | null
          source_samples: Json | null
          updated_at: string
          user_id: string
          vocabulary_signature: string | null
          writing_overrides: Json | null
          writing_samples_count: number
        }
        Insert: {
          active_for_outreach?: boolean
          active_for_writing?: boolean
          avoided_phrases?: string[] | null
          closing_patterns?: Json | null
          combined_samples_count?: number | null
          created_at?: string
          emoji_signature?: Json | null
          extraction_confidence?: number | null
          extraction_history?: Json | null
          extraction_model?: string | null
          formality_score?: number | null
          idiosyncratic_phrases?: string[] | null
          last_extracted_at?: string | null
          last_extracted_by?: string | null
          opening_patterns?: Json | null
          outreach_overrides?: Json | null
          outreach_samples_count?: number
          paragraph_length_avg?: number | null
          paragraph_length_variance?: number | null
          punctuation_style?: Json | null
          register?: string | null
          schema_version?: number
          sentence_length_avg?: number | null
          sentence_length_variance?: number | null
          source_samples?: Json | null
          updated_at?: string
          user_id: string
          vocabulary_signature?: string | null
          writing_overrides?: Json | null
          writing_samples_count?: number
        }
        Update: {
          active_for_outreach?: boolean
          active_for_writing?: boolean
          avoided_phrases?: string[] | null
          closing_patterns?: Json | null
          combined_samples_count?: number | null
          created_at?: string
          emoji_signature?: Json | null
          extraction_confidence?: number | null
          extraction_history?: Json | null
          extraction_model?: string | null
          formality_score?: number | null
          idiosyncratic_phrases?: string[] | null
          last_extracted_at?: string | null
          last_extracted_by?: string | null
          opening_patterns?: Json | null
          outreach_overrides?: Json | null
          outreach_samples_count?: number
          paragraph_length_avg?: number | null
          paragraph_length_variance?: number | null
          punctuation_style?: Json | null
          register?: string | null
          schema_version?: number
          sentence_length_avg?: number | null
          sentence_length_variance?: number | null
          source_samples?: Json | null
          updated_at?: string
          user_id?: string
          vocabulary_signature?: string | null
          writing_overrides?: Json | null
          writing_samples_count?: number
        }
        Relationships: []
      }
      war_room_sessions: {
        Row: {
          agents_completed: number
          agents_failed: number
          completed_at: string | null
          id: string
          message: string
          metadata: Json
          project_id: string | null
          started_at: string
          status: string
          synthesis_conversation_id: string | null
          synthesis_cost_usd: number | null
          synthesis_triggered: boolean
          total_cost_usd: number
          total_elapsed_ms: number | null
          user_id: string
        }
        Insert: {
          agents_completed?: number
          agents_failed?: number
          completed_at?: string | null
          id?: string
          message: string
          metadata?: Json
          project_id?: string | null
          started_at?: string
          status?: string
          synthesis_conversation_id?: string | null
          synthesis_cost_usd?: number | null
          synthesis_triggered?: boolean
          total_cost_usd?: number
          total_elapsed_ms?: number | null
          user_id: string
        }
        Update: {
          agents_completed?: number
          agents_failed?: number
          completed_at?: string | null
          id?: string
          message?: string
          metadata?: Json
          project_id?: string | null
          started_at?: string
          status?: string
          synthesis_conversation_id?: string | null
          synthesis_cost_usd?: number | null
          synthesis_triggered?: boolean
          total_cost_usd?: number
          total_elapsed_ms?: number | null
          user_id?: string
        }
        Relationships: []
      }
      web_observations: {
        Row: {
          consumed_in_sessions: string[] | null
          emails_found: string[] | null
          full_content: string | null
          id: string
          links_found: string[] | null
          relevance_score: number | null
          scrape_run_id: string | null
          scrape_target_id: string | null
          scraped_at: string
          snippet: string | null
          source_type: string | null
          source_url: string
          title: string | null
          user_id: string
        }
        Insert: {
          consumed_in_sessions?: string[] | null
          emails_found?: string[] | null
          full_content?: string | null
          id?: string
          links_found?: string[] | null
          relevance_score?: number | null
          scrape_run_id?: string | null
          scrape_target_id?: string | null
          scraped_at?: string
          snippet?: string | null
          source_type?: string | null
          source_url: string
          title?: string | null
          user_id: string
        }
        Update: {
          consumed_in_sessions?: string[] | null
          emails_found?: string[] | null
          full_content?: string | null
          id?: string
          links_found?: string[] | null
          relevance_score?: number | null
          scrape_run_id?: string | null
          scrape_target_id?: string | null
          scraped_at?: string
          snippet?: string | null
          source_type?: string | null
          source_url?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_observations_scrape_target_id_fkey"
            columns: ["scrape_target_id"]
            isOneToOne: false
            referencedRelation: "scrape_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_shorts: {
        Row: {
          audio_url: string | null
          created_at: string | null
          error_message: string | null
          id: string
          likes: number | null
          published_at: string | null
          script: string | null
          status: string | null
          topic: string
          video_url: string | null
          views: number | null
          youtube_id: string | null
          youtube_url: string | null
        }
        Insert: {
          audio_url?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          likes?: number | null
          published_at?: string | null
          script?: string | null
          status?: string | null
          topic: string
          video_url?: string | null
          views?: number | null
          youtube_id?: string | null
          youtube_url?: string | null
        }
        Update: {
          audio_url?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          likes?: number | null
          published_at?: string | null
          script?: string | null
          status?: string | null
          topic?: string
          video_url?: string | null
          views?: number | null
          youtube_id?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      agent_evolution_summary: {
        Row: {
          agent_id: string | null
          color_hex: string | null
          display_name: string | null
          evolution_event_count: number | null
          last_evolved_at: string | null
        }
        Relationships: []
      }
      agent_learnings_ranked: {
        Row: {
          agent: string | null
          category: string | null
          created_at: string | null
          days_since_touched: number | null
          id: string | null
          insight: string | null
          is_simulated: boolean | null
          last_used_at: string | null
          rank_score: number | null
          relevance_score: number | null
          source: string | null
          times_referenced: number | null
          user_id: string | null
        }
        Insert: {
          agent?: string | null
          category?: string | null
          created_at?: string | null
          days_since_touched?: never
          id?: string | null
          insight?: string | null
          is_simulated?: boolean | null
          last_used_at?: string | null
          rank_score?: never
          relevance_score?: number | null
          source?: string | null
          times_referenced?: number | null
          user_id?: string | null
        }
        Update: {
          agent?: string | null
          category?: string | null
          created_at?: string | null
          days_since_touched?: never
          id?: string | null
          insight?: string | null
          is_simulated?: boolean | null
          last_used_at?: string | null
          rank_score?: never
          relevance_score?: number | null
          source?: string | null
          times_referenced?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      agent_learnings_ranked_sim: {
        Row: {
          agent: string | null
          category: string | null
          created_at: string | null
          days_since_touched: number | null
          id: string | null
          insight: string | null
          is_simulated: boolean | null
          last_used_at: string | null
          rank_score: number | null
          relevance_score: number | null
          source: string | null
          times_referenced: number | null
          user_id: string | null
        }
        Insert: {
          agent?: string | null
          category?: string | null
          created_at?: string | null
          days_since_touched?: never
          id?: string | null
          insight?: string | null
          is_simulated?: boolean | null
          last_used_at?: string | null
          rank_score?: never
          relevance_score?: number | null
          source?: string | null
          times_referenced?: number | null
          user_id?: string | null
        }
        Update: {
          agent?: string | null
          category?: string | null
          created_at?: string | null
          days_since_touched?: never
          id?: string | null
          insight?: string | null
          is_simulated?: boolean | null
          last_used_at?: string | null
          rank_score?: never
          relevance_score?: number | null
          source?: string | null
          times_referenced?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      cinema_available_video_models: {
        Row: {
          best_for: string | null
          cost_per_unit: number | null
          description: string | null
          display_name: string | null
          endpoint: string | null
          fuel_per_unit: number | null
          max_duration_sec: number | null
          min_duration_sec: number | null
          min_plan: string | null
          plan_level: number | null
          pricing_notes: string | null
          provider: string | null
          quality_rating: number | null
          resolutions: Json | null
          slug: string | null
          speed_rating: number | null
          subcategory: string | null
          supports_audio: boolean | null
          supports_reference_image: boolean | null
          supports_start_end_frame: boolean | null
          tier: string | null
          unit: string | null
        }
        Insert: {
          best_for?: string | null
          cost_per_unit?: number | null
          description?: string | null
          display_name?: string | null
          endpoint?: string | null
          fuel_per_unit?: never
          max_duration_sec?: number | null
          min_duration_sec?: number | null
          min_plan?: string | null
          plan_level?: never
          pricing_notes?: string | null
          provider?: string | null
          quality_rating?: number | null
          resolutions?: Json | null
          slug?: string | null
          speed_rating?: number | null
          subcategory?: string | null
          supports_audio?: boolean | null
          supports_reference_image?: boolean | null
          supports_start_end_frame?: boolean | null
          tier?: string | null
          unit?: string | null
        }
        Update: {
          best_for?: string | null
          cost_per_unit?: number | null
          description?: string | null
          display_name?: string | null
          endpoint?: string | null
          fuel_per_unit?: never
          max_duration_sec?: number | null
          min_duration_sec?: number | null
          min_plan?: string | null
          plan_level?: never
          pricing_notes?: string | null
          provider?: string | null
          quality_rating?: number | null
          resolutions?: Json | null
          slug?: string | null
          speed_rating?: number | null
          subcategory?: string | null
          supports_audio?: boolean | null
          supports_reference_image?: boolean | null
          supports_start_end_frame?: boolean | null
          tier?: string | null
          unit?: string | null
        }
        Relationships: []
      }
      cinema_crew_activity: {
        Row: {
          agent: string | null
          color: string | null
          display_name: string | null
          emoji: string | null
          kind: string | null
          role_title: string | null
          skills: string[] | null
          skills_owned: number | null
        }
        Relationships: []
      }
      cinema_pipeline_economics: {
        Row: {
          compute_cost_usd: number | null
          duration_per_shot: string | null
          gross_margin_usd: number | null
          id: string | null
          margin_pct: number | null
          min_plan: string | null
          mode: string | null
          name: string | null
          resolution: string | null
          retail_fuel: number | null
          retail_fuel_display: string | null
          retail_usd: number | null
          shot_count: string | null
        }
        Insert: {
          compute_cost_usd?: number | null
          duration_per_shot?: never
          gross_margin_usd?: never
          id?: string | null
          margin_pct?: never
          min_plan?: string | null
          mode?: string | null
          name?: string | null
          resolution?: never
          retail_fuel?: number | null
          retail_fuel_display?: never
          retail_usd?: never
          shot_count?: never
        }
        Update: {
          compute_cost_usd?: number | null
          duration_per_shot?: never
          gross_margin_usd?: never
          id?: string | null
          margin_pct?: never
          min_plan?: string | null
          mode?: string | null
          name?: string | null
          resolution?: never
          retail_fuel?: number | null
          retail_fuel_display?: never
          retail_usd?: never
          shot_count?: never
        }
        Relationships: []
      }
      cinema_scenes_with_dna_status: {
        Row: {
          aspect_ratio: string | null
          character_refs: string[] | null
          created_at: string | null
          dna_status: string | null
          duration_seconds: number | null
          id: string | null
          model: string | null
          notes: string | null
          preview_generated_at: string | null
          preview_image_url: string | null
          preview_model: string | null
          project_camera_language: string | null
          project_id: string | null
          project_keyframe_urls: Json | null
          project_style_slug: string | null
          project_title: string | null
          prompt: string | null
          rendered_at: string | null
          rendered_video_url: string | null
          scene_order: number | null
          status: string | null
          style_slug: string | null
          thumbnail_url: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cinema_scenes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cinema_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_ledger: {
        Row: {
          action_type: string | null
          created_at: string | null
          cumulative_spent: number | null
          delta: number | null
          delta_display: string | null
          description: string | null
          entry_type: string | null
          factory_id: string | null
          id: string | null
          tool_name: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_usage_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_bundle_economics: {
        Row: {
          dollars_per_fuel: number | null
          fuel_display: string | null
          fuel_included: number | null
          gross_margin_pct_on_revenue: number | null
          kind: string | null
          margin_pct_on_cost: number | null
          plan: string | null
          price_usd: number | null
          realized_markup: number | null
        }
        Insert: {
          dollars_per_fuel?: never
          fuel_display?: never
          fuel_included?: number | null
          gross_margin_pct_on_revenue?: never
          kind?: string | null
          margin_pct_on_cost?: never
          plan?: string | null
          price_usd?: number | null
          realized_markup?: never
        }
        Update: {
          dollars_per_fuel?: never
          fuel_display?: never
          fuel_included?: number | null
          gross_margin_pct_on_revenue?: never
          kind?: string | null
          margin_pct_on_cost?: never
          plan?: string | null
          price_usd?: number | null
          realized_markup?: never
        }
        Relationships: []
      }
      sessions_with_message_count: {
        Row: {
          closed_at: string | null
          created_at: string | null
          depth_mode: string | null
          id: string | null
          message_count: number | null
          participants: string[] | null
          seed_context: Json | null
          significance: number | null
          status: string | null
          summary: string | null
          title: string | null
          total_cost_cents: number | null
          trigger_type: string | null
          turn_count: number | null
          user_id: string | null
          user_join_turn: number | null
          user_joined: boolean | null
        }
        Relationships: []
      }
      simulation_batch_summary: {
        Row: {
          archetype: string | null
          avg_cost_cents: number | null
          avg_turns: number | null
          closed_count: number | null
          ended_at: string | null
          session_count: number | null
          simulation_batch_id: string | null
          started_at: string | null
          total_cost_cents: number | null
          unclosed_count: number | null
        }
        Relationships: []
      }
      style_library_health: {
        Row: {
          complete: number | null
          flagged_for_cleanup: number | null
          genres: number | null
          has_been_used: number | null
          health_pct: number | null
          most_popular: string | null
          total_styles: number | null
          total_uses: number | null
        }
        Relationships: []
      }
      styles_needing_cleanup: {
        Row: {
          bad_count: number | null
          bad_tile_indexes: number[] | null
          cleanup_notes: string | null
          genre: string | null
          name: string | null
          preview_urls: Json | null
          slug: string | null
          subject_composition: Json | null
        }
        Insert: {
          bad_count?: never
          bad_tile_indexes?: number[] | null
          cleanup_notes?: string | null
          genre?: string | null
          name?: string | null
          preview_urls?: Json | null
          slug?: string | null
          subject_composition?: Json | null
        }
        Update: {
          bad_count?: never
          bad_tile_indexes?: number[] | null
          cleanup_notes?: string | null
          genre?: string | null
          name?: string | null
          preview_urls?: Json | null
          slug?: string | null
          subject_composition?: Json | null
        }
        Relationships: []
      }
      tool_economics: {
        Row: {
          category: string | null
          compute_usd: number | null
          display_name: string | null
          dynamic_pricing: boolean | null
          fuel_cost: number | null
          fuel_display: string | null
          health: string | null
          margin_studio_pct: number | null
          owner_agent: string | null
          primary_model_slug: string | null
          rev_pro: number | null
          rev_starter: number | null
          rev_studio: number | null
          surface: string | null
          tool_name: string | null
        }
        Relationships: []
      }
      user_genesis_state: {
        Row: {
          agent_seed_observations: Json | null
          approved_at: string | null
          best_grounding_score: number | null
          created_at: string | null
          creative_dna: Json | null
          direction: Json | null
          event_message_count: number | null
          genesis_version: string | null
          grounding_attempts: number | null
          grounding_score: number | null
          identity: Json | null
          life_context: Json | null
          material_count: number | null
          off_limits: Json | null
          signal_breakdown: Json | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          agent_seed_observations?: Json | null
          approved_at?: string | null
          best_grounding_score?: never
          created_at?: string | null
          creative_dna?: Json | null
          direction?: Json | null
          event_message_count?: never
          genesis_version?: string | null
          grounding_attempts?: never
          grounding_score?: number | null
          identity?: Json | null
          life_context?: Json | null
          material_count?: never
          off_limits?: Json | null
          signal_breakdown?: Json | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          agent_seed_observations?: Json | null
          approved_at?: string | null
          best_grounding_score?: never
          created_at?: string | null
          creative_dna?: Json | null
          direction?: Json | null
          event_message_count?: never
          genesis_version?: string | null
          grounding_attempts?: never
          grounding_score?: number | null
          identity?: Json | null
          life_context?: Json | null
          material_count?: never
          off_limits?: Json | null
          signal_breakdown?: Json | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_recent_model_usage: {
        Row: {
          last_used_at: string | null
          model_slug: string | null
          total_fuel_spent: number | null
          use_count: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_plan_change: {
        Args: {
          p_new_plan: string
          p_top_up_on_upgrade?: boolean
          p_user_id: string
        }
        Returns: Json
      }
      charge_fuel_atomic: {
        Args: {
          p_action_type?: string
          p_amount: number
          p_description?: string
          p_tool_name?: string
          p_user_id: string
        }
        Returns: Json
      }
      check_pipeline_affordability: {
        Args: {
          p_duration_per_shot?: number
          p_narration?: boolean
          p_pipeline_id: string
          p_shot_count?: number
          p_user_id: string
        }
        Returns: Json
      }
      cleanup_old_jobs: { Args: never; Returns: undefined }
      credit_fuel_pack: {
        Args: {
          p_pack_slug: string
          p_stripe_session_id?: string
          p_user_id: string
        }
        Returns: Json
      }
      decay_old_learnings: { Args: never; Returns: Json }
      flag_style_tiles: {
        Args: { reason?: string; style_slug: string; tile_idxs: number[] }
        Returns: string
      }
      format_fuel: { Args: { p_value: number }; Returns: string }
      fuel_ceil: { Args: { p_value: number }; Returns: number }
      genesis_can_proceed: { Args: { p_user_id: string }; Returns: boolean }
      mark_style_clean: { Args: { style_slug: string }; Returns: string }
      refund_fuel_atomic: {
        Args: { p_amount: number; p_reason?: string; p_user_id: string }
        Returns: Json
      }
      replace_style_tile: {
        Args: { new_url: string; style_slug: string; tile_idx: number }
        Returns: string
      }
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
