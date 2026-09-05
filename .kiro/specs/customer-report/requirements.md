# Requirements Document

## Introduction

The Customer Report feature adds a visit-history report to the existing Salon CRM application. A new "Report" tab is embedded inside the Customers page (no new sidebar entry). Each row of the report represents one invoice visit for a customer, showing identity details, birthday, anniversary, last service summary, and financial totals. The report is filterable by date range (today, current month, all time, or a custom date range). The feature also replaces the Email field on the Invoice form with DOB and Anniversary fields, enabling those attributes to be captured at invoice time. A new backend endpoint provides the joined invoice + customer data needed for the report.

## Glossary

- **CRM**: The existing Salon CRM web application (React + Vite frontend, Node.js + Express backend, Supabase PostgreSQL database).
- **Customers Page**: The existing `/customers` route rendered by `Customers.jsx`, which currently shows a customers list.
- **Report Tab**: A tab within the Customers Page that renders the Customer Report table.
- **Customer List Tab**: The existing tab within the Customers Page that shows the searchable/filterable customer grid.
- **Invoice Form**: The existing invoice creation form on the Invoice page (`Invoice.jsx`) where customer details and services are entered.
- **Report Row**: A single row in the Customer Report table; each row corresponds to exactly one invoice record.
- **Last Service**: A comma-separated string of all item descriptions from a single invoice, used as the "services rendered" summary in a Report Row.
- **Report API**: The new `GET /invoices/report` backend endpoint that returns paginated, filtered report rows by joining the `invoices` and `customers` tables on `customer_id`.
- **Date Filter**: A UI control allowing the user to select one of four modes — Today, This Month, All, or Custom date range — which is sent as query parameters to the Report API.
- **Custom Date Range**: A date filter mode where the user manually specifies a start date and an end date.
- **DOB**: Date of birth, replacing the Email field in the Invoice Form customer section.
- **Anniversary**: Wedding or relationship anniversary date, replacing the Email field in the Invoice Form customer section.

## Requirements

### Requirement 1 — Customer Report Tab

**User Story:** As a salon operator, I want a Report tab inside the Customers page, so that I can view customer visit history without navigating away from the Customers section.

#### Acceptance Criteria

1. THE CRM SHALL render the Customers Page with two tabs: "Customers" (the existing list) and "Report" (the new report view).
2. WHEN the user selects the "Report" tab, THE CRM SHALL display the Customer Report table and the Date Filter controls.
3. WHEN the user selects the "Customers" tab, THE CRM SHALL display the existing customer list, filters, and action buttons as before.
4. THE CRM SHALL default to the "Customers" tab on initial page load so that existing behaviour is preserved.
5. THE CRM SHALL NOT add a new sidebar navigation item for the Customer Report.

---

### Requirement 2 — Date Filter

**User Story:** As a salon operator, I want to filter the report by date, so that I can focus on visits for a specific period.

#### Acceptance Criteria

1. THE CRM SHALL provide four Date Filter options: "Today", "This Month", "All", and "Custom".
2. WHEN the user selects "Today", THE CRM SHALL fetch report rows where the invoice `created_at` date equals the current calendar date in the salon's local timezone.
3. WHEN the user selects "This Month", THE CRM SHALL fetch report rows where the invoice `created_at` date falls within the current calendar month.
4. WHEN the user selects "All", THE CRM SHALL fetch all report rows without a date constraint.
5. WHEN the user selects "Custom", THE CRM SHALL display a start-date input and an end-date input.
6. WHILE the "Custom" filter mode is active and both start date and end date are provided, THE CRM SHALL fetch report rows where the invoice `created_at` date falls within the inclusive date range [start date, end date].
7. IF the user selects "Custom" and submits without providing both a start date and an end date, THEN THE CRM SHALL display a validation message and SHALL NOT send a request to the Report API.
8. THE CRM SHALL default the Date Filter to "This Month" when the Report tab is first displayed.

---

### Requirement 3 — Report Table

**User Story:** As a salon operator, I want a tabular view of customer visits with key details per row, so that I can quickly review service history and spending.

#### Acceptance Criteria

