import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hrpwjetowibwrgzgdbzs.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhycHdqZXRvd2lid3JnemdkYnpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ4MDQ5NDYsImV4cCI6MjExMDM4MDk0Nn0.fhd2fKhLg0yIZzYjx-CSYU7Ho6N6Qok2nQ5qkaOZvxA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
  realtime: { params: { eventsPerSecond: 10 } },
});
