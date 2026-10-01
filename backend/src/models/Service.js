import supabase from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

const TABLE = 'services';

export const DEFAULT_SERVICES = [
  { category: 'Waxing (Rica)', name: 'Full Body Wax - Rica', price: 2500 },
  { category: 'Waxing (Rica)', name: 'Full Arms Wax - Rica', price: 400 },
  { category: 'Waxing (Rica)', name: 'Half Arms Wax - Rica', price: 250 },
  { category: 'Waxing (Rica)', name: 'Half Legs Wax - Rica', price: 400 },
  { category: 'Waxing (Rica)', name: 'Full Legs Wax - Rica', price: 600 },
  { category: 'Waxing (Rica)', name: 'Underarms Wax - Rica', price: 150 },
  { category: 'Waxing (Honey)', name: 'Full Body Wax - Honey', price: 2000 },
  { category: 'Waxing (Honey)', name: 'Full Legs Wax - Honey', price: 500 },
  { category: 'Waxing (Honey)', name: 'Underarms Wax - Honey', price: 100 },
  { category: 'Threading', name: 'Eyebrow Threading', price: 50 },
  { category: 'Threading', name: 'Upper Lips Threading', price: 30 },
  { category: 'Threading', name: 'Both Side Locks Threading', price: 100 },
  { category: 'Haircuts & Grooming', name: "Men's Haircut", price: 300 },
  { category: 'Haircuts & Grooming', name: 'Female Haircut', price: 700 },
  { category: 'Haircuts & Grooming', name: 'Shaving', price: 100 },
  { category: 'Haircuts & Grooming', name: 'Beard with Colour', price: 800 },
  { category: 'Facial, Clean Up & D-Tan', name: 'O3+ Clean Up', price: 1000 },
  { category: 'Facial, Clean Up & D-Tan', name: 'Face Bleach', price: 350 },
  { category: 'Facial, Clean Up & D-Tan', name: 'O3+ D-Tan', price: 700 },
  { category: 'Manicure & Pedicure', name: 'Manicure - Delux', price: 500 },
  { category: 'Manicure & Pedicure', name: 'Pedicure - Delux', price: 500 },
  { category: 'Manicure & Pedicure', name: 'Foot D-Tan', price: 500 },
  { category: 'Hair Spa', name: 'Hair Spa (Men)', price: 700 },
  { category: 'Hair Spa', name: 'Hair Spa (Women)', price: 1000 },
  { category: 'Massage', name: 'Head Massage (30 Min)', price: 500 },
  { category: 'Massage', name: 'Full Body Massage (Oil/Cream)', price: 2000 },
];

