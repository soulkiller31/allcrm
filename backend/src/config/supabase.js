import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import config from '../config/index.js';

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  realtime: {
    transport: WebSocket,
  },
});

export default supabase;
