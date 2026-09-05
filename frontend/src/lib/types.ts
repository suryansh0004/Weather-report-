export type Persona = 'kisan' | 'commuter' | 'tourist' | 'coastal';

export interface LocationBlock {
  district: string;
  district_id: string;
  state: string;
  lat: number;
  lon: number;
  terrain: string;
  agro_zone: string;
  imd_station: string;
  distance_km?: number;
  languages: string[];
}

export interface Observation {
  observed_at: string;
  station: string;
  sky_code: string;
  temp_c: number;
  feels_like_c: number;
  temp_max_c: number;
  temp_min_c: number;
  departure_from_normal_c: number;
  humidity_pct: number;
  dew_point_c: number;
  pressure_hpa: number;
  wind_kmph: number;
  wind_dir: string;
  wind_dir_deg: number;
  gust_kmph: number;
  visibility_km: number;
  uv_index: number;
  rain_last_24h_mm: number;
  rain_prob_24h_pct: number;
  sunrise: string;
  sunset: string;
}

export interface AirQuality {
  station: string;
  aqi: number;
  category: string;
  colour: string;
  health_advice: string;
  dominant_pollutant: string;
  concentrations_ug_m3: Record<string, number>;
  sub_indices: Record<string, number>;
  trend_24h: { hour: string; aqi: number }[];
  mask_advised: boolean;
  outdoor_exercise_ok: boolean;
}

export interface HourPoint {
  time: string;
  hour: string;
  temp_c: number;
  sky_code: string;
  rain_prob_pct: number;
  rain_mm: number;
  wind_kmph: number;
  wind_dir: string;
  humidity_pct: number;
}

export interface DayPoint {
  date: string;
  day_label: string;
  temp_max_c: number;
  temp_min_c: number;
  sky_code: string;
  rain_prob_pct: number;
  rain_mm: number;
  humidity_pct: number;
  wind_kmph: number;
  soil_moisture_pct: number;
  warnings: string[];
  sunshine_hours: number;
}

export interface CapAlert {
  identifier: string;
  sender: string;
  source: string;
  sent: string;
  expires: string;
  event: string;
  event_code: string;
  category: string;
  urgency: string;
  severity: string;
  certainty: string;
  colour: 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | string;
  response_type: string;
  headline: string;
  headline_hi?: string;
  description: string;
  instruction: string;
  instruction_hi?: string;
  area: string;
  origin: 'CAP' | 'DERIVED' | string;
}

export interface Widget {
  id: string;
  title: string;
  score: number;
  rank: number;
  why: string[];
  visible: boolean;
}

export interface Layout {
  persona: Persona;
  emergency_override: boolean;
  severity_score: number;
  widgets: Widget[];
  signals: Record<string, unknown> & {
    alerts_active: number;
    top_alert_colour: string | null;
    rain_onset_min: number | null;
    nowcast_band: string;
    aqi: number;
    aqi_category: string;
    uv_index: number;
    visibility_km: number;
    soil_moisture_pct: number;
    week_warnings: string[];
    terrain: string;
    cyclone: string | null;
  };
}

export interface Nowcast {
  issued_at: string;
  valid_minutes: number;
  radar_station: string;
  steps: { offset_min: number; intensity_mmph: number; prob_pct: number }[];
  onset_in_min: number | null;
  in_progress: boolean;
  peak_intensity_mmph: number;
  peak_in_min: number;
  band: 'no_rain' | 'light' | 'moderate' | 'heavy' | string;
  echo_top_km: number;
  cell_movement: string;
}

export interface VoiceBulletin {
  language: string;
  language_native: string;
  speech_locale: string;
  bhashini_code: string;
  engine: string;
  lines: string[];
  text: string;
  chars: number;
  audio_base64: string | null;
  pipeline: Record<string, unknown>;
}

export interface HomePayload {
  location: LocationBlock;
  issued_at: string;
  observation: Observation;
  uv: { band: string; colour: string; advice: string };
  air_quality: AirQuality;
  hourly: HourPoint[];
  daily: DayPoint[];
  alerts: CapAlert[];
  layout: Layout;
  persona_data: any;
  voice: VoiceBulletin;
  meta: {
    source: string;
    mode: string;
    cache: string;
    ttl_seconds: number;
    etag?: string;
    uncompressed_bytes?: number;
  };
}

export interface DistrictOption {
  id: string;
  district: string;
  state: string;
  lat: number;
  lon: number;
  terrain: string;
  agro_zone: string;
}

export interface SyncReport {
  server_time: string;
  etags: Record<string, string>;
  unchanged: string[];
  changed_blocks: string[];
  transfer: {
    full_uncompressed_bytes: number;
    full_gzip_bytes: number;
    delta_uncompressed_bytes: number;
    delta_gzip_bytes: number;
    saving_pct: number;
  };
}