let _memoryStore = null;
const getMemoryStore = (tenantId) => {
  if (!_memoryStore) {
    _memoryStore = {};
  }
  if (!_memoryStore[tenantId]) {
    _memoryStore[tenantId] = DEFAULT_SERVICES.map((s, i) => ({
      id: `mem-${Date.now()}-${i}`,
      tenant_id: tenantId,
      category: s.category,
      name: s.name,
      price: s.price,
      sort_order: i,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    console.warn(`[Services] Using in-memory fallback for tenant ${tenantId} (${_memoryStore[tenantId].length} default services loaded). Changes will sync to Supabase when it's reachable.`);
  }
  return _memoryStore[tenantId];
};

let _supabaseTried = false;
let _supabaseUnreachable = false;

const isSupabaseDown = async () => {
  if (_supabaseTried && _supabaseUnreachable) return true;
  try {
    const { error } = await supabase.from(TABLE).select('id').limit(1).maybeSingle();
    _supabaseTried = true;
    if (error && (error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND') || error.message?.includes('network') || error.message?.includes('Failed to fetch'))) {
      _supabaseUnreachable = true;
      return true;
    }
    _supabaseUnreachable = false;
    return false;
  } catch (err) {
    const msg = err?.message || '';
    if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('network') || msg.includes('Failed to fetch')) {
      _supabaseTried = true;
      _supabaseUnreachable = true;
      return true;
    }
    return false;
  }
};

const resetSupabaseCache = () => { _supabaseTried = false; _supabaseUnreachable = false; };

export const ServiceModel = {
  async findAll(tenantId) {
    if (await isSupabaseDown()) {
      const store = getMemoryStore(tenantId);
      const items = store
        .filter((s) => s.is_active !== false)
        .sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.sort_order || 0) - (b.sort_order || 0) || (a.name || '').localeCompare(b.name || ''));
      return items;
    }
    resetSupabaseCache();
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('category')
      .order('sort_order')
      .order('name');
    if (error) {
      console.warn('[Services] Supabase findAll failed, falling back to memory:', error.message);
      const store = getMemoryStore(tenantId);
      return store.filter((s) => s.is_active !== false);
    }
    if (data && data.length === 0) {
      try { await this.seedDefaults(tenantId); const refetch = await supabase.from(TABLE).select('*').eq('tenant_id', tenantId).eq('is_active', true); return refetch.data || []; }
      catch (_e) { const store = getMemoryStore(tenantId); return store.filter((s) => s.is_active !== false); }
    }
    return data || [];
  },

  async findById(id, tenantId) {
    if (await isSupabaseDown()) {
      const store = getMemoryStore(tenantId);
      const item = store.find((s) => s.id === id);
      if (!item) throw new AppError('Service not found', 404);
      return item;
    }
    resetSupabaseCache();
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).eq('tenant_id', tenantId).single();
    if (error) throw new AppError('Service not found', 404);
    return data;
  },

  async create(tenantId, { category, name, price, sortOrder }) {
    const payload = {
      tenant_id: tenantId,
      category: (category || '').trim(),
      name: (name || '').trim(),
      price: Number(price) || 0,
      sort_order: sortOrder ?? 0,
      is_active: true,
    };
    if (await isSupabaseDown()) {
      const store = getMemoryStore(tenantId);
      const newItem = {
        ...payload,
        id: `mem-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.push(newItem);
      return newItem;
    }
    resetSupabaseCache();
    const { data, error } = await supabase.from(TABLE).insert(payload).select().single();
    if (error) {
      console.warn('[Services] Supabase create failed, falling back to memory:', error.message);
      const store = getMemoryStore(tenantId);
      const newItem = {
        ...payload,
        id: `mem-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.push(newItem);
      return newItem;
    }
    return data;
  },

  async update(id, tenantId, updates) {
    const cleanUpdates = {
      ...updates,
      price: updates.price !== undefined ? Number(updates.price) : undefined,
      updated_at: new Date().toISOString(),
    };
    if (await isSupabaseDown()) {
      const store = getMemoryStore(tenantId);
      const idx = store.findIndex((s) => s.id === id);
      if (idx === -1) throw new AppError('Service not found', 404);
      store[idx] = { ...store[idx], ...cleanUpdates };
      return store[idx];
    }
    resetSupabaseCache();
    const { data, error } = await supabase
      .from(TABLE)
      .update(cleanUpdates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) {
      console.warn('[Services] Supabase update failed, falling back to memory:', error.message);
      const store = getMemoryStore(tenantId);
      const idx = store.findIndex((s) => s.id === id);
      if (idx === -1) throw new AppError('Service not found', 404);
      store[idx] = { ...store[idx], ...cleanUpdates };
      return store[idx];
    }
    return data;
  },

  async delete(id, tenantId) {
    if (await isSupabaseDown()) {
      const store = getMemoryStore(tenantId);
      const idx = store.findIndex((s) => s.id === id);
      if (idx === -1) throw new AppError('Service not found', 404);
      store[idx].is_active = false;
      store[idx].updated_at = new Date().toISOString();
      return;
    }
    resetSupabaseCache();
    const { error } = await supabase
      .from(TABLE)
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) {
      console.warn('[Services] Supabase delete failed, falling back to memory:', error.message);
      const store = getMemoryStore(tenantId);
      const idx = store.findIndex((s) => s.id === id);
      if (idx === -1) throw new AppError('Service not found', 404);
      store[idx].is_active = false;
      store[idx].updated_at = new Date().toISOString();
    }
  },

  async seedDefaults(tenantId) {
    if (await isSupabaseDown()) {
      getMemoryStore(tenantId);
      return;
    }
    resetSupabaseCache();
    const rows = DEFAULT_SERVICES.map((s, i) => ({
      tenant_id: tenantId,
      category: s.category,
      name: s.name,
      price: s.price,
      sort_order: i,
    }));
    const { error } = await supabase.from(TABLE).insert(rows);
    if (error) {
      console.warn('[Services] Seed failed:', error.message);
    }
  },

  async getCategories(tenantId) {
    const services = await this.findAll(tenantId);
    const cats = {};
    services.forEach((s) => {
      if (!cats[s.category]) cats[s.category] = [];
      cats[s.category].push(s);
    });
    return cats;
  },
};
