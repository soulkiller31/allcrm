# Implementation Plan: Customer Report

## Overview

Implement the Customer Report feature in six focused steps: add the backend `GET /invoices/report` endpoint, wire the `invoiceAPI.getReport` frontend method, update the Invoice form (swap email for DOB + Anniversary), and build the Report tab (tab shell, date filter, report table) inside `Customers.jsx`.

## Tasks

- [ ] 1. Add `getReport` method to `InvoiceModel` (backend)
  - [ ] 1.1 Implement `InvoiceModel.getReport` in `backend/src/models/Invoice.js`
    - Add the `getReport({ filter, start, end })` async method to `InvoiceModel`
    - Build the Supabase query selecting `invoice_number`, `customer_name`, `customer_phone`, `items`, `total`, `created_at`, and joining `customers!customer_id(birthday, anniversary)`
    - Apply date range filters: `today` (today's date bounds), `month` (current month bounds), `custom` (`start`/`end` bounds), `all` (no filter)
    - Flatten the nested `customers` join object so `birthday` and `anniversary` are top-level fields on each returned row
    - Order results by `created_at` descending
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.9, 4.10, 4.11_

  - [ ]* 1.2 Write unit tests for `InvoiceModel.getReport` date-range logic
    - Test that `filter=today` produces correct `.gte` / `.lte` bounds for the current date
    - Test that `filter=month` produces bounds covering the full current calendar month
    - Test that `filter=custom` passes `start` and `end` bounds through unchanged
    - Test that `filter=all` applies no date filters
    - Test that the nested `customers` object is flattened correctly in the returned rows
    - _Requirements: 4.3, 4.4, 4.5, 4.6_

- [ ] 2. Add `getInvoiceReport` controller and route (backend)
  - [ ] 2.1 Implement `getInvoiceReport` in `backend/src/controllers/invoiceController.js`
    - Export a new `getInvoiceReport` handler wrapped in `asyncHandler`
    - Read `filter`, `start`, `end` from `req.query`; default `filter` to `'month'`
    - Validate that `filter` is one of `['today', 'month', 'all', 'custom']`; throw `AppError(400)` if not
    - Validate that `start` and `end` are both present when `filter === 'custom'`; throw `AppError(400)` if missing
    - Call `InvoiceModel.getReport({ filter, start, end })` and respond with `{ success: true, data: rows }`
    - _Requirements: 4.1, 4.2, 4.7, 4.8_

  - [ ] 2.2 Register the route in `backend/src/routes/invoiceRoutes.js`
    - Add `router.get('/report', invoiceController.getInvoiceReport)` **before** the existing `router.get('/:id', ...)` line to prevent route shadowing
    - _Requirements: 4.1_

- [ ] 3. Checkpoint — backend complete
  - Ensure the Express server starts without errors and the route `GET /invoices/report` is reachable with a valid auth token. Ask the user if any questions arise.

- [ ] 4. Add `invoiceAPI.getReport` to the frontend API service
  - [ ] 4.1 Add `getReport` to `invoiceAPI` in `frontend/src/services/api.js`
    - Add `getReport: (params) => api.get('/invoices/report', { params })` to the `invoiceAPI` object
    - `params` carries `filter`, and optionally `start` and `end`
    - _Requirements: 6.1, 6.2_

- [ ] 5. Update `Invoice.jsx` — replace Email with DOB and Anniversary
  - [ ] 5.1 Update `emptyCustomer` and Customer Details fields in `frontend/src/pages/Invoice.jsx`
    - Change `emptyCustomer` from `{ name, phone, email, address, gender }` to `{ name, phone, birthday, anniversary, address, gender }`
    - In the Customer Details JSX grid, remove the `<div className="form-group">` block containing the email `<input type="email">`
    - Add a DOB date input (`type="date"`, field `customer.birthday`) and an Anniversary date input (`type="date"`, field `customer.anniversary`) in its place — both optional (no `required` attribute)
    - Remove the `{customer.email && ...}` line from the invoice preview panel
    - Confirm that `resetForm` re-applies `emptyCustomer`, so both fields clear on successful submission
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 5.2 Write property test for Invoice form customer payload
    - **Property 10: Invoice form customer payload always includes birthday and anniversary**
    - **Validates: Requirements 5.5**
    - For any combination of filled / empty DOB and Anniversary inputs, assert the `customer` object passed to `invoiceAPI.saveAndSend` always has `birthday` and `anniversary` keys; empty inputs produce `''` (coerced to `null` by the backend)

- [ ] 6. Add Report tab to `Customers.jsx`
  - [ ] 6.1 Add tab state and tab bar to `Customers.jsx`
    - Add `const [activeTab, setActiveTab] = useState('customers')` (default: `'customers'`)
    - Render a tab bar with two buttons ("Customers" and "Report") using `tab` / `tab-active` classes above the existing filter card
    - Guard the existing list markup (filter card, table, pagination) with `{activeTab === 'customers' && ...}`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ] 6.2 Implement the `DateFilter` inline sub-component inside `Customers.jsx`
    - Render four toggle buttons: "Today", "This Month", "All", "Custom"
    - When "Custom" is selected, render a start-date `<input type="date">` and an end-date `<input type="date">`
    - Default selected filter to `'month'`
    - _Requirements: 2.1, 2.5, 2.8_

  - [ ] 6.3 Implement the `ReportTable` inline sub-component inside `Customers.jsx`
    - Render a `<table>` with columns: S.No, Customer Name, Phone, Birthday, Anniversary, Last Service, Amount, Visit Date
    - S.No: `index + 1` (1-based)
    - Last Service: `row.items.map(i => i.description).join(', ')`
    - Amount: `₹${Number(row.total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    - Visit Date: `new Date(row.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })`
    - Birthday / Anniversary: `row.birthday ?? '—'` / `row.anniversary ?? '—'`
    - Show loading indicator while `loading === true`
    - Show empty-state message ("No visits found for the selected period") when `rows.length === 0` and not loading
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ] 6.4 Implement `CustomerReportView` inline component and wire data fetching
    - Manage state: `filter`, `startDate`, `endDate`, `rows`, `loading`, `validationError`
    - In `useEffect` (deps: `filter`, `startDate`, `endDate`): validate custom range, call `invoiceAPI.getReport({ filter, start: startDate, end: endDate })`, set `rows`; show toast on API error
    - If `filter === 'custom'` and either date is empty, set `validationError` and skip the API call
    - Render `<DateFilter>` and `<ReportTable>` with appropriate props
    - Display `validationError` inline below the date filter when present
    - Render `CustomerReportView` when `activeTab === 'report'`
    - _Requirements: 2.2, 2.3, 2.4, 2.6, 2.7, 2.8, 6.3_

  - [ ]* 6.5 Write property tests for frontend formatting utilities
    - **Property 6: Last Service is the ordered join of item descriptions** — Validates: Requirements 3.2
    - **Property 7: Amount is formatted with ₹ prefix** — Validates: Requirements 3.3
    - **Property 8: Visit Date matches DD MMM YYYY format** — Validates: Requirements 3.4
    - **Property 9: Report rows rendered equals rows returned** — Validates: Requirements 3.1

- [ ] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass and the Report tab renders correctly end-to-end. Ask the user if any questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The `/report` route **must** be declared before `/:id` in `invoiceRoutes.js` — failing to do so causes Express to match the literal string `"report"` as an invoice ID
- The Supabase join syntax `customers!customer_id(...)` relies on the foreign-key relationship between `invoices.customer_id` and `customers.id` already existing in the schema
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties; unit tests validate specific examples and edge cases

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "4.1", "5.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "5.2", "6.1"] },
    { "id": 2, "tasks": ["2.2", "6.2", "6.3"] },
    { "id": 3, "tasks": ["6.4"] },
    { "id": 4, "tasks": ["6.5"] }
  ]
}
```
