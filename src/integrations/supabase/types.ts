export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          created_at: string;
          details: Json | null;
          entity_id: string | null;
          entity_type: string;
          id: string;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          details?: Json | null;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          details?: Json | null;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      gold_adjustments: {
        Row: {
          client_request_id: string | null;
          created_at: string;
          created_by: string | null;
          fine_weight_delta: number;
          id: string;
          issue_id: string | null;
          karigar_id: string;
          reason: string;
          transaction_number: string;
        };
        Insert: {
          client_request_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          fine_weight_delta: number;
          id?: string;
          issue_id?: string | null;
          karigar_id: string;
          reason: string;
          transaction_number: string;
        };
        Update: {
          client_request_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          fine_weight_delta?: number;
          id?: string;
          issue_id?: string | null;
          karigar_id?: string;
          reason?: string;
          transaction_number?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gold_adjustments_issue_id_fkey";
            columns: ["issue_id"];
            isOneToOne: false;
            referencedRelation: "gold_issues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gold_adjustments_karigar_id_fkey";
            columns: ["karigar_id"];
            isOneToOne: false;
            referencedRelation: "karigars";
            referencedColumns: ["id"];
          },
        ];
      };
      gold_issues: {
        Row: {
          allowed_wastage_percent: number;
          client_request_id: string | null;
          closed_at: string | null;
          created_at: string;
          created_by: string | null;
          fine_weight: number;
          gross_weight: number;
          id: string;
          is_demo: boolean;
          issue_date: string;
          item_category_id: string;
          job_number: string;
          karigar_id: string;
          purity_percent: number;
          status: string;
          transaction_number: string;
        };
        Insert: {
          allowed_wastage_percent: number;
          client_request_id?: string | null;
          closed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          fine_weight: number;
          gross_weight: number;
          id?: string;
          is_demo?: boolean;
          issue_date?: string;
          item_category_id: string;
          job_number: string;
          karigar_id: string;
          purity_percent: number;
          status?: string;
          transaction_number: string;
        };
        Update: {
          allowed_wastage_percent?: number;
          client_request_id?: string | null;
          closed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          fine_weight?: number;
          gross_weight?: number;
          id?: string;
          is_demo?: boolean;
          issue_date?: string;
          item_category_id?: string;
          job_number?: string;
          karigar_id?: string;
          purity_percent?: number;
          status?: string;
          transaction_number?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gold_issues_item_category_id_fkey";
            columns: ["item_category_id"];
            isOneToOne: false;
            referencedRelation: "item_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gold_issues_karigar_id_fkey";
            columns: ["karigar_id"];
            isOneToOne: false;
            referencedRelation: "karigars";
            referencedColumns: ["id"];
          },
        ];
      };
      gold_receipts: {
        Row: {
          client_request_id: string | null;
          created_at: string;
          created_by: string | null;
          fine_weight: number;
          gross_weight: number;
          huid: string | null;
          id: string;
          is_demo: boolean;
          issue_id: string;
          karigar_id: string;
          purity_percent: number;
          receipt_date: string;
          receipt_type: string;
          transaction_number: string;
        };
        Insert: {
          client_request_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          fine_weight: number;
          gross_weight: number;
          huid?: string | null;
          id?: string;
          is_demo?: boolean;
          issue_id: string;
          karigar_id: string;
          purity_percent: number;
          receipt_date?: string;
          receipt_type: string;
          transaction_number: string;
        };
        Update: {
          client_request_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          fine_weight?: number;
          gross_weight?: number;
          huid?: string | null;
          id?: string;
          is_demo?: boolean;
          issue_id?: string;
          karigar_id?: string;
          purity_percent?: number;
          receipt_date?: string;
          receipt_type?: string;
          transaction_number?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gold_receipts_issue_id_fkey";
            columns: ["issue_id"];
            isOneToOne: false;
            referencedRelation: "gold_issues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gold_receipts_karigar_id_fkey";
            columns: ["karigar_id"];
            isOneToOne: false;
            referencedRelation: "karigars";
            referencedColumns: ["id"];
          },
        ];
      };
      item_categories: {
        Row: {
          allowed_wastage_percent: number;
          category_name: string;
          id: string;
          is_active: boolean;
        };
        Insert: {
          allowed_wastage_percent: number;
          category_name: string;
          id?: string;
          is_active?: boolean;
        };
        Update: {
          allowed_wastage_percent?: number;
          category_name?: string;
          id?: string;
          is_active?: boolean;
        };
        Relationships: [];
      };
      karigars: {
        Row: {
          created_at: string;
          full_name: string;
          id: string;
          is_active: boolean;
          is_demo: boolean;
          karigar_code: string;
          phone: string | null;
          preferred_language: string | null;
        };
        Insert: {
          created_at?: string;
          full_name: string;
          id?: string;
          is_active?: boolean;
          is_demo?: boolean;
          karigar_code: string;
          phone?: string | null;
          preferred_language?: string | null;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          is_demo?: boolean;
          karigar_code?: string;
          phone?: string | null;
          preferred_language?: string | null;
        };
        Relationships: [];
      };
      loss_alerts: {
        Row: {
          actual_loss: number;
          alert_type: string;
          created_at: string;
          excess_loss: number;
          expected_loss: number;
          historical_loss_percent: number | null;
          id: string;
          is_demo: boolean;
          issue_id: string | null;
          karigar_id: string;
          recent_loss_percent: number | null;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          severity: string;
          status: string;
        };
        Insert: {
          actual_loss: number;
          alert_type: string;
          created_at?: string;
          excess_loss: number;
          expected_loss: number;
          historical_loss_percent?: number | null;
          id?: string;
          is_demo?: boolean;
          issue_id?: string | null;
          karigar_id: string;
          recent_loss_percent?: number | null;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          severity: string;
          status?: string;
        };
        Update: {
          actual_loss?: number;
          alert_type?: string;
          created_at?: string;
          excess_loss?: number;
          expected_loss?: number;
          historical_loss_percent?: number | null;
          id?: string;
          is_demo?: boolean;
          issue_id?: string | null;
          karigar_id?: string;
          recent_loss_percent?: number | null;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          severity?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "loss_alerts_issue_id_fkey";
            columns: ["issue_id"];
            isOneToOne: false;
            referencedRelation: "gold_issues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loss_alerts_karigar_id_fkey";
            columns: ["karigar_id"];
            isOneToOne: false;
            referencedRelation: "karigars";
            referencedColumns: ["id"];
          },
        ];
      };
      loss_settings: {
        Row: {
          id: boolean;
          min_excess_points: number;
          min_history_jobs: number;
          recent_window: number;
          trend_ratio: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: boolean;
          min_excess_points?: number;
          min_history_jobs?: number;
          recent_window?: number;
          trend_ratio?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: boolean;
          min_excess_points?: number;
          min_history_jobs?: number;
          recent_window?: number;
          trend_ratio?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      photo_ai_access: {
        Row: {
          blocked_message: string | null;
          blocked_status: number | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          blocked_message?: string | null;
          blocked_status?: number | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          blocked_message?: string | null;
          blocked_status?: number | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      photo_readings: {
        Row: {
          client_request_id: string;
          confidence_threshold: number;
          consumed_entity_id: string | null;
          created_at: string;
          error_message: string | null;
          extraction: Json | null;
          id: string;
          operation: string;
          status: string;
          user_id: string;
          verification_reason: string | null;
          verified_at: string | null;
          verified_purity: number | null;
          verified_weight: number | null;
        };
        Insert: {
          client_request_id: string;
          confidence_threshold?: number;
          consumed_entity_id?: string | null;
          created_at?: string;
          error_message?: string | null;
          extraction?: Json | null;
          id?: string;
          operation: string;
          status?: string;
          user_id: string;
          verification_reason?: string | null;
          verified_at?: string | null;
          verified_purity?: number | null;
          verified_weight?: number | null;
        };
        Update: {
          client_request_id?: string;
          confidence_threshold?: number;
          consumed_entity_id?: string | null;
          created_at?: string;
          error_message?: string | null;
          extraction?: Json | null;
          id?: string;
          operation?: string;
          status?: string;
          user_id?: string;
          verification_reason?: string | null;
          verified_at?: string | null;
          verified_purity?: number | null;
          verified_weight?: number | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string;
          id: string;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      _close_issue: {
        Args: { _issue_id: string; _user: string };
        Returns: {
          allowed_wastage_percent: number;
          client_request_id: string | null;
          closed_at: string | null;
          created_at: string;
          created_by: string | null;
          fine_weight: number;
          gross_weight: number;
          id: string;
          is_demo: boolean;
          issue_date: string;
          item_category_id: string;
          job_number: string;
          karigar_id: string;
          purity_percent: number;
          status: string;
          transaction_number: string;
        };
        SetofOptions: {
          from: "*";
          to: "gold_issues";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      _wastage_trend: {
        Args: { _karigar_id: string };
        Returns: {
          closed_jobs: number;
          historical_percent: number;
          is_rising: boolean;
          recent_excess: number;
          recent_percent: number;
        }[];
      };
      calc_fine_weight: {
        Args: { _gross: number; _purity: number };
        Returns: number;
      };
      close_gold_issue: {
        Args: { _issue_id: string };
        Returns: {
          allowed_wastage_percent: number;
          client_request_id: string | null;
          closed_at: string | null;
          created_at: string;
          created_by: string | null;
          fine_weight: number;
          gross_weight: number;
          id: string;
          is_demo: boolean;
          issue_date: string;
          item_category_id: string;
          job_number: string;
          karigar_id: string;
          purity_percent: number;
          status: string;
          transaction_number: string;
        };
        SetofOptions: {
          from: "*";
          to: "gold_issues";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_gold_adjustment: {
        Args: {
          _client_request_id: string;
          _fine_weight_delta: number;
          _issue_id: string;
          _karigar_id: string;
          _reason: string;
        };
        Returns: {
          client_request_id: string | null;
          created_at: string;
          created_by: string | null;
          fine_weight_delta: number;
          id: string;
          issue_id: string | null;
          karigar_id: string;
          reason: string;
          transaction_number: string;
        };
        SetofOptions: {
          from: "*";
          to: "gold_adjustments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_gold_issue: {
        Args: {
          _client_request_id: string;
          _gross_weight: number;
          _issue_date: string;
          _item_category_id: string;
          _job_number: string;
          _karigar_id: string;
          _purity_percent: number;
        };
        Returns: {
          allowed_wastage_percent: number;
          client_request_id: string | null;
          closed_at: string | null;
          created_at: string;
          created_by: string | null;
          fine_weight: number;
          gross_weight: number;
          id: string;
          is_demo: boolean;
          issue_date: string;
          item_category_id: string;
          job_number: string;
          karigar_id: string;
          purity_percent: number;
          status: string;
          transaction_number: string;
        };
        SetofOptions: {
          from: "*";
          to: "gold_issues";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_gold_receipt: {
        Args: {
          _client_request_id: string;
          _gross_weight: number;
          _huid: string;
          _issue_id: string;
          _purity_percent: number;
          _receipt_date: string;
          _receipt_type: string;
        };
        Returns: {
          client_request_id: string | null;
          created_at: string;
          created_by: string | null;
          fine_weight: number;
          gross_weight: number;
          huid: string | null;
          id: string;
          is_demo: boolean;
          issue_id: string;
          karigar_id: string;
          purity_percent: number;
          receipt_date: string;
          receipt_type: string;
          transaction_number: string;
        };
        SetofOptions: {
          from: "*";
          to: "gold_receipts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      delete_karigar: { Args: { _id: string }; Returns: undefined };
      get_karigar_balances: {
        Args: never;
        Returns: {
          closed_loss_percent: number;
          fine_adjusted: number;
          fine_issued: number;
          fine_returned: number;
          full_name: string;
          is_demo: boolean;
          karigar_code: string;
          karigar_id: string;
          open_jobs: number;
          outstanding: number;
        }[];
      };
      get_karigar_outstanding: {
        Args: never;
        Returns: {
          karigar_id: string;
          outstanding: number;
        }[];
      };
      get_stock_statement: {
        Args: { _from: string; _to: string };
        Returns: {
          adjustments: number;
          closing_with_karigars: number;
          day: string;
          issued: number;
          net_movement: number;
          received_filings: number;
          received_jewellery: number;
          received_scrap: number;
        }[];
      };
      get_wastage_trends: {
        Args: never;
        Returns: {
          closed_jobs: number;
          full_name: string;
          historical_percent: number;
          is_rising: boolean;
          karigar_code: string;
          karigar_id: string;
          recent_excess: number;
          recent_percent: number;
        }[];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_staff: { Args: { _user_id: string }; Returns: boolean };
      issue_outstanding: { Args: { _issue_id: string }; Returns: number };
      next_tx_number: { Args: never; Returns: string };
      review_loss_alert: {
        Args: { _id: string; _note: string; _status: string };
        Returns: {
          actual_loss: number;
          alert_type: string;
          created_at: string;
          excess_loss: number;
          expected_loss: number;
          historical_loss_percent: number | null;
          id: string;
          is_demo: boolean;
          issue_id: string | null;
          karigar_id: string;
          recent_loss_percent: number | null;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          severity: string;
          status: string;
        };
        SetofOptions: {
          from: "*";
          to: "loss_alerts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_item_category: {
        Args: {
          _allowed_wastage_percent: number;
          _category_name: string;
          _id: string;
          _is_active: boolean;
        };
        Returns: {
          allowed_wastage_percent: number;
          category_name: string;
          id: string;
          is_active: boolean;
        };
        SetofOptions: {
          from: "*";
          to: "item_categories";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_karigar: {
        Args: {
          _full_name: string;
          _id: string;
          _karigar_code: string;
          _phone: string;
          _preferred_language: string;
        };
        Returns: {
          created_at: string;
          full_name: string;
          id: string;
          is_active: boolean;
          is_demo: boolean;
          karigar_code: string;
          phone: string | null;
          preferred_language: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "karigars";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_loss_settings: {
        Args: {
          _min_excess_points: number;
          _min_history_jobs: number;
          _recent_window: number;
          _trend_ratio: number;
        };
        Returns: {
          id: boolean;
          min_excess_points: number;
          min_history_jobs: number;
          recent_window: number;
          trend_ratio: number;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "loss_settings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_karigar_active: {
        Args: { _active: boolean; _id: string };
        Returns: {
          created_at: string;
          full_name: string;
          id: string;
          is_active: boolean;
          is_demo: boolean;
          karigar_code: string;
          phone: string | null;
          preferred_language: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "karigars";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      verify_photo_reading: {
        Args: {
          _id: string;
          _purity?: number;
          _reason?: string;
          _reject: boolean;
          _weight?: number;
        };
        Returns: {
          client_request_id: string;
          confidence_threshold: number;
          consumed_entity_id: string | null;
          created_at: string;
          error_message: string | null;
          extraction: Json | null;
          id: string;
          operation: string;
          status: string;
          user_id: string;
          verification_reason: string | null;
          verified_at: string | null;
          verified_purity: number | null;
          verified_weight: number | null;
        };
        SetofOptions: {
          from: "*";
          to: "photo_readings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      app_role: "issue_clerk" | "finance_head";
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["issue_clerk", "finance_head"],
    },
  },
} as const;
