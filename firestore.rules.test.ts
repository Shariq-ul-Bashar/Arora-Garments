/**
 * Firestore Security Rules Test Specification (Arora Garments)
 * Covers all Red-Team threat vectors from security_spec.md:
 * 1. Unauthenticated access to /users/{uid}/private/* -> DENY
 * 2. Unauthenticated access to /orders/{orderId} -> DENY
 * 3. Non-admin modifying /site_settings or /themes -> DENY
 * 4. Customer trying to set role='owner' on /users/{uid} -> DENY
 * 5. Customer trying to create /orders with paymentStatus='paid' -> DENY
 * 6. Non-admin trying to read unpublished /products/{id} (isPublished: false) -> DENY
 * 7. Customer reading own /orders/{orderId} (ownerId == uid) -> ALLOW
 * 8. Admin reading/updating any /orders/{orderId} or /site_settings/* -> ALLOW
 */
export const SECURITY_RULE_TEST_MATRIX = [
  { case: 'unauth_read_private_pii', expected: 'DENY' },
  { case: 'unauth_read_orders', expected: 'DENY' },
  { case: 'customer_write_site_settings', expected: 'DENY' },
  { case: 'customer_role_self_escalation', expected: 'DENY' },
  { case: 'customer_spoof_paid_order', expected: 'DENY' },
  { case: 'customer_read_draft_product', expected: 'DENY' },
  { case: 'customer_read_own_order', expected: 'ALLOW' },
  { case: 'admin_verify_payment_and_update_theme', expected: 'ALLOW' },
];
