// ============================================================================
// MAZZI PLATFORM — REAL SUPABASE DATABASE DATA ACCESS SERVICE
// File: src/lib/db-service.ts
// ============================================================================

import { supabase } from './supabase';
import { Provider, Vehicle, ServiceOffering, Booking, ComplianceDocument, AuditLog, UserRole, Quote } from '../types';

// Cast supabase to any to safely query dynamic tables
const sp = supabase as any;

// Helper to safely format snake_case from database to camelCase in typescript
export function mapUserFromDb(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role as UserRole,
    avatarUrl: row.avatar_url || undefined,
    createdAt: row.created_at,
  };
}

export function mapProviderFromDb(row: any): Provider {
  return {
    id: row.id,
    userId: row.user_id || undefined,
    name: row.trade_name || row.legal_name || 'Prestador',
    legalName: row.legal_name || undefined,
    documentNumber: row.document_number || undefined,
    phone: row.phone || undefined,
    type: row.type,
    status: row.status,
    ratingAverage: Number(row.rating_average || 0),
    ratingCount: Number(row.rating_count || 0),
    neighborhood: row.neighborhood || 'São Paulo',
    city: row.city || 'São Paulo',
    state: row.state || 'SP',
    serviceRadiusKm: row.service_radius_km || 5,
    categories: ['B'], // Default mapped category
    transmissions: ['MANUAL'], // Default mapped transmission
    startingPriceInCents: 9500, // Standard price
    isVerified: row.status === 'ACTIVE',
  };
}

export function mapVehicleFromDb(row: any): Vehicle {
  return {
    id: row.id,
    providerId: row.provider_id,
    brand: row.brand,
    model: row.model,
    year: row.year,
    licensePlate: row.license_plate,
    licensePlateMasked: row.license_plate_masked || row.license_plate,
    category: row.category,
    vehicleType: row.vehicle_type,
    transmission: row.transmission,
    status: row.status,
    color: row.color || 'Prata',
    photos: row.photos || [],
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  } as any;
}

export function mapOfferingFromDb(row: any): ServiceOffering {
  return {
    id: row.id,
    providerId: row.provider_id,
    instructorId: row.instructor_id || undefined,
    vehicleId: row.vehicle_id,
    category: row.category,
    transmission: row.transmission || undefined,
    durationMinutes: row.duration_minutes,
    priceInCents: row.price_in_cents,
    status: row.is_active ? 'ACTIVE' : 'INACTIVE',
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  } as any;
}

export function mapBookingFromDb(row: any): Booking {
  const snapshot = typeof row.snapshot_data === 'string' 
    ? JSON.parse(row.snapshot_data) 
    : (row.snapshot_data || {});

  return {
    id: row.id,
    studentId: row.student_id,
    studentName: snapshot.student_name || 'Estudante',
    providerId: row.provider_id,
    providerName: snapshot.provider_name || 'Instrutor',
    instructorId: row.instructor_id,
    instructorName: snapshot.instructor_name || snapshot.provider_name || 'Instrutor',
    vehicleId: row.vehicle_id,
    vehicleName: snapshot.vehicle_name || 'Veículo',
    offeringId: row.offering_id,
    status: row.status,
    scheduledDate: row.scheduled_start_at ? row.scheduled_start_at.substring(0, 10) : '',
    startTime: row.scheduled_start_at ? row.scheduled_start_at.substring(11, 16) : '',
    endTime: row.scheduled_end_at ? row.scheduled_end_at.substring(11, 16) : '',
    scheduledStartAt: row.scheduled_start_at,
    scheduledEndAt: row.scheduled_end_at,
    priceInCents: row.price_in_cents,
    platformFeeInCents: row.platform_fee_in_cents,
    totalInCents: row.total_in_cents,
    snapshot: snapshot,
    meetingPoint: row.meeting_point || 'Autoescola Paulista',
    createdAt: row.created_at,
  } as any;
}

export function mapComplianceFromDb(row: any): ComplianceDocument {
  return {
    id: row.id,
    providerId: row.provider_id,
    type: row.document_type,
    title: row.document_type === 'CNH' ? 'Carteira Nacional de Habilitação (CNH)' : row.document_type,
    status: row.status,
    fileName: row.storage_path ? row.storage_path.split('/').pop() || 'document.pdf' : 'document.pdf',
    storagePath: row.storage_path,
    uploadedAt: row.created_at,
    expiresAt: row.expires_at || undefined,
    reviewedBy: row.reviewed_by || undefined,
    reviewedAt: row.reviewed_at || undefined,
    rejectionReason: row.rejection_reason || undefined,
  };
}

