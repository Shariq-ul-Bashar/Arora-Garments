# Arora Garments — Firestore Security & Threat Model Specification

## 1. Roles & Trust Boundaries
- **Public / Unauthenticated**: Read-only access to `site_settings`, `themes`, `categories`, `delivery_zones`, `test/connection`, and `products` where `isPublished == true`. Zero write access anywhere.
- **Customer (`customer`)**: Signed-in via Firebase Auth. Can read/write their own `users/{uid}` (cannot modify `role` field) and `users/{uid}/private/{docId}` PII subcollection. Can read their own `orders/{orderId}` (`ownerId == request.auth.uid`), and create `orders` ONLY with `paymentStatus in ['pending', 'awaiting_payment']` (cannot self-mark `paid`).
- **Staff / Owner (`owner`, `manager`, `order_staff`, `content_staff`)**: Verified via `users/{uid}.role` or bootstrap owner email `owner@aroragarments.in` (with `email_verified == true`). Full read/write access to catalog, themes, branding, settings, delivery zones, and order payment/status verification.

## 2. Red-Team Exploit Mitigations
1. **Unauthenticated PII Read**: `users/{uid}/private/*` and `orders/*` deny unauthenticated reads (`request.auth != null`).
2. **Role Self-Escalation**: Non-admins creating `users/{uid}` must have `role == 'customer'`; updates cannot modify `role` unless `isAdmin()`.
3. **Payment Spoofing**: Customers creating orders cannot pass `paymentStatus == 'paid'` or `'verified'`; updates to `orders` are restricted to `isAdmin()`.
4. **Draft Leakage**: Unpublished starter catalog items (`isPublished != true`) are denied to non-admins on individual document reads.
5. **Over-broad Wildcard**: Final rule block explicitly enforces `match /{document=**} { allow read, write: if false; }`.
