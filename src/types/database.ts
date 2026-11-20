export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TransactionType = 'income' | 'expense';
export type DebtType = 'lent' | 'borrowed';
export type DebtStatus = 'pending' | 'settled' | 'overdue';
export type MilkLogStatus = 'paid' | 'skipped' | 'pending' | 'delivered';

export interface Database {
  public: {
    Tables: {
      transactions: {
        Row: {
          id: string;
          amount: number;
          type: TransactionType;
          category: string;
          date: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          amount: number;
          type: TransactionType;
          category: string;
          date?: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          amount?: number;
          type?: TransactionType;
          category?: string;
          date?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      debts: {
        Row: {
          id: string;
          person_name: string;
          type: DebtType;
          amount: number;
          paid_amount?: number;
          due_date: string | null;
          status: DebtStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          person_name: string;
          type: DebtType;
          amount: number;
          paid_amount?: number;
          due_date?: string | null;
          status?: DebtStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          person_name?: string;
          type?: DebtType;
          amount?: number;
          paid_amount?: number;
          due_date?: string | null;
          status?: DebtStatus;
          created_at?: string;
        };
        Relationships: [];
      };
      swiggy_income: {
        Row: {
          id: string;
          date: string;
          gross_amount: number;
          deduction_amount: number;
          deduction_reason: string | null;
          fuel_expense: number;
          km_driven: number;
          net_amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          date?: string;
          gross_amount: number;
          deduction_amount?: number;
          deduction_reason?: string | null;
          fuel_expense?: number;
          km_driven?: number;
          net_amount?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          gross_amount?: number;
          deduction_amount?: number;
          deduction_reason?: string | null;
          fuel_expense?: number;
          km_driven?: number;
          net_amount?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      daily_milk_logs: {
        Row: {
          id: string;
          date: string;
          amount: number;
          status: MilkLogStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          date?: string;
          amount: number;
          status: MilkLogStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          amount?: number;
          status?: MilkLogStatus;
          created_at?: string;
        };
        Relationships: [];
      };
      app_settings: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type Debt = Database['public']['Tables']['debts']['Row'];
export type SwiggyIncome = Database['public']['Tables']['swiggy_income']['Row'];
export type DailyMilkLog = Database['public']['Tables']['daily_milk_logs']['Row'];
