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
        PostgrestVersion: '14.17'
    }
    public: {
        Tables: {
            app_status: {
                Row: {
                    error_message: string | null
                    id: number
                    last_update: string | null
                    status: string | null
                }
                Insert: {
                    error_message?: string | null
                    id: number
                    last_update?: string | null
                    status?: string | null
                }
                Update: {
                    error_message?: string | null
                    id?: number
                    last_update?: string | null
                    status?: string | null
                }
                Relationships: []
            }
            app_users: {
                Row: {
                    created_at: string
                    email: string
                    id: string
                    name: string | null
                    picture: string | null
                    updated_at: string
                }
                Insert: {
                    created_at?: string
                    email: string
                    id?: string
                    name?: string | null
                    picture?: string | null
                    updated_at?: string
                }
                Update: {
                    created_at?: string
                    email?: string
                    id?: string
                    name?: string | null
                    picture?: string | null
                    updated_at?: string
                }
                Relationships: []
            }
            favorite_locations: {
                Row: {
                    address: string | null
                    code: string | null
                    created_at: string | null
                    icon: string | null
                    id: string
                    is_home: boolean | null
                    label: string
                    latitude: number
                    longitude: number
                    mode: string | null
                    place_id: string
                    place_type: string
                    user_id: string
                }
                Insert: {
                    address?: string | null
                    code?: string | null
                    created_at?: string | null
                    icon?: string | null
                    id?: string
                    is_home?: boolean | null
                    label: string
                    latitude: number
                    longitude: number
                    mode?: string | null
                    place_id: string
                    place_type: string
                    user_id: string
                }
                Update: {
                    address?: string | null
                    code?: string | null
                    created_at?: string | null
                    icon?: string | null
                    id?: string
                    is_home?: boolean | null
                    label?: string
                    latitude?: number
                    longitude?: number
                    mode?: string | null
                    place_id?: string
                    place_type?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'favorite_locations_user_id_fkey'
                        columns: ['user_id']
                        isOneToOne: false
                        referencedRelation: 'app_users'
                        referencedColumns: ['id']
                    },
                ]
            }
            gtfs_calendar: {
                Row: {
                    end_date: string | null
                    friday: boolean | null
                    monday: boolean | null
                    saturday: boolean | null
                    service_id: string
                    start_date: string | null
                    sunday: boolean | null
                    thursday: boolean | null
                    tuesday: boolean | null
                    wednesday: boolean | null
                }
                Insert: {
                    end_date?: string | null
                    friday?: boolean | null
                    monday?: boolean | null
                    saturday?: boolean | null
                    service_id: string
                    start_date?: string | null
                    sunday?: boolean | null
                    thursday?: boolean | null
                    tuesday?: boolean | null
                    wednesday?: boolean | null
                }
                Update: {
                    end_date?: string | null
                    friday?: boolean | null
                    monday?: boolean | null
                    saturday?: boolean | null
                    service_id?: string
                    start_date?: string | null
                    sunday?: boolean | null
                    thursday?: boolean | null
                    tuesday?: boolean | null
                    wednesday?: boolean | null
                }
                Relationships: []
            }
            gtfs_calendar_dates: {
                Row: {
                    date: string | null
                    exception_type: number | null
                    service_id: string | null
                }
                Insert: {
                    date?: string | null
                    exception_type?: number | null
                    service_id?: string | null
                }
                Update: {
                    date?: string | null
                    exception_type?: number | null
                    service_id?: string | null
                }
                Relationships: []
            }
            gtfs_imports: {
                Row: {
                    downloaded_at: string
                    error_message: string | null
                    feed_version: string | null
                    file_hash: string
                    id: string
                    row_counts: Json | null
                    status: string
                }
                Insert: {
                    downloaded_at?: string
                    error_message?: string | null
                    feed_version?: string | null
                    file_hash: string
                    id?: string
                    row_counts?: Json | null
                    status?: string
                }
                Update: {
                    downloaded_at?: string
                    error_message?: string | null
                    feed_version?: string | null
                    file_hash?: string
                    id?: string
                    row_counts?: Json | null
                    status?: string
                }
                Relationships: []
            }
            gtfs_routes: {
                Row: {
                    agency_id: string | null
                    route_color: string | null
                    route_id: string
                    route_long_name: string | null
                    route_short_name: string | null
                    route_type: number | null
                }
                Insert: {
                    agency_id?: string | null
                    route_color?: string | null
                    route_id: string
                    route_long_name?: string | null
                    route_short_name?: string | null
                    route_type?: number | null
                }
                Update: {
                    agency_id?: string | null
                    route_color?: string | null
                    route_id?: string
                    route_long_name?: string | null
                    route_short_name?: string | null
                    route_type?: number | null
                }
                Relationships: []
            }
            gtfs_shapes: {
                Row: {
                    shape_id: string | null
                    shape_pt_lat: number | null
                    shape_pt_lon: number | null
                    shape_pt_sequence: number | null
                }
                Insert: {
                    shape_id?: string | null
                    shape_pt_lat?: number | null
                    shape_pt_lon?: number | null
                    shape_pt_sequence?: number | null
                }
                Update: {
                    shape_id?: string | null
                    shape_pt_lat?: number | null
                    shape_pt_lon?: number | null
                    shape_pt_sequence?: number | null
                }
                Relationships: []
            }
            gtfs_staging_calendar: {
                Row: {
                    end_date: string | null
                    friday: boolean | null
                    monday: boolean | null
                    saturday: boolean | null
                    service_id: string
                    start_date: string | null
                    sunday: boolean | null
                    thursday: boolean | null
                    tuesday: boolean | null
                    wednesday: boolean | null
                }
                Insert: {
                    end_date?: string | null
                    friday?: boolean | null
                    monday?: boolean | null
                    saturday?: boolean | null
                    service_id: string
                    start_date?: string | null
                    sunday?: boolean | null
                    thursday?: boolean | null
                    tuesday?: boolean | null
                    wednesday?: boolean | null
                }
                Update: {
                    end_date?: string | null
                    friday?: boolean | null
                    monday?: boolean | null
                    saturday?: boolean | null
                    service_id?: string
                    start_date?: string | null
                    sunday?: boolean | null
                    thursday?: boolean | null
                    tuesday?: boolean | null
                    wednesday?: boolean | null
                }
                Relationships: []
            }
            gtfs_staging_calendar_dates: {
                Row: {
                    date: string | null
                    exception_type: number | null
                    service_id: string | null
                }
                Insert: {
                    date?: string | null
                    exception_type?: number | null
                    service_id?: string | null
                }
                Update: {
                    date?: string | null
                    exception_type?: number | null
                    service_id?: string | null
                }
                Relationships: []
            }
            gtfs_staging_routes: {
                Row: {
                    agency_id: string | null
                    route_color: string | null
                    route_id: string
                    route_long_name: string | null
                    route_short_name: string | null
                    route_type: number | null
                }
                Insert: {
                    agency_id?: string | null
                    route_color?: string | null
                    route_id: string
                    route_long_name?: string | null
                    route_short_name?: string | null
                    route_type?: number | null
                }
                Update: {
                    agency_id?: string | null
                    route_color?: string | null
                    route_id?: string
                    route_long_name?: string | null
                    route_short_name?: string | null
                    route_type?: number | null
                }
                Relationships: []
            }
            gtfs_staging_shapes: {
                Row: {
                    shape_id: string | null
                    shape_pt_lat: number | null
                    shape_pt_lon: number | null
                    shape_pt_sequence: number | null
                }
                Insert: {
                    shape_id?: string | null
                    shape_pt_lat?: number | null
                    shape_pt_lon?: number | null
                    shape_pt_sequence?: number | null
                }
                Update: {
                    shape_id?: string | null
                    shape_pt_lat?: number | null
                    shape_pt_lon?: number | null
                    shape_pt_sequence?: number | null
                }
                Relationships: []
            }
            gtfs_staging_stop_times: {
                Row: {
                    arrival_time: string | null
                    departure_time: string | null
                    stop_id: string | null
                    stop_sequence: number | null
                    trip_id: string | null
                }
                Insert: {
                    arrival_time?: string | null
                    departure_time?: string | null
                    stop_id?: string | null
                    stop_sequence?: number | null
                    trip_id?: string | null
                }
                Update: {
                    arrival_time?: string | null
                    departure_time?: string | null
                    stop_id?: string | null
                    stop_sequence?: number | null
                    trip_id?: string | null
                }
                Relationships: []
            }
            gtfs_staging_stops: {
                Row: {
                    location_type: number | null
                    parent_station: string | null
                    route_type: number | null
                    stop_code: string | null
                    stop_id: string
                    stop_lat: number | null
                    stop_lon: number | null
                    stop_name: string | null
                }
                Insert: {
                    location_type?: number | null
                    parent_station?: string | null
                    route_type?: number | null
                    stop_code?: string | null
                    stop_id: string
                    stop_lat?: number | null
                    stop_lon?: number | null
                    stop_name?: string | null
                }
                Update: {
                    location_type?: number | null
                    parent_station?: string | null
                    route_type?: number | null
                    stop_code?: string | null
                    stop_id?: string
                    stop_lat?: number | null
                    stop_lon?: number | null
                    stop_name?: string | null
                }
                Relationships: []
            }
            gtfs_staging_trips: {
                Row: {
                    block_id: string | null
                    direction_id: number | null
                    route_id: string | null
                    service_id: string | null
                    shape_id: string | null
                    trip_headsign: string | null
                    trip_id: string
                }
                Insert: {
                    block_id?: string | null
                    direction_id?: number | null
                    route_id?: string | null
                    service_id?: string | null
                    shape_id?: string | null
                    trip_headsign?: string | null
                    trip_id: string
                }
                Update: {
                    block_id?: string | null
                    direction_id?: number | null
                    route_id?: string | null
                    service_id?: string | null
                    shape_id?: string | null
                    trip_headsign?: string | null
                    trip_id?: string
                }
                Relationships: []
            }
            gtfs_stop_times: {
                Row: {
                    arrival_time: string | null
                    departure_time: string | null
                    stop_id: string | null
                    stop_sequence: number | null
                    trip_id: string | null
                }
                Insert: {
                    arrival_time?: string | null
                    departure_time?: string | null
                    stop_id?: string | null
                    stop_sequence?: number | null
                    trip_id?: string | null
                }
                Update: {
                    arrival_time?: string | null
                    departure_time?: string | null
                    stop_id?: string | null
                    stop_sequence?: number | null
                    trip_id?: string | null
                }
                Relationships: []
            }
            gtfs_stops: {
                Row: {
                    location_type: number | null
                    parent_station: string | null
                    route_type: number | null
                    stop_code: string | null
                    stop_id: string
                    stop_lat: number | null
                    stop_lon: number | null
                    stop_name: string | null
                }
                Insert: {
                    location_type?: number | null
                    parent_station?: string | null
                    route_type?: number | null
                    stop_code?: string | null
                    stop_id: string
                    stop_lat?: number | null
                    stop_lon?: number | null
                    stop_name?: string | null
                }
                Update: {
                    location_type?: number | null
                    parent_station?: string | null
                    route_type?: number | null
                    stop_code?: string | null
                    stop_id?: string
                    stop_lat?: number | null
                    stop_lon?: number | null
                    stop_name?: string | null
                }
                Relationships: []
            }
            gtfs_trips: {
                Row: {
                    block_id: string | null
                    direction_id: number | null
                    route_id: string | null
                    service_id: string | null
                    shape_id: string | null
                    trip_headsign: string | null
                    trip_id: string
                }
                Insert: {
                    block_id?: string | null
                    direction_id?: number | null
                    route_id?: string | null
                    service_id?: string | null
                    shape_id?: string | null
                    trip_headsign?: string | null
                    trip_id: string
                }
                Update: {
                    block_id?: string | null
                    direction_id?: number | null
                    route_id?: string | null
                    service_id?: string | null
                    shape_id?: string | null
                    trip_headsign?: string | null
                    trip_id?: string
                }
                Relationships: []
            }
            gtfs_update_status: {
                Row: {
                    completed_at: string | null
                    error_message: string | null
                    id: number
                    last_update: string | null
                    next_scheduled: string | null
                    started_at: string | null
                    status: string
                    updated_at: string
                }
                Insert: {
                    completed_at?: string | null
                    error_message?: string | null
                    id?: number
                    last_update?: string | null
                    next_scheduled?: string | null
                    started_at?: string | null
                    status?: string
                    updated_at?: string
                }
                Update: {
                    completed_at?: string | null
                    error_message?: string | null
                    id?: number
                    last_update?: string | null
                    next_scheduled?: string | null
                    started_at?: string | null
                    status?: string
                    updated_at?: string
                }
                Relationships: []
            }
            profiles: {
                Row: {
                    created_at: string | null
                    emoji_avatar: string | null
                    id: string
                }
                Insert: {
                    created_at?: string | null
                    emoji_avatar?: string | null
                    id: string
                }
                Update: {
                    created_at?: string | null
                    emoji_avatar?: string | null
                    id?: string
                }
                Relationships: []
            }
            recent_places: {
                Row: {
                    code: string | null
                    label: string
                    latitude: number
                    longitude: number
                    mode: string | null
                    place_id: string
                    place_type: string
                    user_id: string
                    visited_at: string
                }
                Insert: {
                    code?: string | null
                    label: string
                    latitude: number
                    longitude: number
                    mode?: string | null
                    place_id: string
                    place_type: string
                    user_id: string
                    visited_at?: string
                }
                Update: {
                    code?: string | null
                    label?: string
                    latitude?: number
                    longitude?: number
                    mode?: string | null
                    place_id?: string
                    place_type?: string
                    user_id?: string
                    visited_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'recent_places_user_id_fkey'
                        columns: ['user_id']
                        isOneToOne: false
                        referencedRelation: 'app_users'
                        referencedColumns: ['id']
                    },
                ]
            }
            rt_arrivals: {
                Row: {
                    delay_seconds: number | null
                    id: number
                    predicted_arrival: string | null
                    recorded_at: string | null
                    route_short_name: string | null
                    stop_id: string | null
                    trip_id: string | null
                }
                Insert: {
                    delay_seconds?: number | null
                    id?: never
                    predicted_arrival?: string | null
                    recorded_at?: string | null
                    route_short_name?: string | null
                    stop_id?: string | null
                    trip_id?: string | null
                }
                Update: {
                    delay_seconds?: number | null
                    id?: never
                    predicted_arrival?: string | null
                    recorded_at?: string | null
                    route_short_name?: string | null
                    stop_id?: string | null
                    trip_id?: string | null
                }
                Relationships: []
            }
            saved_journeys: {
                Row: {
                    created_at: string
                    id: string
                    journey: Json
                    last_viewed_at: string
                }
                Insert: {
                    created_at?: string
                    id: string
                    journey: Json
                    last_viewed_at?: string
                }
                Update: {
                    created_at?: string
                    id?: string
                    journey?: Json
                    last_viewed_at?: string
                }
                Relationships: []
            }
            service_alerts: {
                Row: {
                    active_period_end: string | null
                    active_period_start: string | null
                    description_text: string | null
                    effect: string | null
                    header_text: string | null
                    id: string
                    route_id: string | null
                    updated_at: string | null
                }
                Insert: {
                    active_period_end?: string | null
                    active_period_start?: string | null
                    description_text?: string | null
                    effect?: string | null
                    header_text?: string | null
                    id: string
                    route_id?: string | null
                    updated_at?: string | null
                }
                Update: {
                    active_period_end?: string | null
                    active_period_start?: string | null
                    description_text?: string | null
                    effect?: string | null
                    header_text?: string | null
                    id?: string
                    route_id?: string | null
                    updated_at?: string | null
                }
                Relationships: []
            }
            trip_history: {
                Row: {
                    created_at: string | null
                    day_of_week: number
                    dest_latitude: number | null
                    dest_longitude: number | null
                    destination_name: string
                    destination_place_id: string
                    hour: number
                    id: string
                    last_visited_at: string
                    user_id: string
                    visit_count: number
                }
                Insert: {
                    created_at?: string | null
                    day_of_week: number
                    dest_latitude?: number | null
                    dest_longitude?: number | null
                    destination_name: string
                    destination_place_id: string
                    hour: number
                    id?: string
                    last_visited_at?: string
                    user_id: string
                    visit_count?: number
                }
                Update: {
                    created_at?: string | null
                    day_of_week?: number
                    dest_latitude?: number | null
                    dest_longitude?: number | null
                    destination_name?: string
                    destination_place_id?: string
                    hour?: number
                    id?: string
                    last_visited_at?: string
                    user_id?: string
                    visit_count?: number
                }
                Relationships: []
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            get_scheduled_calls: {
                Args: {
                    p_lower_epoch: number
                    p_midnight_epoch: number
                    p_service_ids_today: string[]
                    p_service_ids_yest: string[]
                    p_stop_id: string
                    p_window_end_epoch: number
                }
                Returns: {
                    arrival_epoch: number
                    stop_sequence: number
                    trip_id: string
                }[]
            }
            swap_gtfs_from_staging: { Args: never; Returns: undefined }
            truncate_gtfs_staging: { Args: never; Returns: undefined }
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
    DefaultSchemaTableNameOrOptions extends
        | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends (DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
              DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
        : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
          DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
          Row: infer R
      }
        ? R
        : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
            DefaultSchema['Views'])
      ? (DefaultSchema['Tables'] &
            DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
            Row: infer R
        }
          ? R
          : never
      : never

export type TablesInsert<
    DefaultSchemaTableNameOrOptions extends
        | keyof DefaultSchema['Tables']
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends (DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
        : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
          Insert: infer I
      }
        ? I
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
      ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
            Insert: infer I
        }
          ? I
          : never
      : never

export type TablesUpdate<
    DefaultSchemaTableNameOrOptions extends
        | keyof DefaultSchema['Tables']
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends (DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
        : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
          Update: infer U
      }
        ? U
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
      ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
            Update: infer U
        }
          ? U
          : never
      : never

export type Enums<
    DefaultSchemaEnumNameOrOptions extends
        | keyof DefaultSchema['Enums']
        | { schema: keyof DatabaseWithoutInternals },
    EnumName extends (DefaultSchemaEnumNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
        : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
      ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
      : never

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
        | keyof DefaultSchema['CompositeTypes']
        | { schema: keyof DatabaseWithoutInternals },
    CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
        : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
      ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
      : never

export const Constants = {
    public: {
        Enums: {},
    },
} as const
