import XLSX from 'xlsx';
import { CustomerModel } from '../models/Customer.js';
import { AppError } from '../middleware/errorHandler.js';

const normalizePhone = (phone) => {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
};

const normalizeGender = (gender) => {
  if (!gender) return null;
  const value = String(gender).trim().toLowerCase();
  return ['male', 'female', 'other'].includes(value) ? value : null;
};

const parseDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().split('T')[0];

  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const y = date.y;
      const m = String(date.m).padStart(2, '0');
      const d = String(date.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return null;
};

export const ExcelService = {
  async importCustomers(buffer, tenantId) {
    if (!tenantId) throw new AppError('Tenant context required', 401);
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
      throw new AppError('Excel file is empty', 400);
    }

    const customers = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = row.name || row.Name || row.NAME || '';
      const phone = normalizePhone(row.phone || row.Phone || row.PHONE || row.mobile || row.Mobile);

      if (!name || !phone) {
        errors.push(`Row ${i + 2}: Missing name or phone`);
        continue;
      }

      if (phone.length < 10) {
        errors.push(`Row ${i + 2}: Invalid phone number`);
        continue;
      }

      customers.push({
        tenant_id: tenantId,
        name: String(name).trim(),
        phone,
        email: row.email || row.Email || null,
        address: row.address || row.Address || null,
        birthday: parseDate(row.birthday || row.Birthday),
        anniversary: parseDate(row.anniversary || row.Anniversary),
        last_visit: parseDate(row.last_visit || row['Last Visit'] || row.lastVisit),
        gender: normalizeGender(row.gender || row.Gender),
        notes: row.notes || row.Notes || null,
        is_active: true,
      });
    }

    if (customers.length === 0) {
      throw new AppError(`No valid rows found. Errors: ${errors.join('; ')}`, 400);
    }

    const imported = [];
    for (const customer of customers) {
      const existing = await CustomerModel.findByPhone(customer.phone, tenantId);
      if (existing) {
        errors.push(`Phone ${customer.phone}: already exists, skipped`);
        continue;
      }
      try {
        const created = await CustomerModel.create(customer);
        imported.push(created);
      } catch (err) {
        errors.push(`Phone ${customer.phone}: ${err.message}`);
      }
    }

    if (imported.length === 0 && errors.length > 0) {
      throw new AppError(`Import failed. ${errors.slice(0, 5).join('; ')}`, 400);
    }

    return {
      imported: imported.length,
      errors,
      total: rows.length,
    };
  },

  exportCustomers(customers) {
    const data = customers.map((c) => ({
      Name: c.name,
      Phone: c.phone,
      Email: c.email || '',
      Address: c.address || '',
      Birthday: c.birthday || '',
      Anniversary: c.anniversary || '',
      'Last Visit': c.last_visit || '',
      Gender: c.gender || '',
      Notes: c.notes || '',
      Active: c.is_active ? 'Yes' : 'No',
      'Created At': c.created_at ? new Date(c.created_at).toLocaleDateString() : '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');

    worksheet['!cols'] = [
      { wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 30 }, { wch: 8 }, { wch: 15 },
    ];

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  },
};
