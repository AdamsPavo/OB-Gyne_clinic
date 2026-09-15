# Individual access permissions

## Using the user editor

An Admin opens **User Management → Add User / Edit → Access Permissions**. Modules are grouped under Overview, Patient care, Finance, Clinic operations, and Administration. Review the permission summary before saving.

- **Select All** enables View for every module and retains selected actions.
- **Clear All** removes module access. The user can still log in and sees the access-restricted message.
- **View Only** enables View for every module and removes action grants, including Print.
- **Full Access** enables every supported action.
- Selecting an action also selects View. Clearing View clears that module's actions.
- Admin permissions are checked and disabled. Admin always receives every permission, including future additions to the catalog.

Only Admin can set permissions or change roles. A non-admin granted user-management actions can manage ordinary account details only for non-admin accounts whose grants do not exceed their own. Password resets and account-status changes have the same protection. A new account created by a non-admin receives the established staff defaults, never caller-supplied grants.

## Installation and existing accounts

Restart the Node backend after deploying these files, then refresh the frontend or sign in again. Startup adds the `users.permissions` JSON text column and fills only NULL permissions from legacy role defaults. It does not recreate patient tables, reset accounts, change passwords, or promote roles. Subsequent restarts preserve saved grants, including an explicit empty permission set. A database trigger supplies persisted defaults for legacy account-creation code.

The existing Admin account is required for assigning permissions; no doctor is silently promoted to Admin. Existing doctor accounts retain broad access, and staff retain their established operational modules without patient deletion or certificate editing. The requirement that only Admin can manage grants applies to all accounts.

## Enforcement

`shared/permissions.mjs` defines module/action names, route mappings, and API requirements for both the renderer and Node 22 backend. Keep this shared directory alongside `client` and `server` when deploying.

The workspace waits for `/api/auth/profile` before mounting protected pages on refresh. Sidebar links, direct workspace routes, and action controls use individual grants. The server verifies the JWT signature but resolves the account role, active status, and permissions from the database on every request. Existing JWT role claims cannot override the database. Unknown API paths fail closed for non-admins.

Limited patient identity, case identity, and stock-selection lookups are available inside allowed workflows. These do not grant full patient records, clinical history, stock valuations, or access to those modules. Dashboard and consultation-detail responses omit related data when that module is restricted.

Compound workflows require the permissions for their constituent actions: creating a consultation from an appointment requires Consultations/Create and Appointments/Complete; prenatal encounters also require Prenatal/Create; prescribing and laboratory orders require their own Create grants. Saving a pregnancy's completion/delivery alongside edited details requires Prenatal/Edit and Complete. Payments require Billing/Mark as Paid independently of Billing/Edit. Medical-certificate authoring requires Other Charges/Edit.

Application print/export controls request server authorization before opening their documents. Printing cannot prevent a person from using their browser or operating system to capture data they are already allowed to view.

## Verification

From the repository root:

```powershell
node --test server/tests/*.test.js
```

From `client`:

```powershell
node --test tests/*.test.*
npm.cmd run build
```

The permission tests use an isolated in-memory database and a temporary local HTTP server; they do not modify the clinic database. Renderer tests cover sidebar visibility, direct URL denial, and disabled actions. A connected browser is still needed for visual inspection of the editor at desktop and mobile sizes.