1. THE CRM SHALL render one Report Row per invoice, where each row contains the following columns: S.No (sequential row number within the current result set), Customer Name, Phone, Birthday, Anniversary, Last Service, Amount, and Visit Date.
2. THE CRM SHALL populate the "Last Service" column with a comma-separated string of all item descriptions from the corresponding invoice, in the order the items are stored.
3. THE CRM SHALL populate the "Amount" column with the invoice `total` value formatted as a currency amount in Indian Rupees (₹).
4. THE CRM SHALL populate the "Visit Date" column with the invoice `created_at` date formatted as `DD MMM YYYY` (e.g., 25 Aug 2026).
5. THE CRM SHALL populate the "Birthday" and "Anniversary" columns from the `customers` table fields `birthday` and `anniversary`, resolved via the invoice's `customer_id`.
6. IF a customer's birthday or anniversary is null, THEN THE CRM SHALL display "—" in the respective column.
7. WHEN report data is loading, THE CRM SHALL display a loading indicator in place of the table.
8. WHEN the Report API returns zero rows for the selected filter, THE CRM SHALL display an empty-state message (e.g., "No visits found for the selected period").

---

### Requirement 4 — Report API Endpoint

**User Story:** As a backend, I need to expose a filtered, paginated report endpoint so that the frontend can retrieve joined invoice and customer data efficiently.

#### Acceptance Criteria

1. THE Report API SHALL be accessible at `GET /invoices/report` and SHALL require a valid authentication token.
2. THE Report API SHALL accept the following query parameters: `filter` (string, one of `today` | `month` | `all` | `custom`), `start` (ISO date string, required when `filter=custom`), `end` (ISO date string, required when `filter=custom`).
3. WHEN `filter=today` is received, THE Report API SHALL return only invoices whose `created_at` date equals the current server date.
4. WHEN `filter=month` is received, THE Report API SHALL return only invoices whose `created_at` date falls within the current calendar month on the server.
5. WHEN `filter=all` is received, THE Report API SHALL return all invoices without a date constraint.
6. WHEN `filter=custom` is received with valid `start` and `end` parameters, THE Report API SHALL return invoices whose `created_at` date falls within the inclusive range [start, end].
7. IF `filter=custom` is received without both `start` and `end` parameters, THEN THE Report API SHALL return a 400 status with a descriptive error message.
8. IF an unrecognised `filter` value is received, THEN THE Report API SHALL return a 400 status with a descriptive error message.
9. THE Report API SHALL join each invoice record with its corresponding customer record on `customer_id` to include the `birthday` and `anniversary` fields in each response row.
10. THE Report API SHALL return each row with at minimum the following fields: `invoice_number`, `customer_name`, `customer_phone`, `birthday`, `anniversary`, `items` (array), `total`, `created_at`.
11. THE Report API SHALL order results by `created_at` descending (most recent visit first).

---

### Requirement 5 — Invoice Form: Replace Email with DOB and Anniversary

**User Story:** As a salon operator, I want to capture a customer's date of birth and anniversary on the invoice form, so that the CRM can use those dates for personalised communications.

#### Acceptance Criteria

1. THE Invoice Form SHALL remove the existing "Email" input field from the Customer Details section.
2. THE Invoice Form SHALL add a "DOB" date input field (optional) in place of the removed Email field.
3. THE Invoice Form SHALL add an "Anniversary" date input field (optional) in the Customer Details section alongside the DOB field.
4. THE Invoice Form SHALL continue to require only "Name" and "Phone" as mandatory fields in the Customer Details section; DOB and Anniversary SHALL remain optional.
5. WHEN the invoice form is submitted, THE CRM SHALL include `birthday` and `anniversary` values (or `null` if not provided) in the `customer` payload sent to the backend.
6. THE Invoice Form SHALL reset the DOB and Anniversary fields to empty when the form is reset after a successful invoice submission.
7. THE CRM SHALL initialise the `emptyCustomer` object in `Invoice.jsx` to include `birthday: ''` and `anniversary: ''` fields, and SHALL remove `email` from that object.

---

### Requirement 6 — Frontend API Integration for Report

**User Story:** As a developer, I need a typed API method for the report endpoint so that the frontend can call it consistently.

#### Acceptance Criteria

1. THE CRM SHALL add a `getReport` method to the `invoiceAPI` object in `frontend/src/services/api.js` that calls `GET /invoices/report` with the provided filter parameters.
2. THE `getReport` method SHALL accept an object containing `filter`, `start` (optional), and `end` (optional) and SHALL pass them as query parameters.
3. WHEN the Report tab fetches data, THE CRM SHALL use `invoiceAPI.getReport` and SHALL NOT call the endpoint directly via raw axios calls.
