export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole =
  | 'STUDENT'
  | 'INSTRUCTOR'
  | 'DRIVING_SCHOOL'
  | 'SCHOOL_ADMIN'
  | 'SCHOOL_STAFF'
  | 'PLATFORM_ADMIN'
  | 'SUPPORT';

export type UserStatus = 'ACTIVE' | 'BLOCKED' | 'SUSPENDED' | 'PENDING_VERIFICATION';
export type ProviderType = 'INSTRUCTOR' | 'DRIVING_SCHOOL';
export type ProviderStatus = 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'SUSPENDED' | 'BLOCKED' | 'REJECTED';
export type VehicleCategory = 'A' | 'B';
export type VehicleTransmission = 'MANUAL' | 'AUTOMATIC';
export type VehicleStatus = 'PENDING' | 'IN_REVIEW' | 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'BLOCKED';
export type ComplianceDocType =
  | 'CNH'
  | 'CREDENTIAL_DETRAN'
  | 'CRLV'
  | 'DUAL_PEDAL_INSPECTION'
  | 'CRIMINAL_BACKGROUND'
  | 'CONTRACT_SOCIAL'
  | 'CFC_ALVARA';
export type ComplianceStatus = 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';
export type BookingStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PAYMENT_FAILED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED_BY_STUDENT'
  | 'CANCELLED_BY_PROVIDER'
  | 'NO_SHOW_STUDENT'
  | 'NO_SHOW_PROVIDER'
  | 'DISPUTED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'EXPIRED';

export type PaymentMethod = 'PIX' | 'CREDIT_CARD';
export type PaymentStatus = 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CHARGEBACK';
export type PayoutStatus = 'PENDING' | 'AVAILABLE' | 'PROCESSING' | 'PAID' | 'FAILED' | 'BLOCKED';

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          phone: string;
          role: UserRole;
          status: UserStatus;
          cpf: string | null;
          birth_date: string | null;
          avatar_url: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at' | 'updated_at' | 'cpf' | 'birth_date'> & {
          cpf?: string | null;
          birth_date?: string | null;
        };
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      providers: {
        Row: {
          id: string;
          user_id: string | null;
          type: ProviderType;
          legal_name: string;
          trade_name: string;
          document_number: string;
          status: ProviderStatus;
          bio: string | null;
          rating_average: number;
          rating_count: number;
          service_radius_km: number;
          location: unknown | null;
          neighborhood: string | null;
          city: string;
          state: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['providers']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['providers']['Insert']>;
      };
      vehicles: {
        Row: {
          id: string;
          provider_id: string;
          brand: string;
          model: string;
          year: number;
          license_plate: string;
          license_plate_masked: string;
          renavam: string | null;
          category: VehicleCategory;
          transmission: VehicleTransmission;
          has_dual_pedal: boolean;
          has_dashcam: boolean;
          status: VehicleStatus;
          photos: string[];
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['vehicles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['vehicles']['Insert']>;
      };
      service_offerings: {
        Row: {
          id: string;
          provider_id: string;
          instructor_id: string | null;
          vehicle_id: string;
          category: VehicleCategory;
          transmission: VehicleTransmission;
          duration_minutes: number;
          price_in_cents: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['service_offerings']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['service_offerings']['Insert']>;
      };
      bookings: {
        Row: {
          id: string;
          student_id: string;
          provider_id: string;
          instructor_id: string;
          vehicle_id: string;
          offering_id: string;
          quote_id: string | null;
          status: BookingStatus;
          scheduled_start_at: string;
          scheduled_end_at: string;
          slot_range: string;
          meeting_point: Json;
          price_in_cents: number;
          platform_fee_in_cents: number;
          total_in_cents: number;
          snapshot_data: Json;
          cancellation_data: Json | null;
          checkin_student_at: string | null;
          checkin_instructor_at: string | null;
          lesson_started_at: string | null;
          lesson_finished_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['bookings']['Row'], 'created_at' | 'updated_at' | 'slot_range'>;
        Update: Partial<Database['public']['Tables']['bookings']['Insert']>;
      };
      payments: {
        Row: {
          id: string;
          booking_id: string;
          method: PaymentMethod;
          status: PaymentStatus;
          amount_in_cents: number;
          external_transaction_id: string | null;
          idempotency_key: string;
          gateway_provider: string;
          metadata: Json;
          paid_at: string | null;
          pix_qr_code: string | null;
          pix_qr_code_base64: string | null;
          pix_expires_at: string | null;
          gateway_fee_in_cents: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['payments']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['payments']['Insert']>;
      };
      payouts: {
        Row: {
          id: string;
          provider_id: string;
          booking_id: string;
          amount_in_cents: number;
          status: PayoutStatus;
          scheduled_release_at: string;
          released_at: string | null;
          external_payout_id: string | null;
          idempotency_key: string;
          gross_amount_in_cents: number | null;
          platform_fee_in_cents: number;
          gateway_fee_in_cents: number;
          gateway_fee_source: string;
          transfer_method: string;
          destination_key_type: string | null;
          destination_key: string | null;
          destination_key_masked: string | null;
          recipient_name: string | null;
          recipient_document: string | null;
          processed_by: string | null;
          processed_at: string | null;
          transfer_reference: string | null;
          failure_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['payouts']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['payouts']['Insert']>;
      };
      user_push_devices: {
        Row: {
          id: string;
          user_id: string;
          app_context: 'STUDENT' | 'PRO' | 'ADMIN';
          provider: 'WEB_PUSH' | 'FCM';
          device_fingerprint: string;
          endpoint: string;
          public_key: string | null;
          auth_key: string | null;
          last_seen_at: string;
          disabled_at: string | null;
          invalidated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_push_devices']['Row'], 'id' | 'created_at' | 'updated_at' | 'last_seen_at' | 'disabled_at' | 'invalidated_at'>;
        Update: Partial<Database['public']['Tables']['user_push_devices']['Insert']>;
      };
      provider_pix_destinations: {
        Row: {
          id: string;
          provider_id: string;
          key_type: string;
          pix_key: string;
          holder_name: string;
          holder_document: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['provider_pix_destinations']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['provider_pix_destinations']['Insert']>;
      };
      payment_webhook_events: {
        Row: {
          id: string;
          gateway: string;
          external_event_id: string;
          external_payment_id: string | null;
          event_type: string;
          payload_hash: string | null;
          status: string;
          error_message: string | null;
          received_at: string;
          processed_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['payment_webhook_events']['Row'], 'received_at'>;
        Update: Partial<Database['public']['Tables']['payment_webhook_events']['Insert']>;
      };
      reviews: {
        Row: {
          id: string;
          booking_id: string;
          student_id: string;
          provider_id: string;
          instructor_id: string;
          rating_overall: number;
          rating_didactics: number | null;
          rating_punctuality: number | null;
          rating_safety: number | null;
          rating_vehicle: number | null;
          rating_cordiality: number | null;
          comment: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['reviews']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['reviews']['Insert']>;
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          previous_value: Json | null;
          new_value: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>;
      };
      platform_configurations: {
        Row: {
          id: string;
          key: string;
          value: Json;
          description: string | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['platform_configurations']['Row'], 'updated_at'>;
        Update: Partial<Database['public']['Tables']['platform_configurations']['Insert']>;
      };
    };
  };
}
