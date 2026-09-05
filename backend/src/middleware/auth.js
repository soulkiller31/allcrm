// Route all auth through tenant middleware for backward compatibility
export { authenticate, authenticateTenant } from './tenant.js';
