# Design Document — Customer Report

## Overview

The Customer Report feature adds a second tab to the existing `Customers.jsx` page. The new tab renders a filterable, paginated table of customer visit history, where each row corresponds to one invoice. The feature also swaps the Email field on the Invoice form for DOB and Anniversary fields, and exposes a new backend endpoint `GET /invoices/report` that joins the `invoices` and `customers` tables via Supabase.

No new sidebar navigation entry is added. All changes are additive — no existing API contracts are broken.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Customers.jsx                                          │
│  ┌──────────────┐  ┌──────────────────────────────────┐ │
│  │ Customers tab│  │ Report tab                        │ │
│  │ (unchanged)  │  │  ┌─────────────┐  ┌───────────┐  │ │
│  │              │  │  │ DateFilter  │  │ Report-   │  │ │
│  │              │  │  │ component   │  │ Table     │  │ │
│  └──────────────┘  └──│─────────────│──│───────────│──┘ │
│                       │             │  │           │    │
│                       └─────────────┘  └─────┬─────┘    │
└─────────────────────────────────────────────│───────────┘
                                              │ invoiceAPI.getReport(params)
                                              ▼
┌─────────────────────────────────────────────────────────┐
│  Express — GET /invoices/report                         │
│  invoiceController.getInvoiceReport()                   │
│        │                                                │
│        ▼                                                │
│  InvoiceModel.getReport({ filter, start, end })         │
│        │  Supabase query:                               │
│        │  invoices JOIN customers ON customer_id        │
│        │  .order('created_at', { ascending: false })    │
│        ▼                                                │
│  Supabase PostgreSQL                                    │
└─────────────────────────────────────────────────────────┘
```

---

## Components

### 1. `Customers.jsx` — Tab Shell

The existing component gains a tab state variable and renders either the existing list view or the new report view.

```jsx
// New state
const [activeTab, setActiveTab] = useState('customers'); // 'customers' | 'report'

// Tab bar (added above the existing card filter)
<div className="flex gap-2 mb-4 border-b border-dark-700">
  <button
    onClick={() => setActiveTab('customers')}
    className={activeTab === 'customers' ? 'tab-active' : 'tab'}
  >
    Customers
  </button>
  <button
    onClick={() => setActiveTab('report')}
    className={activeTab === 'report' ? 'tab-active' : 'tab'}
  >
    Report
  </button>
</div>

