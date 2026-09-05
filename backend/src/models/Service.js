import supabase from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

const TABLE = 'services';

// Default services seeded for new tenants
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

export const ServiceModel = {
  async findAll(tenantId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('category')
      .order('sort_order')
      .order('name');
    if (error) throw new AppError('Failed to fetch services', 500);
    return data || [];
  },

  async findById(id, tenantId) {
    const { data, error } = await supabase
      .from(TABLE).select('*').eq('id', id).eq('tenant_id', tenantId).single();
    if (error) throw new AppError('Service not found', 404);
    return data;
  },

  async create(tenantId, { category, name, price, sortOrder }) {
    const { data, error } = await supabase.from(TABLE).insert({
      tenant_id: tenantId,
      category: category.trim(),
      name: name.trim(),
      price: Number(price) || 0,
      sort_order: sortOrder || 0,
    }).select().single();
    if (error) throw new AppError(error.message || 'Failed to create service', 500);
    return data;
  },

  async update(id, tenantId, updates) {
    const { data, error } = await supabase
      .from(TABLE).update({
        ...updates,
        price: updates.price !== undefined ? Number(updates.price) : undefined,
      })
      .eq('id', id).eq('tenant_id', tenantId).select().single();
    if (error) throw new AppError('Failed to update service', 500);
    return data;
  },

  async delete(id, tenantId) {
    const { error } = await supabase
      .from(TABLE).update({ is_active: false }).eq('id', id).eq('tenant_id', tenantId);
    if (error) throw new AppError('Failed to delete service', 500);
  },

  async seedDefaults(tenantId) {
    const rows = DEFAULT_SERVICES.map((s, i) => ({
      tenant_id: tenantId,
      category: s.category,
      name: s.name,
      price: s.price,
      sort_order: i,
    }));
    const { error } = await supabase.from(TABLE).insert(rows);
    if (error) console.warn('[Services] Seed failed:', error.message);
  },

  async getCategories(tenantId) {
    const services = await this.findAll(tenantId);
    const cats = {};
    services.forEach(s => {
      if (!cats[s.category]) cats[s.category] = [];
      cats[s.category].push(s);
    });
    return cats;
  },
};
