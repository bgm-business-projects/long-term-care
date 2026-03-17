export type TripStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
export type TripLogStatus = 'departed' | 'arrived_origin' | 'recipient_boarded' | 'completed'
export type SpecialNeeds = 'general' | 'wheelchair' | 'bedridden'

export interface TripEntity {
  id: string
  careRecipientId: string
  vehicleId: string | null
  driverUserId: string | null
  organizationId: string | null
  scheduledAt: Date
  originAddress: string
  originLat: string | null
  originLng: string | null
  destinationAddress: string
  destinationLat: string | null
  destinationLng: string | null
  status: TripStatus
  mileageEstimated: string | null
  mileageActual: string | null
  needsWheelchair: boolean
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CareRecipientInfo {
  id: string
  name: string
  address: string
  contactPerson: string | null
  contactPhone: string | null
  specialNeeds: SpecialNeeds
}

export interface TripStatusLogEntry {
  id: string
  status: TripLogStatus
  timestamp: Date
  lat: string | null
  lng: string | null
  note: string | null
}

export interface TripWithDetails extends TripEntity {
  careRecipient: CareRecipientInfo
  statusLogs: TripStatusLogEntry[]
}
