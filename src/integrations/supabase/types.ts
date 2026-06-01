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
      activity_logs: {
        Row: {
          action: string
          actor: string
          at: string
          id: string
          target: string | null
        }
        Insert: {
          action: string
          actor: string
          at?: string
          id?: string
          target?: string | null
        }
        Update: {
          action?: string
          actor?: string
          at?: string
          id?: string
          target?: string | null
        }
        Relationships: []
      }
      clearance_requests: {
        Row: {
          clearance_id: string
          email: string
          faculty: string
          id: string
          level: string
          matric_no: string
          overall_status: Database["public"]["Enums"]["clearance_status"]
          program: string
          reason: string
          request_type: Database["public"]["Enums"]["request_type_t"]
          student_id: string
          student_name: string
          submitted_at: string
        }
        Insert: {
          clearance_id: string
          email: string
          faculty: string
          id?: string
          level: string
          matric_no: string
          overall_status?: Database["public"]["Enums"]["clearance_status"]
          program: string
          reason: string
          request_type?: Database["public"]["Enums"]["request_type_t"]
          student_id: string
          student_name: string
          submitted_at?: string
        }
        Update: {
          clearance_id?: string
          email?: string
          faculty?: string
          id?: string
          level?: string
          matric_no?: string
          overall_status?: Database["public"]["Enums"]["clearance_status"]
          program?: string
          reason?: string
          request_type?: Database["public"]["Enums"]["request_type_t"]
          student_id?: string
          student_name?: string
          submitted_at?: string
        }
        Relationships: []
      }
      dept_reviews: {
        Row: {
          department: Database["public"]["Enums"]["department_t"]
          id: string
          remarks: string | null
          request_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["clearance_status"]
        }
        Insert: {
          department: Database["public"]["Enums"]["department_t"]
          id?: string
          remarks?: string | null
          request_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["clearance_status"]
        }
        Update: {
          department?: Database["public"]["Enums"]["department_t"]
          id?: string
          remarks?: string | null
          request_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["clearance_status"]
        }
        Relationships: [
          {
            foreignKeyName: "dept_reviews_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "clearance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_balances: {
        Row: {
          amount_due: number
          created_at: string
          id: string
          item: string
          student_id: string
        }
        Insert: {
          amount_due?: number
          created_at?: string
          id?: string
          item: string
          student_id: string
        }
        Update: {
          amount_due?: number
          created_at?: string
          id?: string
          item?: string
          student_id?: string
        }
        Relationships: []
      }
      hostel_assignments: {
        Row: {
          checked_out: boolean
          created_at: string
          damage_fee: number
          id: string
          room: string
          student_id: string
        }
        Insert: {
          checked_out?: boolean
          created_at?: string
          damage_fee?: number
          id?: string
          room: string
          student_id: string
        }
        Update: {
          checked_out?: boolean
          created_at?: string
          damage_fee?: number
          id?: string
          room?: string
          student_id?: string
        }
        Relationships: []
      }
      ict_assets: {
        Row: {
          asset: string
          created_at: string
          id: string
          replacement_cost: number
          returned: boolean
          student_id: string
        }
        Insert: {
          asset: string
          created_at?: string
          id?: string
          replacement_cost?: number
          returned?: boolean
          student_id: string
        }
        Update: {
          asset?: string
          created_at?: string
          id?: string
          replacement_cost?: number
          returned?: boolean
          student_id?: string
        }
        Relationships: []
      }
      library_loans: {
        Row: {
          book_title: string
          created_at: string
          due_date: string
          fine_amount: number
          id: string
          returned: boolean
          student_id: string
        }
        Insert: {
          book_title: string
          created_at?: string
          due_date: string
          fine_amount?: number
          id?: string
          returned?: boolean
          student_id: string
        }
        Update: {
          book_title?: string
          created_at?: string
          due_date?: string
          fine_amount?: number
          id?: string
          returned?: boolean
          student_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          department: Database["public"]["Enums"]["department_t"] | null
          email: string
          faculty: string | null
          id: string
          level: string | null
          matric_no: string | null
          name: string
          program: string | null
        }
        Insert: {
          created_at?: string
          department?: Database["public"]["Enums"]["department_t"] | null
          email: string
          faculty?: string | null
          id: string
          level?: string | null
          matric_no?: string | null
          name: string
          program?: string | null
        }
        Update: {
          created_at?: string
          department?: Database["public"]["Enums"]["department_t"] | null
          email?: string
          faculty?: string | null
          id?: string
          level?: string | null
          matric_no?: string | null
          name?: string
          program?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_department: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["department_t"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "student" | "department" | "admin"
      clearance_status: "pending" | "approved" | "rejected"
      department_t:
        | "Finance"
        | "Library"
        | "ICT"
        | "Registrar"
        | "Hostel"
        | "Sports"
      request_type_t:
        | "library"
        | "finance"
        | "ict"
        | "hostel"
        | "general"
        | "graduation"
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
    Enums: {
      app_role: ["student", "department", "admin"],
      clearance_status: ["pending", "approved", "rejected"],
      department_t: [
        "Finance",
        "Library",
        "ICT",
        "Registrar",
        "Hostel",
        "Sports",
      ],
      request_type_t: [
        "library",
        "finance",
        "ict",
        "hostel",
        "general",
        "graduation",
      ],
    },
  },
} as const