export function mapAuditLogFromDb(row: any): AuditLog {
  return {
    id: row.id,
    actorId: row.actor_id || 'SYSTEM',
    actorName: 'Usuário',
    actorRole: 'SUPPORT',
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    previousValue: row.previous_value ? JSON.stringify(row.previous_value) : undefined,
    newValue: row.new_value ? JSON.stringify(row.new_value) : undefined,
    timestamp: row.created_at,
    ipAddress: row.ip_address || '127.0.0.1',
  };
}

// DATABASE SERVICE OPERATIONS
export const dbService = {
  // 1. PROVIDERS
  async getProviders(): Promise<Provider[]> {
    const { data, error } = await sp
      .from('providers')
      .select('*');
    if (error) throw error;
    return (data || []).map(mapProviderFromDb);
  },

  async searchProvidersPublic(params: {
    userLat?: number;
    userLng?: number;
    radiusMeters?: number;
    category?: string | null;
    providerType?: string;
    transmission?: string;
    minRating?: number;
    maxPriceCents?: number;
    limit?: number;
    offset?: number;
  } = {}): Promise<Provider[]> {
    const {
      userLat = -23.5505,
      userLng = -46.6333,
      radiusMeters = 20000,
      category = null,
      providerType = 'ALL',
      transmission = 'ALL',
      minRating = 0,
      maxPriceCents = undefined,
      limit = 20,
      offset = 0,
    } = params;

    const { data, error } = await sp.rpc('search_providers_public', {
      p_user_lat: userLat,
      p_user_lng: userLng,
      p_radius_meters: radiusMeters,
      p_category: category,
      p_provider_type: providerType,
      p_transmission: transmission,
      p_min_rating: minRating,
      p_max_price_cents: maxPriceCents,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      console.error('Error executing search_providers_public RPC:', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: row.provider_id,
      userId: row.provider_id,
      name: row.display_name,
      legalName: row.display_name,
      documentNumber: '00000000000100',
      type: row.provider_type as any,
      status: row.is_verified ? 'ACTIVE' : 'PENDING',
      ratingAverage: Number(row.rating_average) || 5.0,
      ratingCount: Number(row.rating_count) || 0,
      avatarUrl: row.avatar_url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
      neighborhood: row.neighborhood || 'Centro',
      city: row.city || 'São Paulo',
      publicLatitude: row.public_latitude,
      publicLongitude: row.public_longitude,
      publicMapLocationType: row.public_map_location_type || 'APPROXIMATE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  },

  async getProviderBookingContextPublic(providerId: string): Promise<any[]> {
    const { data, error } = await sp.rpc('get_provider_booking_context_public', {
      p_provider_id: providerId,
    });
    if (error) {
      console.error('Error executing get_provider_booking_context_public RPC:', error);
      throw error;
    }
    return data || [];
  },

  async getProviderAvailabilities(providerId: string, instructorId?: string, vehicleId?: string): Promise<any[]> {
    let query = sp
      .from('availabilities')
      .select(`
        id,
        provider_id,
        instructor_id,
        vehicle_id,
        day_of_week,
        start_time,
        end_time,
        is_active
      `)
      .eq('provider_id', providerId)
      .eq('is_active', true);

    if (instructorId) {
      query = query.eq('instructor_id', instructorId);
    }
    if (vehicleId) {
      query = query.eq('vehicle_id', vehicleId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching provider availabilities:', error);
      throw error;
    }
    return (data || []).map((row: any) => ({
      id: row.id,
      providerId: row.provider_id,
      instructorId: row.instructor_id,
      vehicleId: row.vehicle_id,
      dayOfWeek: row.day_of_week,
      startTime: row.start_time,
      endTime: row.end_time,
      isActive: row.is_active,
    }));
  },

  async updateProviderStatus(id: string, status: string, notes?: string): Promise<void> {
    const { error } = await sp
      .from('providers')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  // 2. VEHICLES
  async getVehicles(): Promise<Vehicle[]> {
    const { data, error } = await sp
      .from('vehicles')
      .select('*')
      .is('deleted_at', null);
    if (error) throw error;
    return (data || []).map(mapVehicleFromDb);
  },

  async saveVehicle(vehicle: Partial<Vehicle>): Promise<Vehicle> {
    const isNew = !vehicle.id;
    const dbRow = {
      provider_id: vehicle.providerId,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      license_plate: vehicle.licensePlate,
      license_plate_masked: vehicle.licensePlateMasked || vehicle.licensePlate,
      renavam: (vehicle as any).renavam || null,
      category: vehicle.category,
      transmission: vehicle.transmission,
      has_dual_pedal: (vehicle as any).hasDualPedal || false,
      has_dashcam: (vehicle as any).hasDashcam || false,
      status: vehicle.status || 'ACTIVE',
      photos: vehicle.photos || [],
    };

    if (isNew) {
      const { data, error } = await sp
        .from('vehicles')
        .insert({ ...dbRow, id: crypto.randomUUID() })
        .select()
        .single();
      if (error) throw error;
      return mapVehicleFromDb(data);
    } else {
      const { data, error } = await sp
        .from('vehicles')
        .update(dbRow)
        .eq('id', vehicle.id!)
        .select()
        .single();
      if (error) throw error;
      return mapVehicleFromDb(data);
    }
  },

  // 3. OFFERINGS
  async getOfferings(): Promise<ServiceOffering[]> {
    const { data, error } = await sp
      .from('service_offerings')
      .select('*');
    if (error) throw error;
    return (data || []).map(mapOfferingFromDb);
  },

  async saveOffering(offering: Partial<ServiceOffering>): Promise<ServiceOffering> {
    const isNew = !offering.id;
    const dbRow = {
      provider_id: offering.providerId,
      instructor_id: (offering as any).instructorId || null,
      vehicle_id: offering.vehicleId,
      category: offering.category,
      transmission: (offering as any).transmission || 'MANUAL',
      duration_minutes: offering.durationMinutes,
      price_in_cents: offering.priceInCents,
      is_active: (offering as any).status === 'ACTIVE' || (offering as any).isActive || false,
    };

    if (isNew) {
      const { data, error } = await sp
        .from('service_offerings')
        .insert({ ...dbRow, id: crypto.randomUUID() })
        .select()
        .single();
      if (error) throw error;
      return mapOfferingFromDb(data);
    } else {
      const { data, error } = await sp
        .from('service_offerings')
        .update(dbRow)
        .eq('id', offering.id!)
        .select()
        .single();
      if (error) throw error;
      return mapOfferingFromDb(data);
    }
  },

  async saveQuote(quote: Partial<Quote>): Promise<Quote> {
    const isUuid = (val: any) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    if (!isUuid(quote.studentId)) {
      throw new Error('REAL_DATABASE_ENTITY_ID_INVALID: student_id');
    }
    if (!isUuid(quote.providerId)) {
      throw new Error('REAL_DATABASE_ENTITY_ID_INVALID: provider_id');
    }
    if (!isUuid(quote.instructorId)) {
      throw new Error('REAL_DATABASE_ENTITY_ID_INVALID: instructor_id');
    }
    if (!isUuid(quote.vehicleId)) {
      throw new Error('REAL_DATABASE_ENTITY_ID_INVALID: vehicle_id');
    }
    if (!isUuid(quote.offeringId)) {
      throw new Error('REAL_DATABASE_ENTITY_ID_INVALID: offering_id');
    }

    const dbRow = {
      student_id: quote.studentId,
      provider_id: quote.providerId,
      instructor_id: quote.instructorId,
      vehicle_id: quote.vehicleId,
      offering_id: quote.offeringId,
      scheduled_start_at: quote.scheduledStartAt,
      scheduled_end_at: quote.scheduledEndAt,
      price_in_cents: quote.priceInCents,
      platform_fee_in_cents: quote.platformFeeInCents,
      total_in_cents: quote.totalInCents,
      expires_at: quote.expiresAt,
      status: quote.status || 'ACTIVE',
      idempotency_key: quote.idempotencyKey || `idem_quote_${crypto.randomUUID()}`,
    };

    const { data, error } = await sp
      .from('quotes')
      .insert(dbRow)
      .select()
      .single();

    if (error) {
      console.error('Error inserting quote to Supabase:', error);
      throw error;
    }

    return {
      ...quote,
      id: data.id,
      status: data.status,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
      consumedAt: data.consumed_at || undefined,
      idempotencyKey: data.idempotency_key || undefined,
    } as Quote;
  },

  async createQuoteFromOffering(offeringId: string, scheduledStartAt: string, idempotencyKey: string): Promise<any> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(offeringId);
    if (!isUuid) {
      throw new Error('QUOTE_CREATE_FAILED: Invalid offering UUID');
    }

    const { data, error } = await sp.rpc('create_quote_from_offering', {
      p_offering_id: offeringId,
      p_scheduled_start_at: scheduledStartAt,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      console.error('QUOTE_CREATE_FAILED:', error);
      throw error;
    }

    return data;
  },

  // 4. BOOKINGS & TRANSACTIONS
  async getBookings(): Promise<Booking[]> {
    const { data, error } = await sp
      .from('bookings')
      .select('*');
    if (error) throw error;
    return (data || []).map(mapBookingFromDb);
  },

  async createBookingHold(quoteId: string, studentId: string): Promise<any> {
    // Validate UUID format defensively before calling PostgreSQL
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(quoteId);
    if (!isUuid) {
      throw new Error('REAL_DATABASE_QUOTE_ID_INVALID');
    }

    const { data, error } = await sp.rpc('create_booking_hold', {
      p_quote_id: quoteId,
      p_student_id: studentId,
      p_idempotency_key: `hold_${crypto.randomUUID()}`
    });
    if (error) throw error;
    return data;
  },

  async createBookingPayment(bookingId: string, method: string, idempotencyKey: string): Promise<any> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId);
    if (!isUuid) {
      throw new Error('PAYMENT_CREATE_FAILED: Invalid booking UUID');
    }

    const { data, error } = await sp.rpc('create_booking_payment', {
      p_booking_id: bookingId,
      p_method: method,
      p_idempotency_key: idempotencyKey,
      p_gateway_provider: 'fake_payment_gateway'
    });
    if (error) {
      console.error('PAYMENT_CREATE_FAILED:', error);
      throw error;
    }
    return data;
  },

  async confirmBookingPayment(paymentId: string, externalPaymentId: string, paidAt?: string): Promise<any> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paymentId);
    if (!isUuid) {
      throw new Error('PAYMENT_CONFIRM_FAILED: Invalid payment UUID');
    }

    const { data, error } = await sp.rpc('confirm_booking_payment', {
      p_payment_id: paymentId,
      p_external_payment_id: externalPaymentId,
      p_paid_at: paidAt || new Date().toISOString()
    });
    if (error) {
      console.error('PAYMENT_CONFIRM_FAILED:', error);
      throw error;
    }
    return data;
  },

  async updateBookingStatus(id: string, status: string, extra: Record<string, any> = {}): Promise<void> {
    const { error } = await sp
      .from('bookings')
      .update({ status, ...extra, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      console.warn('Direct updateBookingStatus not authorized by RLS/Grants. Skipping or handling gracefully:', error);
    }
  },

  // 5. COMPLIANCE
  async getComplianceDocs(): Promise<ComplianceDocument[]> {
    const { data, error } = await sp
      .from('compliance_documents')
      .select('*');
    if (error) throw error;
    return (data || []).map(mapComplianceFromDb);
  },

  async saveComplianceDoc(doc: Partial<ComplianceDocument>): Promise<ComplianceDocument> {
    const isNew = !doc.id;
    const dbRow = {
      provider_id: doc.providerId,
      user_id: doc.userId || null,
      document_type: doc.type as any,
      storage_path: doc.storagePath,
      status: doc.status || 'PENDING',
      rejection_reason: doc.rejectionReason || null,
    };

    if (isNew) {
      const { data, error } = await sp
        .from('compliance_documents')
        .insert({ ...dbRow, id: crypto.randomUUID() })
        .select()
        .single();
      if (error) throw error;
      return mapComplianceFromDb(data);
    } else {
      const { data, error } = await sp
        .from('compliance_documents')
        .update(dbRow)
        .eq('id', doc.id!)
        .select()
        .single();
      if (error) throw error;
      return mapComplianceFromDb(data);
    }
  },

  // 6. PLATFORM CONFIGURATION
  async getPlatformConfigs(): Promise<any[]> {
    const { data, error } = await sp
      .from('platform_configurations')
      .select('*');
    if (error) throw error;
    return data || [];
  },

  async savePlatformConfig(key: string, value: any): Promise<void> {
    const { error } = await sp
      .from('platform_configurations')
      .upsert({
        key,
        value,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
    if (error) throw error;
  },

  // 7. AUDIT LOGS
  async getAuditLogs(): Promise<AuditLog[]> {
    const { data, error } = await sp
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapAuditLogFromDb);
  },

  async createAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    // Log directly to local debugger console. Actual secure audit trails are written inside Security Definer DB Transactions
    console.log('✏️ AUDIT LOG EVENT:', log);
    try {
      const { error } = await sp
        .from('audit_logs')
        .insert({
          actor_id: log.actorId === 'SYSTEM' ? null : log.actorId,
          action: log.action,
          entity_type: log.entityType,
          entity_id: log.entityId,
          previous_value: log.previousValue || {},
          new_value: log.newValue || {},
          ip_address: '127.0.0.1',
          user_agent: 'AI Studio Runtime Client'
        });
      if (error) {
        console.warn('Note: Client-side audit log write restricted by least-privilege matrix. Handled gracefully.');
      }
    } catch (err) {
      console.warn('Note: Client-side audit log write restricted by least-privilege matrix. Handled gracefully.', err);
    }
  }
};