{activeTab === 'customers' && <CustomerListView ... />}
{activeTab === 'report'    && <CustomerReportView />}
```

The existing list markup is extracted into a local section guarded by `activeTab === 'customers'`; nothing else changes in the list view.

### 2. `CustomerReportView` — inline component inside `Customers.jsx`

Manages its own local state:

| State variable | Type | Default | Purpose |
|---|---|---|---|
| `filter` | `'today' \| 'month' \| 'all' \| 'custom'` | `'month'` | Selected date filter |
| `startDate` | `string` (ISO date) | `''` | Custom range start |
| `endDate` | `string` (ISO date) | `''` | Custom range end |
| `rows` | `ReportRow[]` | `[]` | Fetched report data |
| `loading` | `boolean` | `false` | Loading indicator |
| `validationError` | `string \| null` | `null` | Custom range validation |

**Data fetching** is triggered by `useEffect` on changes to `filter`, `startDate`, `endDate`. The effect calls `invoiceAPI.getReport({ filter, start: startDate, end: endDate })` and updates `rows`.

**Validation** is applied before the request: if `filter === 'custom'` and either `startDate` or `endDate` is empty, a validation message is displayed and no request is sent.

### 3. `DateFilter` — inline sub-component

Renders four buttons (Today / This Month / All / Custom). When Custom is active, renders two `<input type="date">` controls for start and end dates.

### 4. `ReportTable` — inline sub-component

Renders a `<table>` with columns: S.No, Customer Name, Phone, Birthday, Anniversary, Last Service, Amount, Visit Date.

- **S.No**: sequential index within the current result set (1-based, `index + 1`)
- **Last Service**: `row.items.map(i => i.description).join(', ')`
- **Amount**: `₹${Number(row.total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
- **Visit Date**: `new Date(row.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })`
- **Birthday / Anniversary**: `row.birthday ?? '—'` / `row.anniversary ?? '—'`

---

## Data Models

### `ReportRow` (frontend type)

```js
{
  invoice_number: number,
  customer_name: string,
  customer_phone: string,
  birthday: string | null,       // 'YYYY-MM-DD' or null
  anniversary: string | null,    // 'YYYY-MM-DD' or null
  items: Array<{ description: string, quantity: number, price: number }>,
  total: number,
  created_at: string,            // ISO timestamp
}
```

### Backend Supabase query (inside `InvoiceModel.getReport`)

Supabase supports joining related tables via foreign key relationships. The `invoices` table has a `customer_id` column referencing `customers.id`. The join is expressed as:

```js
supabase
  .from('invoices')
  .select(`
    invoice_number,
    customer_name,
    customer_phone,
    items,
    total,
    created_at,
    customers!customer_id (
      birthday,
      anniversary
    )
  `)
  .order('created_at', { ascending: false })
```

The response flattens the nested `customers` object:

```js
// Raw Supabase row shape
{
  invoice_number: 42,
  customer_name: "Jane Doe",
  customer_phone: "9876543210",
  items: [...],
  total: 1200,
  created_at: "2025-08-01T10:30:00Z",
  customers: { birthday: "1990-05-15", anniversary: null }
}

// Flattened in getReport before returning
{
  invoice_number: 42,
  customer_name: "Jane Doe",
  customer_phone: "9876543210",
  items: [...],
  total: 1200,
  created_at: "2025-08-01T10:30:00Z",
  birthday: "1990-05-15",
  anniversary: null
}
```

---

## Interfaces

### `invoiceAPI.getReport(params)` — `frontend/src/services/api.js`

```js
export const invoiceAPI = {
  // ... existing methods ...
  getReport: (params) => api.get('/invoices/report', { params }),
};
```

`params` shape:

```js
{
  filter: 'today' | 'month' | 'all' | 'custom',
  start?: string,   // ISO date, only when filter === 'custom'
  end?: string,     // ISO date, only when filter === 'custom'
}
```

### `GET /invoices/report` — backend route

Added to `invoiceRoutes.js`:

```js
router.get('/report', invoiceController.getInvoiceReport);
```

This route must be declared **before** `router.get('/:id', ...)` to prevent `:id` from capturing the literal string `"report"`.

### `invoiceController.getInvoiceReport`

```js
export const getInvoiceReport = asyncHandler(async (req, res) => {
  const { filter = 'month', start, end } = req.query;

  const VALID_FILTERS = ['today', 'month', 'all', 'custom'];
  if (!VALID_FILTERS.includes(filter)) {
    throw new AppError(`Invalid filter "${filter}". Must be one of: ${VALID_FILTERS.join(', ')}`, 400);
  }

  if (filter === 'custom' && (!start || !end)) {
    throw new AppError('start and end are required when filter=custom', 400);
  }

  const rows = await InvoiceModel.getReport({ filter, start, end });
  res.json({ success: true, data: rows });
});
```

### `InvoiceModel.getReport({ filter, start, end })`

```js
async getReport({ filter = 'month', start, end } = {}) {
  let query = supabase
    .from('invoices')
    .select(`
      invoice_number,
      customer_name,
      customer_phone,
      items,
      total,
      created_at,
      customers!customer_id (
        birthday,
        anniversary
      )
    `)
    .order('created_at', { ascending: false });

  const now = new Date();

  if (filter === 'today') {
    const todayStr = now.toISOString().split('T')[0]; // 'YYYY-MM-DD'
    query = query
      .gte('created_at', `${todayStr}T00:00:00.000Z`)
      .lte('created_at', `${todayStr}T23:59:59.999Z`);
  } else if (filter === 'month') {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    query = query
      .gte('created_at', `${year}-${month}-01T00:00:00.000Z`)
      .lte('created_at', `${year}-${month}-31T23:59:59.999Z`);
  } else if (filter === 'custom') {
    query = query
      .gte('created_at', `${start}T00:00:00.000Z`)
      .lte('created_at', `${end}T23:59:59.999Z`);
  }
  // filter === 'all' → no date constraint

  const { data, error } = await query;
  if (error) throw new AppError('Failed to fetch report', 500);

  // Flatten nested customers join
  return (data || []).map((row) => ({
    invoice_number: row.invoice_number,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    items: row.items || [],
    total: row.total,
    created_at: row.created_at,
    birthday: row.customers?.birthday ?? null,
    anniversary: row.customers?.anniversary ?? null,
  }));
},
```

---

## Invoice Form Changes (`Invoice.jsx`)

### `emptyCustomer` constant update

```js
// Before
const emptyCustomer = { name: '', phone: '', email: '', address: '', gender: '' };

// After
const emptyCustomer = { name: '', phone: '', birthday: '', anniversary: '', address: '', gender: '' };
```

### Customer Details section — field replacements

Remove the email `<input>` block. Add two date inputs in its place:

```jsx
{/* DOB — replaces Email */}
<div className="form-group">
  <label className="form-label">DOB</label>
  <input
    type="date"
    value={customer.birthday}
    onChange={(e) => setCustomer({ ...customer, birthday: e.target.value })}
  />
</div>

{/* Anniversary */}
<div className="form-group">
  <label className="form-label">Anniversary</label>
  <input
    type="date"
    value={customer.anniversary}
    onChange={(e) => setCustomer({ ...customer, anniversary: e.target.value })}
  />
</div>
```

Neither field carries a `required` attribute; only Name and Phone remain required.

The invoice preview panel currently shows `{customer.email && ...}` — this line is removed along with the email field.

---

## Error Handling

| Scenario | Backend behaviour | Frontend behaviour |
|---|---|---|
| `filter` is not one of the four valid values | 400 + descriptive message | `invoiceAPI.getReport` rejects; toast error shown |
| `filter=custom` without `start` or `end` | Not reached — frontend validates first | Validation message shown inline; no request sent |
| Supabase query error | 500 + generic error | Toast error shown, table shows empty state |
| Report API returns zero rows | 200 with `data: []` | Empty-state message: "No visits found for the selected period" |
| Unauthenticated request | 401 from `authenticate` middleware | Axios interceptor redirects to `/login` |

---

## File Change Summary

| File | Change type | Description |
|---|---|---|
| `frontend/src/services/api.js` | Modify | Add `getReport` to `invoiceAPI` |
| `frontend/src/pages/Customers.jsx` | Modify | Add tab state + `CustomerReportView` inline component |
| `frontend/src/pages/Invoice.jsx` | Modify | Replace email field with DOB + Anniversary; update `emptyCustomer` |
| `backend/src/controllers/invoiceController.js` | Modify | Add `getInvoiceReport` handler |
| `backend/src/models/Invoice.js` | Modify | Add `getReport` method to `InvoiceModel` |
| `backend/src/routes/invoiceRoutes.js` | Modify | Add `GET /report` route before `/:id` |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Today filter excludes out-of-day invoices

*For any* set of invoices with arbitrary `created_at` dates, applying the `filter=today` query clause should return exactly those invoices whose `created_at` date portion equals the current calendar date, and should exclude all others.

**Validates: Requirements 2.2, 4.3**

---

### Property 2: Month filter includes only current-month invoices

*For any* set of invoices with arbitrary `created_at` dates, applying the `filter=month` query clause should return exactly those invoices whose `created_at` falls within the current calendar month (year and month match), and should exclude all others.

**Validates: Requirements 2.3, 4.4**

---

### Property 3: Custom range filter is inclusive on both bounds

*For any* valid `[start, end]` date range and any set of invoices with arbitrary `created_at` dates, applying `filter=custom` should return exactly those invoices where `start <= date(created_at) <= end`. Invoices on the start date and end date boundaries must be included; invoices one day outside either boundary must be excluded.

**Validates: Requirements 2.6, 4.6**

---

### Property 4: Report rows contain all required fields with correct join data

*For any* invoice in the database that has an associated customer record, the corresponding report row returned by `GET /invoices/report` should contain `invoice_number`, `customer_name`, `customer_phone`, `items` (array), `total`, `created_at`, `birthday`, and `anniversary`, where `birthday` and `anniversary` are sourced from the `customers` table row matched by `customer_id`.

**Validates: Requirements 3.5, 4.9, 4.10**

---

### Property 5: Results are ordered by created_at descending

*For any* non-empty report result set, for every pair of adjacent rows `(rowI, rowI+1)`, `rowI.created_at >= rowI+1.created_at`. No later-dated invoice ever appears after an earlier-dated invoice.

**Validates: Requirements 4.11**

---

### Property 6: Last Service is the ordered join of item descriptions

*For any* invoice items array, the Last Service string produced by the frontend formatter should equal `items.map(i => i.description).join(', ')` — preserving the original order and using exactly `, ` as separator. An invoice with a single item should produce that item's description with no separator. An empty items array should produce an empty string.

**Validates: Requirements 3.2**

---

### Property 7: Amount is formatted with ₹ prefix

*For any* non-negative numeric `total` value, the formatted amount string displayed in the Amount column should begin with the `₹` symbol and be followed by a numeric representation of the value.

**Validates: Requirements 3.3**

---

### Property 8: Visit Date matches DD MMM YYYY format

*For any* valid ISO timestamp string in `created_at`, the Visit Date cell value should match the pattern `/^\d{2} [A-Z][a-z]{2} \d{4}$/` (e.g., `"25 Aug 2026"`).

**Validates: Requirements 3.4**

---

### Property 9: Report rows rendered equals rows returned

*For any* non-empty array of report rows returned by `invoiceAPI.getReport`, the rendered table should contain exactly that number of `<tr>` data rows, with each row's S.No equal to its 1-based position in the array.

**Validates: Requirements 3.1**

---

### Property 10: Invoice form customer payload always includes birthday and anniversary

*For any* invoice form submission — regardless of whether the DOB and Anniversary inputs are filled — the customer object sent to `invoiceAPI.saveAndSend` should always contain a `birthday` key and an `anniversary` key. When the inputs are empty, both values should be `null` (or empty string coerced to null by the backend); when filled, the values should equal the input values.

**Validates: Requirements 5.5**

---

### Property 11: getReport passes filter params as query parameters

*For any* params object `{ filter, start?, end? }` passed to `invoiceAPI.getReport`, the resulting HTTP request should be a `GET` to `/invoices/report` with those exact values serialised as URL query parameters (`?filter=...&start=...&end=...`).

**Validates: Requirements 6.2**
