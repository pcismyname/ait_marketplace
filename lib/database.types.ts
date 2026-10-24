export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      dispute_comments: {
        Row: {
          attachments: string[];
          author_id: string;
          body: string;
          created_at: string;
          dispute_id: string;
          id: string;
        };
        ComputedFields: never;
        Insert: {
          attachments?: string[];
          author_id?: string;
          body: string;
          created_at?: string;
          dispute_id: string;
          id?: string;
        };
        Update: {
          attachments?: string[];
          author_id?: string;
          body?: string;
          created_at?: string;
          dispute_id?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dispute_comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dispute_comments_dispute_id_fkey";
            columns: ["dispute_id"];
            isOneToOne: false;
            referencedRelation: "disputes";
            referencedColumns: ["id"];
          },
        ];
      };
      disputes: {
        Row: {
          against_id: string;
          claim_amount: number | null;
          created_at: string;
          deposit_to_owner: number | null;
          deposit_to_renter: number | null;
          description: string;
          evidence: string[];
          filed_by: string;
          finding: string | null;
          id: string;
          reason: string;
          refund_to_buyer: number | null;
          rental_id: string | null;
          resolution_amount: number | null;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          seller_amount: number | null;
          status: string;
          transaction_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          against_id: string;
          claim_amount?: number | null;
          created_at?: string;
          deposit_to_owner?: number | null;
          deposit_to_renter?: number | null;
          description?: string;
          evidence?: string[];
          filed_by: string;
          finding?: string | null;
          id?: string;
          reason: string;
          refund_to_buyer?: number | null;
          rental_id?: string | null;
          resolution_amount?: number | null;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          seller_amount?: number | null;
          status?: string;
          transaction_id?: string | null;
          updated_at?: string;
        };
        Update: {
          against_id?: string;
          claim_amount?: number | null;
          created_at?: string;
          deposit_to_owner?: number | null;
          deposit_to_renter?: number | null;
          description?: string;
          evidence?: string[];
          filed_by?: string;
          finding?: string | null;
          id?: string;
          reason?: string;
          refund_to_buyer?: number | null;
          rental_id?: string | null;
          resolution_amount?: number | null;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          seller_amount?: number | null;
          status?: string;
          transaction_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "disputes_against_id_fkey";
            columns: ["against_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "disputes_filed_by_fkey";
            columns: ["filed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "disputes_rental_id_fkey";
            columns: ["rental_id"];
            isOneToOne: false;
            referencedRelation: "rentals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "disputes_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      favorites: {
        Row: {
          created_at: string | null;
          listing_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string | null;
          listing_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          listing_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "favorites_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "favorites_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_history: {
        Row: {
          action: string;
          created_at: string | null;
          date: string;
          id: string;
          listing_id: string;
          owner_name: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          created_at?: string | null;
          date: string;
          id?: string;
          listing_id: string;
          owner_name: string;
        };
        Update: {
          action?: string;
          created_at?: string | null;
          date?: string;
          id?: string;
          listing_id?: string;
          owner_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listing_history_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
        ];
      };
      listings: {
        Row: {
          category: string;
          condition: string;
          created_at: string | null;
          deposit: number | null;
          description: string;
          featured: boolean;
          featured_until: string | null;
          hidden_at: string | null;
          hidden_by: string | null;
          hidden_reason: string | null;
          id: string;
          images: string[];
          pickup_location: string;
          price: number;
          rental_period: string | null;
          replacement_value: number | null;
          search: unknown;
          seller_id: string;
          status: string;
          times_changed_hands: number;
          title: string;
          type: string;
          updated_at: string;
          view_count: number;
          is_featured: boolean | null;
        };
        ComputedFields: "is_featured";
        Insert: {
          category: string;
          condition: string;
          created_at?: string | null;
          deposit?: number | null;
          description: string;
          featured?: boolean;
          featured_until?: string | null;
          hidden_at?: string | null;
          hidden_by?: string | null;
          hidden_reason?: string | null;
          id?: string;
          images?: string[];
          pickup_location: string;
          price: number;
          rental_period?: string | null;
          replacement_value?: number | null;
          search?: never;
          seller_id: string;
          status?: string;
          times_changed_hands?: number;
          title: string;
          type: string;
          updated_at?: string;
          view_count?: number;
        };
        Update: {
          category?: string;
          condition?: string;
          created_at?: string | null;
          deposit?: number | null;
          description?: string;
          featured?: boolean;
          featured_until?: string | null;
          hidden_at?: string | null;
          hidden_by?: string | null;
          hidden_reason?: string | null;
          id?: string;
          images?: string[];
          pickup_location?: string;
          price?: number;
          rental_period?: string | null;
          replacement_value?: number | null;
          search?: never;
          seller_id?: string;
          status?: string;
          times_changed_hands?: number;
          title?: string;
          type?: string;
          updated_at?: string;
          view_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "listings_hidden_by_fkey";
            columns: ["hidden_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listings_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          created_at: string | null;
          id: string;
          sender_id: string;
          text: string;
          thread_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string | null;
          id?: string;
          sender_id: string;
          text: string;
          thread_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          sender_id?: string;
          text?: string;
          thread_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "threads";
            referencedColumns: ["id"];
          },
        ];
      };
      needs: {
        Row: {
          arrival_date: string;
          category: string;
          created_at: string | null;
          id: string;
          listing_type: string;
          needed_by: string | null;
          note: string | null;
          title: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          arrival_date: string;
          category: string;
          created_at?: string | null;
          id?: string;
          listing_type?: string;
          needed_by?: string | null;
          note?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          arrival_date?: string;
          category?: string;
          created_at?: string | null;
          id?: string;
          listing_type?: string;
          needed_by?: string | null;
          note?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "needs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string;
          created_at: string;
          dedupe_key: string | null;
          id: string;
          kind: string;
          link: string | null;
          read_at: string | null;
          title: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string;
          created_at?: string;
          dedupe_key?: string | null;
          id?: string;
          kind: string;
          link?: string | null;
          read_at?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          dedupe_key?: string | null;
          id?: string;
          kind?: string;
          link?: string | null;
          read_at?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      rentals: {
        Row: {
          approved_at: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          commission: number | null;
          created_at: string | null;
          decline_reason: string | null;
          declined_at: string | null;
          deposit: number;
          deposit_to_owner: number | null;
          deposit_to_renter: number | null;
          dispute_window_ends_at: string | null;
          due_date: string;
          escrow_fee: number | null;
          handover_at: string | null;
          handover_confirmed_by: string | null;
          handover_photos: string[];
          id: string;
          late_days: number;
          late_fee: number;
          listing_id: string;
          overdue_at: string | null;
          owner_id: string;
          paid_at: string | null;
          payment_method: string | null;
          payout_at: string | null;
          payout_released_at: string | null;
          period_days: number;
          phase: string;
          quote: Json | null;
          released_at: string | null;
          rental_fee: number | null;
          rental_period: string | null;
          renter_id: string;
          request_message: string | null;
          requested_at: string;
          return_photos: string[];
          returned_at: string | null;
          start_date: string;
          total_paid: number | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          approved_at?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          commission?: number | null;
          created_at?: string | null;
          decline_reason?: string | null;
          declined_at?: string | null;
          deposit: number;
          deposit_to_owner?: number | null;
          deposit_to_renter?: number | null;
          dispute_window_ends_at?: string | null;
          due_date: string;
          escrow_fee?: number | null;
          handover_at?: string | null;
          handover_confirmed_by?: string | null;
          handover_photos?: string[];
          id?: string;
          late_days?: number;
          late_fee?: number;
          listing_id: string;
          overdue_at?: string | null;
          owner_id: string;
          paid_at?: string | null;
          payment_method?: string | null;
          payout_at?: string | null;
          payout_released_at?: string | null;
          period_days?: number;
          phase: string;
          quote?: Json | null;
          released_at?: string | null;
          rental_fee?: number | null;
          rental_period?: string | null;
          renter_id: string;
          request_message?: string | null;
          requested_at?: string;
          return_photos?: string[];
          returned_at?: string | null;
          start_date: string;
          total_paid?: number | null;
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          commission?: number | null;
          created_at?: string | null;
          decline_reason?: string | null;
          declined_at?: string | null;
          deposit?: number;
          deposit_to_owner?: number | null;
          deposit_to_renter?: number | null;
          dispute_window_ends_at?: string | null;
          due_date?: string;
          escrow_fee?: number | null;
          handover_at?: string | null;
          handover_confirmed_by?: string | null;
          handover_photos?: string[];
          id?: string;
          late_days?: number;
          late_fee?: number;
          listing_id?: string;
          overdue_at?: string | null;
          owner_id?: string;
          paid_at?: string | null;
          payment_method?: string | null;
          payout_at?: string | null;
          payout_released_at?: string | null;
          period_days?: number;
          phase?: string;
          quote?: Json | null;
          released_at?: string | null;
          rental_fee?: number | null;
          rental_period?: string | null;
          renter_id?: string;
          request_message?: string | null;
          requested_at?: string;
          return_photos?: string[];
          returned_at?: string | null;
          start_date?: string;
          total_paid?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rentals_cancelled_by_fkey";
            columns: ["cancelled_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rentals_handover_confirmed_by_fkey";
            columns: ["handover_confirmed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rentals_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rentals_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rentals_renter_id_fkey";
            columns: ["renter_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          author_avatar: string | null;
          author_id: string;
          author_name: string;
          comment: string | null;
          created_at: string | null;
          date: string;
          id: string;
          listing_id: string;
          rating: number;
          rental_id: string | null;
          role: string;
          subject_id: string | null;
          transaction_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          author_avatar?: string | null;
          author_id: string;
          author_name: string;
          comment?: string | null;
          created_at?: string | null;
          date: string;
          id?: string;
          listing_id: string;
          rating: number;
          rental_id?: string | null;
          role: string;
          subject_id?: string | null;
          transaction_id?: string | null;
        };
        Update: {
          author_avatar?: string | null;
          author_id?: string;
          author_name?: string;
          comment?: string | null;
          created_at?: string | null;
          date?: string;
          id?: string;
          listing_id?: string;
          rating?: number;
          rental_id?: string | null;
          role?: string;
          subject_id?: string | null;
          transaction_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_rental_id_fkey";
            columns: ["rental_id"];
            isOneToOne: false;
            referencedRelation: "rentals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      thread_participants: {
        Row: {
          last_read_at: string | null;
          thread_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          last_read_at?: string | null;
          thread_id: string;
          user_id: string;
        };
        Update: {
          last_read_at?: string | null;
          thread_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "thread_participants_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "threads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "thread_participants_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      threads: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          id: string;
          listing_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          listing_id: string;
        };
        Update: {
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          listing_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "threads_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "threads_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
        ];
      };
      transactions: {
        Row: {
          buyer_id: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          completed_at: string | null;
          created_at: string;
          dispute_window_ends_at: string | null;
          handover_at: string | null;
          handover_photos: string[];
          id: string;
          listing_id: string;
          mode: string;
          note: string | null;
          paid_at: string | null;
          payment_method: string | null;
          price: number;
          protection_fee: number;
          refund_to_buyer: number;
          released_at: string | null;
          seller_amount: number | null;
          seller_id: string;
          status: string;
          total: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          buyer_id?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          completed_at?: string | null;
          created_at?: string;
          dispute_window_ends_at?: string | null;
          handover_at?: string | null;
          handover_photos?: string[];
          id?: string;
          listing_id: string;
          mode: string;
          note?: string | null;
          paid_at?: string | null;
          payment_method?: string | null;
          price: number;
          protection_fee?: number;
          refund_to_buyer?: number;
          released_at?: string | null;
          seller_amount?: number | null;
          seller_id: string;
          status: string;
          total: number;
          updated_at?: string;
        };
        Update: {
          buyer_id?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          completed_at?: string | null;
          created_at?: string;
          dispute_window_ends_at?: string | null;
          handover_at?: string | null;
          handover_photos?: string[];
          id?: string;
          listing_id?: string;
          mode?: string;
          note?: string | null;
          paid_at?: string | null;
          payment_method?: string | null;
          price?: number;
          protection_fee?: number;
          refund_to_buyer?: number;
          released_at?: string | null;
          seller_amount?: number | null;
          seller_id?: string;
          status?: string;
          total?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_buyer_id_fkey";
            columns: ["buyer_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_cancelled_by_fkey";
            columns: ["cancelled_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          arrival_date: string | null;
          avatar: string | null;
          batch: string | null;
          created_at: string | null;
          departure_date: string | null;
          email: string | null;
          id: string;
          is_admin: boolean;
          joined: string | null;
          kind: string;
          name: string;
          onboarded_at: string | null;
          pickup_location: string | null;
          program: string | null;
          rating: number;
          reviews_count: number;
          role_intents: string[];
        };
        ComputedFields: never;
        Insert: {
          arrival_date?: string | null;
          avatar?: string | null;
          batch?: string | null;
          created_at?: string | null;
          departure_date?: string | null;
          email?: string | null;
          id: string;
          is_admin?: boolean;
          joined?: string | null;
          kind?: string;
          name: string;
          onboarded_at?: string | null;
          pickup_location?: string | null;
          program?: string | null;
          rating?: number;
          reviews_count?: number;
          role_intents?: string[];
        };
        Update: {
          arrival_date?: string | null;
          avatar?: string | null;
          batch?: string | null;
          created_at?: string | null;
          departure_date?: string | null;
          email?: string | null;
          id?: string;
          is_admin?: boolean;
          joined?: string | null;
          kind?: string;
          name?: string;
          onboarded_at?: string | null;
          pickup_location?: string | null;
          program?: string | null;
          rating?: number;
          reviews_count?: number;
          role_intents?: string[];
        };
        Relationships: [];
      };
      wallet_ledger: {
        Row: {
          amount: number;
          bucket: string;
          created_at: string;
          dispute_id: string | null;
          id: string;
          kind: string;
          memo: string;
          payment_method: string | null;
          rental_id: string | null;
          transaction_id: string | null;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          bucket: string;
          created_at?: string;
          dispute_id?: string | null;
          id?: string;
          kind: string;
          memo?: string;
          payment_method?: string | null;
          rental_id?: string | null;
          transaction_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          amount?: number;
          bucket?: string;
          created_at?: string;
          dispute_id?: string | null;
          id?: string;
          kind?: string;
          memo?: string;
          payment_method?: string | null;
          rental_id?: string | null;
          transaction_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "wallet_ledger_dispute_id_fkey";
            columns: ["dispute_id"];
            isOneToOne: false;
            referencedRelation: "disputes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wallet_ledger_rental_id_fkey";
            columns: ["rental_id"];
            isOneToOne: false;
            referencedRelation: "rentals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wallet_ledger_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wallet_ledger_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_moderate_listing: {
        Args: { p_action: string; p_listing_id: string; p_reason?: string };
        Returns: string;
      };
      admin_stats: { Args: Record<PropertyKey, never>; Returns: Json };
      admin_time_travel: { Args: { p_hours: number; p_id: string }; Returns: string };
      can_read_evidence: { Args: { p_name: string }; Returns: boolean };
      can_write_evidence: { Args: { p_name: string }; Returns: boolean };
      cancel_rental: {
        Args: { p_reason?: string; p_rental_id: string };
        Returns: {
          approved_at: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          commission: number | null;
          created_at: string | null;
          decline_reason: string | null;
          declined_at: string | null;
          deposit: number;
          deposit_to_owner: number | null;
          deposit_to_renter: number | null;
          dispute_window_ends_at: string | null;
          due_date: string;
          escrow_fee: number | null;
          handover_at: string | null;
          handover_confirmed_by: string | null;
          handover_photos: string[];
          id: string;
          late_days: number;
          late_fee: number;
          listing_id: string;
          overdue_at: string | null;
          owner_id: string;
          paid_at: string | null;
          payment_method: string | null;
          payout_at: string | null;
          payout_released_at: string | null;
          period_days: number;
          phase: string;
          quote: Json | null;
          released_at: string | null;
          rental_fee: number | null;
          rental_period: string | null;
          renter_id: string;
          request_message: string | null;
          requested_at: string;
          return_photos: string[];
          returned_at: string | null;
          start_date: string;
          total_paid: number | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "rentals";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      cancel_sale: {
        Args: { p_transaction_id: string };
        Returns: {
          buyer_id: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          completed_at: string | null;
          created_at: string;
          dispute_window_ends_at: string | null;
          handover_at: string | null;
          handover_photos: string[];
          id: string;
          listing_id: string;
          mode: string;
          note: string | null;
          paid_at: string | null;
          payment_method: string | null;
          price: number;
          protection_fee: number;
          refund_to_buyer: number;
          released_at: string | null;
          seller_amount: number | null;
          seller_id: string;
          status: string;
          total: number;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "transactions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      confirm_handover: {
        Args: { p_photos?: string[]; p_rental_id: string };
        Returns: {
          approved_at: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          commission: number | null;
          created_at: string | null;
          decline_reason: string | null;
          declined_at: string | null;
          deposit: number;
          deposit_to_owner: number | null;
          deposit_to_renter: number | null;
          dispute_window_ends_at: string | null;
          due_date: string;
          escrow_fee: number | null;
          handover_at: string | null;
          handover_confirmed_by: string | null;
          handover_photos: string[];
          id: string;
          late_days: number;
          late_fee: number;
          listing_id: string;
          overdue_at: string | null;
          owner_id: string;
          paid_at: string | null;
          payment_method: string | null;
          payout_at: string | null;
          payout_released_at: string | null;
          period_days: number;
          phase: string;
          quote: Json | null;
          released_at: string | null;
          rental_fee: number | null;
          rental_period: string | null;
          renter_id: string;
          request_message: string | null;
          requested_at: string;
          return_photos: string[];
          returned_at: string | null;
          start_date: string;
          total_paid: number | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "rentals";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      confirm_return: {
        Args: { p_photos?: string[]; p_rental_id: string };
        Returns: {
          approved_at: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          commission: number | null;
          created_at: string | null;
          decline_reason: string | null;
          declined_at: string | null;
          deposit: number;
          deposit_to_owner: number | null;
          deposit_to_renter: number | null;
          dispute_window_ends_at: string | null;
          due_date: string;
          escrow_fee: number | null;
          handover_at: string | null;
          handover_confirmed_by: string | null;
          handover_photos: string[];
          id: string;
          late_days: number;
          late_fee: number;
          listing_id: string;
          overdue_at: string | null;
          owner_id: string;
          paid_at: string | null;
          payment_method: string | null;
          payout_at: string | null;
          payout_released_at: string | null;
          period_days: number;
          phase: string;
          quote: Json | null;
          released_at: string | null;
          rental_fee: number | null;
          rental_period: string | null;
          renter_id: string;
          request_message: string | null;
          requested_at: string;
          return_photos: string[];
          returned_at: string | null;
          start_date: string;
          total_paid: number | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "rentals";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      confirm_sale_handover: {
        Args: { p_photos?: string[]; p_transaction_id: string };
        Returns: {
          buyer_id: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          completed_at: string | null;
          created_at: string;
          dispute_window_ends_at: string | null;
          handover_at: string | null;
          handover_photos: string[];
          id: string;
          listing_id: string;
          mode: string;
          note: string | null;
          paid_at: string | null;
          payment_method: string | null;
          price: number;
          protection_fee: number;
          refund_to_buyer: number;
          released_at: string | null;
          seller_amount: number | null;
          seller_id: string;
          status: string;
          total: number;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "transactions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      confirm_sale_receipt: {
        Args: { p_transaction_id: string };
        Returns: {
          buyer_id: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          completed_at: string | null;
          created_at: string;
          dispute_window_ends_at: string | null;
          handover_at: string | null;
          handover_photos: string[];
          id: string;
          listing_id: string;
          mode: string;
          note: string | null;
          paid_at: string | null;
          payment_method: string | null;
          price: number;
          protection_fee: number;
          refund_to_buyer: number;
          released_at: string | null;
          seller_amount: number | null;
          seller_id: string;
          status: string;
          total: number;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "transactions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_sale: {
        Args: { p_listing_id: string; p_method?: string; p_mode: string };
        Returns: {
          buyer_id: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          completed_at: string | null;
          created_at: string;
          dispute_window_ends_at: string | null;
          handover_at: string | null;
          handover_photos: string[];
          id: string;
          listing_id: string;
          mode: string;
          note: string | null;
          paid_at: string | null;
          payment_method: string | null;
          price: number;
          protection_fee: number;
          refund_to_buyer: number;
          released_at: string | null;
          seller_amount: number | null;
          seller_id: string;
          status: string;
          total: number;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "transactions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      enable_premium_placement: {
        Args: { p_listing_id: string; p_method?: string };
        Returns: {
          category: string;
          condition: string;
          created_at: string | null;
          deposit: number | null;
          description: string;
          featured: boolean;
          featured_until: string | null;
          hidden_at: string | null;
          hidden_by: string | null;
          hidden_reason: string | null;
          id: string;
          images: string[];
          pickup_location: string;
          price: number;
          rental_period: string | null;
          replacement_value: number | null;
          search: unknown;
          seller_id: string;
          status: string;
          times_changed_hands: number;
          title: string;
          type: string;
          updated_at: string;
          view_count: number;
        };
        SetofOptions: {
          from: "*";
          to: "listings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      end_premium_placement: {
        Args: { p_listing_id: string };
        Returns: {
          category: string;
          condition: string;
          created_at: string | null;
          deposit: number | null;
          description: string;
          featured: boolean;
          featured_until: string | null;
          hidden_at: string | null;
          hidden_by: string | null;
          hidden_reason: string | null;
          id: string;
          images: string[];
          pickup_location: string;
          price: number;
          rental_period: string | null;
          replacement_value: number | null;
          search: unknown;
          seller_id: string;
          status: string;
          times_changed_hands: number;
          title: string;
          type: string;
          updated_at: string;
          view_count: number;
        };
        SetofOptions: {
          from: "*";
          to: "listings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      file_dispute: {
        Args: {
          p_claim_amount?: number;
          p_description?: string;
          p_evidence?: string[];
          p_reason: string;
          p_rental_id?: string;
          p_transaction_id?: string;
        };
        Returns: {
          against_id: string;
          claim_amount: number | null;
          created_at: string;
          deposit_to_owner: number | null;
          deposit_to_renter: number | null;
          description: string;
          evidence: string[];
          filed_by: string;
          finding: string | null;
          id: string;
          reason: string;
          refund_to_buyer: number | null;
          rental_id: string | null;
          resolution_amount: number | null;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          seller_amount: number | null;
          status: string;
          transaction_id: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "disputes";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      get_wallet_summary: {
        Args: Record<PropertyKey, never>;
        Returns: {
          available: number;
          deposits_held: number;
          held: number;
          pending_payouts: number;
        }[];
      };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_dispute_party: { Args: { p_dispute_id: string }; Returns: boolean };
      is_featured: {
        Args: {
          l: Omit<
            Database["public"]["Tables"]["listings"]["Row"],
            Database["public"]["Tables"]["listings"]["ComputedFields"]
          >;
        };
        Returns: boolean;
      };
      is_rental_party: { Args: { p_rental_id: string }; Returns: boolean };
      is_thread_participant: { Args: { p_thread_id: string }; Returns: boolean };
      is_transaction_party: { Args: { p_transaction_id: string }; Returns: boolean };
      listing_has_history: { Args: { p_listing_id: string }; Returns: boolean };
      listing_has_open_deal: { Args: { p_listing_id: string }; Returns: boolean };
      mark_notifications_read: { Args: { p_ids?: string[] }; Returns: number };
      mark_returned: {
        Args: { p_photos?: string[]; p_rental_id: string };
        Returns: {
          approved_at: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          commission: number | null;
          created_at: string | null;
          decline_reason: string | null;
          declined_at: string | null;
          deposit: number;
          deposit_to_owner: number | null;
          deposit_to_renter: number | null;
          dispute_window_ends_at: string | null;
          due_date: string;
          escrow_fee: number | null;
          handover_at: string | null;
          handover_confirmed_by: string | null;
          handover_photos: string[];
          id: string;
          late_days: number;
          late_fee: number;
          listing_id: string;
          overdue_at: string | null;
          owner_id: string;
          paid_at: string | null;
          payment_method: string | null;
          payout_at: string | null;
          payout_released_at: string | null;
          period_days: number;
          phase: string;
          quote: Json | null;
          released_at: string | null;
          rental_fee: number | null;
          rental_period: string | null;
          renter_id: string;
          request_message: string | null;
          requested_at: string;
          return_photos: string[];
          returned_at: string | null;
          start_date: string;
          total_paid: number | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "rentals";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      mark_sold: {
        Args: { p_buyer_id?: string; p_listing_id: string };
        Returns: {
          buyer_id: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          completed_at: string | null;
          created_at: string;
          dispute_window_ends_at: string | null;
          handover_at: string | null;
          handover_photos: string[];
          id: string;
          listing_id: string;
          mode: string;
          note: string | null;
          paid_at: string | null;
          payment_method: string | null;
          price: number;
          protection_fee: number;
          refund_to_buyer: number;
          released_at: string | null;
          seller_amount: number | null;
          seller_id: string;
          status: string;
          total: number;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "transactions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      mark_thread_read: { Args: { p_thread_id: string }; Returns: undefined };
      match_needs: {
        Args: { p_need_id?: string };
        Returns: {
          featured: boolean;
          listed_at: string;
          listing_id: string;
          need_id: string;
        }[];
      };
      pay_rental: {
        Args: { p_method: string; p_rental_id: string };
        Returns: {
          approved_at: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          commission: number | null;
          created_at: string | null;
          decline_reason: string | null;
          declined_at: string | null;
          deposit: number;
          deposit_to_owner: number | null;
          deposit_to_renter: number | null;
          dispute_window_ends_at: string | null;
          due_date: string;
          escrow_fee: number | null;
          handover_at: string | null;
          handover_confirmed_by: string | null;
          handover_photos: string[];
          id: string;
          late_days: number;
          late_fee: number;
          listing_id: string;
          overdue_at: string | null;
          owner_id: string;
          paid_at: string | null;
          payment_method: string | null;
          payout_at: string | null;
          payout_released_at: string | null;
          period_days: number;
          phase: string;
          quote: Json | null;
          released_at: string | null;
          rental_fee: number | null;
          rental_period: string | null;
          renter_id: string;
          request_message: string | null;
          requested_at: string;
          return_photos: string[];
          returned_at: string | null;
          start_date: string;
          total_paid: number | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "rentals";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      quote_rental: { Args: { p_deposit?: number; p_price: number }; Returns: Json };
      quote_sale: { Args: { p_mode: string; p_price: number }; Returns: Json };
      request_rental: {
        Args: { p_listing_id: string; p_message?: string };
        Returns: {
          approved_at: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          commission: number | null;
          created_at: string | null;
          decline_reason: string | null;
          declined_at: string | null;
          deposit: number;
          deposit_to_owner: number | null;
          deposit_to_renter: number | null;
          dispute_window_ends_at: string | null;
          due_date: string;
          escrow_fee: number | null;
          handover_at: string | null;
          handover_confirmed_by: string | null;
          handover_photos: string[];
          id: string;
          late_days: number;
          late_fee: number;
          listing_id: string;
          overdue_at: string | null;
          owner_id: string;
          paid_at: string | null;
          payment_method: string | null;
          payout_at: string | null;
          payout_released_at: string | null;
          period_days: number;
          phase: string;
          quote: Json | null;
          released_at: string | null;
          rental_fee: number | null;
          rental_period: string | null;
          renter_id: string;
          request_message: string | null;
          requested_at: string;
          return_photos: string[];
          returned_at: string | null;
          start_date: string;
          total_paid: number | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "rentals";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      resolve_dispute: {
        Args: { p_amount?: number; p_dispute_id: string; p_finding: string; p_note?: string };
        Returns: {
          against_id: string;
          claim_amount: number | null;
          created_at: string;
          deposit_to_owner: number | null;
          deposit_to_renter: number | null;
          description: string;
          evidence: string[];
          filed_by: string;
          finding: string | null;
          id: string;
          reason: string;
          refund_to_buyer: number | null;
          rental_id: string | null;
          resolution_amount: number | null;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          seller_amount: number | null;
          status: string;
          transaction_id: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "disputes";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      respond_rental: {
        Args: { p_approve: boolean; p_reason?: string; p_rental_id: string };
        Returns: {
          approved_at: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          commission: number | null;
          created_at: string | null;
          decline_reason: string | null;
          declined_at: string | null;
          deposit: number;
          deposit_to_owner: number | null;
          deposit_to_renter: number | null;
          dispute_window_ends_at: string | null;
          due_date: string;
          escrow_fee: number | null;
          handover_at: string | null;
          handover_confirmed_by: string | null;
          handover_photos: string[];
          id: string;
          late_days: number;
          late_fee: number;
          listing_id: string;
          overdue_at: string | null;
          owner_id: string;
          paid_at: string | null;
          payment_method: string | null;
          payout_at: string | null;
          payout_released_at: string | null;
          period_days: number;
          phase: string;
          quote: Json | null;
          released_at: string | null;
          rental_fee: number | null;
          rental_period: string | null;
          renter_id: string;
          request_message: string | null;
          requested_at: string;
          return_photos: string[];
          returned_at: string | null;
          start_date: string;
          total_paid: number | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "rentals";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      run_escrow_jobs: { Args: Record<PropertyKey, never>; Returns: Json };
      start_thread: {
        Args: {
          p_listing_id: string;
          p_message_id?: string;
          p_other_user_id: string;
          p_text: string;
          p_thread_id?: string;
        };
        Returns: Json;
      };
      submit_review: {
        Args: {
          p_comment?: string;
          p_rating: number;
          p_rental_id?: string;
          p_transaction_id?: string;
        };
        Returns: {
          author_avatar: string | null;
          author_id: string;
          author_name: string;
          comment: string | null;
          created_at: string | null;
          date: string;
          id: string;
          listing_id: string;
          rating: number;
          rental_id: string | null;
          role: string;
          subject_id: string | null;
          transaction_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "reviews";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      wallet_withdraw: {
        Args: { p_amount: number };
        Returns: {
          amount: number;
          bucket: string;
          created_at: string;
          dispute_id: string | null;
          id: string;
          kind: string;
          memo: string;
          payment_method: string | null;
          rental_id: string | null;
          transaction_id: string | null;
          user_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "wallet_ledger";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
