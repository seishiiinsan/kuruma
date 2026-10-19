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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      achievement_claims: {
        Row: {
          achievement_id: string
          claimed_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          claimed_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          claimed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "achievement_claims_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      achievements: {
        Row: {
          goal: number
          id: string
          metric: string
          reward: number
        }
        Insert: {
          goal: number
          id: string
          metric: string
          reward: number
        }
        Update: {
          goal?: number
          id?: string
          metric?: string
          reward?: number
        }
        Relationships: []
      }
      card_copies: {
        Row: {
          card_slug: string
          id: string
          obtained_at: string
          obtained_via: string
          owner_id: string | null
          serial: number
        }
        Insert: {
          card_slug: string
          id?: string
          obtained_at?: string
          obtained_via: string
          owner_id?: string | null
          serial: number
        }
        Update: {
          card_slug?: string
          id?: string
          obtained_at?: string
          obtained_via?: string
          owner_id?: string | null
          serial?: number
        }
        Relationships: [
          {
            foreignKeyName: "card_copies_card_slug_fkey"
            columns: ["card_slug"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["slug"]
          },
        ]
      }
      cards: {
        Row: {
          culture: string
          minted: number
          slug: string
          supply: number | null
          tier: string
          traits: string[]
        }
        Insert: {
          culture: string
          minted?: number
          slug: string
          supply?: number | null
          tier: string
          traits?: string[]
        }
        Update: {
          culture?: string
          minted?: number
          slug?: string
          supply?: number | null
          tier?: string
          traits?: string[]
        }
        Relationships: []
      }
      coin_ledger: {
        Row: {
          amount: number
          created_at: string
          id: number
          reason: string
          ref: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: never
          reason: string
          ref?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: never
          reason?: string
          ref?: string | null
          user_id?: string
        }
        Relationships: []
      }
      garage_slots: {
        Row: {
          copy_id: string
          position: number
          user_id: string
        }
        Insert: {
          copy_id: string
          position: number
          user_id: string
        }
        Update: {
          copy_id?: string
          position?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_slots_copy_id_fkey"
            columns: ["copy_id"]
            isOneToOne: true
            referencedRelation: "card_copies"
            referencedColumns: ["id"]
          },
        ]
      }
      market_listings: {
        Row: {
          card_slug: string
          copy_id: string
          expires_at: string
          listed_at: string
          price: number
          seller_id: string
        }
        Insert: {
          card_slug: string
          copy_id: string
          expires_at?: string
          listed_at?: string
          price: number
          seller_id: string
        }
        Update: {
          card_slug?: string
          copy_id?: string
          expires_at?: string
          listed_at?: string
          price?: number
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_listings_card_slug_fkey"
            columns: ["card_slug"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "market_listings_copy_id_fkey"
            columns: ["copy_id"]
            isOneToOne: true
            referencedRelation: "card_copies"
            referencedColumns: ["id"]
          },
        ]
      }
      market_sales: {
        Row: {
          buyer_id: string | null
          card_slug: string
          copy_id: string | null
          fee: number
          id: number
          price: number
          reverted_at: string | null
          seller_id: string | null
          sold_at: string
        }
        Insert: {
          buyer_id?: string | null
          card_slug: string
          copy_id?: string | null
          fee: number
          id?: never
          price: number
          reverted_at?: string | null
          seller_id?: string | null
          sold_at?: string
        }
        Update: {
          buyer_id?: string | null
          card_slug?: string
          copy_id?: string | null
          fee?: number
          id?: never
          price?: number
          reverted_at?: string | null
          seller_id?: string | null
          sold_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_sales_card_slug_fkey"
            columns: ["card_slug"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "market_sales_copy_id_fkey"
            columns: ["copy_id"]
            isOneToOne: false
            referencedRelation: "card_copies"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_claims: {
        Row: {
          claimed_at: string
          mission_id: string
          period: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          mission_id: string
          period: string
          user_id: string
        }
        Update: {
          claimed_at?: string
          mission_id?: string
          period?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_claims_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          cadence: string
          goal: number
          grp: number
          id: string
          kind: string
          param: string | null
          reward: number
        }
        Insert: {
          cadence: string
          goal: number
          grp: number
          id: string
          kind: string
          param?: string | null
          reward: number
        }
        Update: {
          cadence?: string
          goal?: number
          grp?: number
          id?: string
          kind?: string
          param?: string | null
          reward?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          card_slug: string | null
          created_at: string
          id: string
          kind: string
          read_at: string | null
          trade_id: string | null
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          card_slug?: string | null
          created_at?: string
          id?: string
          kind: string
          read_at?: string | null
          trade_id?: string | null
          user_id: string
        }
        Update: {
          actor_id?: string | null
          card_slug?: string | null
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          trade_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_card_slug_fkey"
            columns: ["card_slug"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "notifications_trade_fk"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_openings: {
        Row: {
          copies: string[]
          id: string
          opened_at: string
          pack_id: string
          user_id: string
        }
        Insert: {
          copies?: string[]
          id?: string
          opened_at?: string
          pack_id: string
          user_id: string
        }
        Update: {
          copies?: string[]
          id?: string
          opened_at?: string
          pack_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_openings_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_wallets: {
        Row: {
          anchor_at: string
          bonus: number
          coins: number
          daily_on: string | null
          days: number
          stored: number
          streak: number
          user_id: string
        }
        Insert: {
          anchor_at?: string
          bonus?: number
          coins?: number
          daily_on?: string | null
          days?: number
          stored?: number
          streak?: number
          user_id: string
        }
        Update: {
          anchor_at?: string
          bonus?: number
          coins?: number
          daily_on?: string | null
          days?: number
          stored?: number
          streak?: number
          user_id?: string
        }
        Relationships: []
      }
      packs: {
        Row: {
          free: boolean
          id: string
          name: string
          price: number
          rotation: number | null
          slots: Json
          theme_share: number
          themes: string[]
        }
        Insert: {
          free?: boolean
          id: string
          name: string
          price?: number
          rotation?: number | null
          slots?: Json
          theme_share?: number
          themes?: string[]
        }
        Update: {
          free?: boolean
          id?: string
          name?: string
          price?: number
          rotation?: number | null
          slots?: Json
          theme_share?: number
          themes?: string[]
        }
        Relationships: []
      }
      player_cosmetics: {
        Row: {
          cosmetic_id: string
          obtained_at: string
          user_id: string
          via: string
        }
        Insert: {
          cosmetic_id: string
          obtained_at?: string
          user_id: string
          via: string
        }
        Update: {
          cosmetic_id?: string
          obtained_at?: string
          user_id?: string
          via?: string
        }
        Relationships: []
      }
      cosmetics: {
        Row: {
          goal: number | null
          id: string
          kind: string
          metric: string | null
          price: number | null
        }
        Insert: {
          goal?: number | null
          id: string
          kind: string
          metric?: string | null
          price?: number | null
        }
        Update: {
          goal?: number | null
          id?: string
          kind?: string
          metric?: string | null
          price?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          badge_ids: string[]
          ban_reason: string | null
          banned_until: string | null
          banner_id: string | null
          created_at: string
          discord_id: string | null
          display_name: string | null
          frame_id: string | null
          handle: string
          id: string
          onboarded_at: string | null
          title_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          badge_ids?: string[]
          ban_reason?: string | null
          banned_until?: string | null
          banner_id?: string | null
          created_at?: string
          discord_id?: string | null
          display_name?: string | null
          frame_id?: string | null
          handle: string
          id: string
          onboarded_at?: string | null
          title_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          badge_ids?: string[]
          ban_reason?: string | null
          banned_until?: string | null
          banner_id?: string | null
          created_at?: string
          discord_id?: string | null
          display_name?: string | null
          frame_id?: string | null
          handle?: string
          id?: string
          onboarded_at?: string | null
          title_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      salon_challenges: {
        Row: {
          goal: number
          kind: string
          ord: number
          param: string | null
          reward: number
          salon_id: string
        }
        Insert: {
          goal: number
          kind: string
          ord: number
          param?: string | null
          reward: number
          salon_id: string
        }
        Update: {
          goal?: number
          kind?: string
          ord?: number
          param?: string | null
          reward?: number
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_challenges_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_claims: {
        Row: {
          claimed_at: string
          ord: number
          period: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          ord: number
          period: string
          user_id: string
        }
        Update: {
          claimed_at?: string
          ord?: number
          period?: string
          user_id?: string
        }
        Relationships: []
      }
      salons: {
        Row: {
          dow: number
          even_years: boolean
          id: string
          month: number
          nth: number
          pack_id: string
        }
        Insert: {
          dow: number
          even_years?: boolean
          id: string
          month: number
          nth: number
          pack_id: string
        }
        Update: {
          dow?: number
          even_years?: boolean
          id?: string
          month?: number
          nth?: number
          pack_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salons_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: true
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      series: {
        Row: {
          id: string
          kind: string
          name: string
          packs: number
          points: number
        }
        Insert: {
          id: string
          kind: string
          name: string
          packs: number
          points: number
        }
        Update: {
          id?: string
          kind?: string
          name?: string
          packs?: number
          points?: number
        }
        Relationships: []
      }
      series_cards: {
        Row: {
          card_slug: string
          series_id: string
        }
        Insert: {
          card_slug: string
          series_id: string
        }
        Update: {
          card_slug?: string
          series_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_cards_card_slug_fkey"
            columns: ["card_slug"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "series_cards_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      series_claims: {
        Row: {
          claimed_at: string
          series_id: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          series_id: string
          user_id: string
        }
        Update: {
          claimed_at?: string
          series_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_claims_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_offers: {
        Row: {
          card_slug: string
          period: string
          slot: number
        }
        Insert: {
          card_slug: string
          period: string
          slot: number
        }
        Update: {
          card_slug?: string
          period?: string
          slot?: number
        }
        Relationships: [
          {
            foreignKeyName: "shop_offers_card_slug_fkey"
            columns: ["card_slug"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["slug"]
          },
        ]
      }
      shop_purchases: {
        Row: {
          card_slug: string
          copy_id: string | null
          created_at: string
          id: string
          period: string | null
          price: number
          slot: number | null
          source: string
          user_id: string
        }
        Insert: {
          card_slug: string
          copy_id?: string | null
          created_at?: string
          id?: string
          period?: string | null
          price: number
          slot?: number | null
          source: string
          user_id: string
        }
        Update: {
          card_slug?: string
          copy_id?: string | null
          created_at?: string
          id?: string
          period?: string | null
          price?: number
          slot?: number | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_purchases_card_slug_fkey"
            columns: ["card_slug"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "shop_purchases_copy_id_fkey"
            columns: ["copy_id"]
            isOneToOne: false
            referencedRelation: "card_copies"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_stock: {
        Row: {
          copy_id: string
          listed_at: string
        }
        Insert: {
          copy_id: string
          listed_at?: string
        }
        Update: {
          copy_id?: string
          listed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_stock_copy_id_fkey"
            columns: ["copy_id"]
            isOneToOne: true
            referencedRelation: "card_copies"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_items: {
        Row: {
          copy_id: string
          side: string
          trade_id: string
        }
        Insert: {
          copy_id: string
          side: string
          trade_id: string
        }
        Update: {
          copy_id?: string
          side?: string
          trade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_items_copy_id_fkey"
            columns: ["copy_id"]
            isOneToOne: false
            referencedRelation: "card_copies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_items_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          created_at: string
          from_id: string
          id: string
          item_count: number | null
          resolved_at: string | null
          status: string
          to_id: string
        }
        Insert: {
          created_at?: string
          from_id: string
          id?: string
          item_count?: number | null
          resolved_at?: string | null
          status?: string
          to_id: string
        }
        Update: {
          created_at?: string
          from_id?: string
          id?: string
          item_count?: number | null
          resolved_at?: string | null
          status?: string
          to_id?: string
        }
        Relationships: []
      }
      waitlist_signups: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      wishes: {
        Row: {
          card_slug: string
          created_at: string
          user_id: string
        }
        Insert: {
          card_slug: string
          created_at?: string
          user_id: string
        }
        Update: {
          card_slug?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishes_card_slug_fkey"
            columns: ["card_slug"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["slug"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      my_account: { Args: never; Returns: Json }
      finish_onboarding: { Args: never; Returns: undefined }
      report_player: {
        Args: { p_target: string; p_reason: string; p_details: string | null }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      admin_reports: {
        Args: { p_status?: string }
        Returns: {
          id: string
          created_at: string
          reason: string
          details: string | null
          status: string
          resolution: string | null
          reporter_handle: string
          reporter_name: string | null
          target_id: string
          target_handle: string
          target_name: string | null
          target_banned: boolean
          target_open_reports: number
        }[]
      }
      admin_resolve_report: {
        Args: { p_id: string; p_status: string; p_note: string | null }
        Returns: undefined
      }
      admin_player: { Args: { p_handle: string }; Returns: Json }
      admin_suspects: {
        Args: never
        Returns: {
          a_handle: string
          a_name: string | null
          a_days: number
          b_handle: string
          b_name: string | null
          b_days: number
          trades: number
          sales: number
          jetons: number
        }[]
      }
      admin_ban: { Args: { p_user: string; p_days: number | null; p_reason: string | null }; Returns: undefined }
      admin_unban: { Args: { p_user: string }; Returns: undefined }
      admin_adjust_coins: { Args: { p_user: string; p_amount: number; p_note: string | null }; Returns: number }
      admin_revert_trade: { Args: { p_trade: string; p_note: string | null }; Returns: undefined }
      admin_revert_sale: { Args: { p_sale: number; p_note: string | null }; Returns: number }
      buy_cosmetic: { Args: { p_id: string }; Returns: undefined }
      equip_cosmetics: {
        Args: { p_badges: string[]; p_banner: string | null; p_frame: string | null; p_title: string | null }
        Returns: undefined
      }
      my_cosmetics: {
        Args: never
        Returns: {
          cosmetic_id: string
          fresh: boolean
          obtained_at: string
          via: string
        }[]
      }
      buy_listing: { Args: { p_copy: string }; Returns: undefined }
      buy_offer: { Args: { p_period: string; p_slot: number }; Returns: string }
      buy_used: { Args: { p_copy: string }; Returns: undefined }
      cancel_listing: { Args: { p_copy: string }; Returns: undefined }
      claim_achievements: { Args: never; Returns: number }
      claim_daily: {
        Args: never
        Returns: {
          reward: number
          streak: number
        }[]
      }
      claim_missions: { Args: never; Returns: number }
      claim_salon: {
        Args: never
        Returns: {
          coins: number
          packs: number
        }[]
      }
      claim_series: { Args: { p_series: string }; Returns: number }
      claimable_achievements: {
        Args: { p_user: string }
        Returns: {
          goal: number
          id: string
          metric: string
          reward: number
        }[]
        SetofOptions: {
          from: "*"
          to: "achievements"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_trade: {
        Args: { p_give: string[]; p_take: string[]; p_to: string }
        Returns: string
      }
      daily_reward: { Args: { streak: number }; Returns: number }
      delete_own_account: { Args: never; Returns: undefined }
      ensure_shop_offers: { Args: never; Returns: undefined }
      expire_listings: { Args: never; Returns: undefined }
      export_my_data: { Args: never; Returns: Json }
      leaderboard: {
        Args: { p_limit?: number }
        Returns: {
          avatar_url: string
          copies: number
          display_name: string
          distinct_cards: number
          handle: string
          rank: number
          score: number
          series: number
          user_id: string
        }[]
      }
      list_copy: {
        Args: { p_copy: string; p_price: number }
        Returns: undefined
      }
      mark_notification_read: { Args: { p_id: string }; Returns: undefined }
      mark_notifications_read: { Args: never; Returns: undefined }
      market_fee: { Args: { p_price: number }; Returns: number }
      market_history: {
        Args: { p_days?: number; p_slug: string }
        Returns: {
          day: string
          high: number
          low: number
          median: number
          sales: number
        }[]
      }
      market_quote: {
        Args: { p_slug: string }
        Returns: {
          base: number
          demand: number
          exhaustion: number
          market_median: number
          max_price: number
          min_price: number
          offer: number
          reference: number
          sales: number
          scarcity: number
          tier_price: number
        }[]
      }
      mission_board: {
        Args: { p_user: string }
        Returns: {
          cadence: string
          claimed: boolean
          goal: number
          kind: string
          mission_id: string
          param: string
          period: string
          progress: number
          reward: number
        }[]
      }
      mission_progress: {
        Args: {
          p_kind: string
          p_param: string
          p_since: string
          p_user: string
        }
        Returns: number
      }
      move_coins: {
        Args: {
          p_amount: number
          p_reason: string
          p_ref: string
          p_user: string
        }
        Returns: number
      }
      my_metrics: { Args: never; Returns: Json }
      my_missions: {
        Args: never
        Returns: {
          cadence: string
          claimed: boolean
          goal: number
          kind: string
          mission_id: string
          param: string
          period: string
          progress: number
          reward: number
        }[]
      }
      my_pack_wallet: {
        Args: never
        Returns: {
          available: number
          bonus: number
          claimable: number
          coins: number
          daily_ready: boolean
          missions: number
          next_at: string
          streak: number
        }[]
      }
      my_salon: {
        Args: never
        Returns: {
          claimed: boolean
          finale_claimed: boolean
          goal: number
          kind: string
          ord: number
          param: string
          period: string
          progress: number
          reward: number
          salon_id: string
        }[]
      }
      notify_wishers: {
        Args: { p_actor: string; p_kind: string; p_slug: string }
        Returns: undefined
      }
      open_pack: {
        Args: { p_pack: string; p_pay?: boolean }
        Returns: {
          card_slug: string
          copy_id: string
          serial: number
        }[]
      }
      paris_today: { Args: never; Returns: string }
      player_metrics: { Args: { p_user: string }; Returns: Json }
      respond_trade: {
        Args: { p_accept: boolean; p_trade: string }
        Returns: string
      }
      salon_board: {
        Args: { p_user: string }
        Returns: {
          claimed: boolean
          goal: number
          kind: string
          ord: number
          param: string
          period: string
          progress: number
          reward: number
          salon_id: string
        }[]
      }
      salon_now: {
        Args: never
        Returns: {
          pack_id: string
          period: string
          salon_id: string
          starts_on: string
        }[]
      }
      salon_ready: { Args: { p_user: string }; Returns: number }
      salon_week: {
        Args: { p_dow: number; p_month: number; p_nth: number; p_year: number }
        Returns: string
      }
      sell_copy: { Args: { p_copy: string }; Returns: number }
      sell_duplicates: {
        Args: { p_tier: string }
        Returns: {
          gained: number
          sold: number
        }[]
      }
      sell_price: { Args: { tier: string }; Returns: number }
      sell_to_shop: {
        Args: { p_copy: string; p_user: string }
        Returns: number
      }
      sellable: { Args: { p_copy: string; p_user: string }; Returns: boolean }
      set_garage: { Args: { p_copies: string[] }; Returns: undefined }
      set_wish: { Args: { p_on: boolean; p_slug: string }; Returns: undefined }
      shop_periods: { Args: never; Returns: Record<string, unknown> }
      shop_price: { Args: { tier: string }; Returns: number }
      shop_window: {
        Args: never
        Returns: {
          bought: boolean
          card_slug: string
          period: string
          price: number
          slot: number
          sold_out: boolean
        }[]
      }
      slugify_handle: { Args: { name: string }; Returns: string }
      tier_points: { Args: { tier: string }; Returns: number }
      unique_handle: { Args: { name: string; uid: string }; Returns: string }
      used_price: { Args: { tier: string }; Returns: number }
      weekend_pack: { Args: never; Returns: string }
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
