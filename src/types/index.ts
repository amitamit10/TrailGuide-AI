export type TravelStyle = "relaxed" | "packed" | "balanced";
export type TripStatus = "planning" | "active" | "completed";
export type ActivityCategory =
  | "food"
  | "attraction"
  | "transport"
  | "hotel"
  | "flight"
  | "free";
export type NudgeType = "timing" | "discovery" | "weather" | "navigation";
export type DocumentType = "flight" | "hotel" | "airbnb" | "other";

export interface Profile {
  id: string;
  telegram_chat_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
  default_currency: string;
  created_at: string;
}

export interface Trip {
  id: string;
  user_id: string;
  title: string;
  destination: string;
  destination_lat: number | null;
  destination_lng: number | null;
  departure_city: string | null;
  start_date: string;
  end_date: string;
  travelers_count: number;
  budget_total: number | null;
  budget_currency: string;
  travel_style: TravelStyle;
  interests: string[];
  status: TripStatus;
  created_at: string;
}

export interface ItineraryDay {
  id: string;
  trip_id: string;
  day_number: number;
  date: string;
  notes: string | null;
}

export interface Activity {
  id: string;
  day_id: string;
  trip_id: string;
  title: string;
  description: string | null;
  category: ActivityCategory;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  location_name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  estimated_cost: number | null;
  photo_url: string | null;
  photo_query: string | null;
  rating: number | null;
  notes: string | null;
  is_completed: boolean;
  sort_order: number;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  trip_id: string | null;
  session_id: string | null;
  role: "user" | "model";
  content: string;
  created_at: string;
}

export interface CompanionNudge {
  id: string;
  trip_id: string;
  type: NudgeType;
  message: string;
  action_label: string | null;
  action_data: Record<string, unknown> | null;
  sent_at: string;
  dismissed_at: string | null;
}

export interface TripConfig {
  destination: string;
  destination_lat?: number;
  destination_lng?: number;
  departure_city?: string;
  start_date: string;
  end_date: string;
  travelers_count: number;
  traveler_ages?: number[];
  budget_total?: number;
  budget_currency: string;
  travel_style: TravelStyle;
  interests: string[];
  flights_booked: boolean;
  hotels_booked: boolean;
}

export interface GeneratedActivity {
  title: string;
  description: string;
  category: ActivityCategory;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  location_name: string;
  address: string;
  lat: number;
  lng: number;
  estimated_cost: number;
  photo_query: string;
  rating?: number;
}

export interface GeneratedDay {
  day_number: number;
  date: string;
  activities: GeneratedActivity[];
}

export interface GeneratedItinerary {
  days: GeneratedDay[];
}

export interface CompanionNudgeOutput {
  type: NudgeType;
  message: string;
  action_label?: string;
  action_data?: Record<string, unknown>;
}

export interface ExtractedDocumentData {
  type: DocumentType;
  flight_number?: string;
  departure_airport?: string;
  arrival_airport?: string;
  departure_time?: string;
  arrival_time?: string;
  airline?: string;
  hotel_name?: string;
  hotel_address?: string;
  check_in?: string;
  check_out?: string;
  confirmation_number?: string;
}
