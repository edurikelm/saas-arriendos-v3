# PRD: Mercado Pago per-user token integration

## Problem Statement

Currently, the application uses a single global Mercado Pago access token stored in environment variables. This means all arrendadores (owners) share the same MP credentials, which is not ideal for:
- Multi-tenant isolation
- Individual accounting and reporting per owner
- Independent webhook management
- Scalability when adding more payment providers

Each arrendador needs to be able to configure their own Mercado Pago account to collect payments for their properties.

## Solution

Enable each arrendador to configure their own Mercado Pago credentials through a Settings page. The system will use each owner's token when generating payment links, while maintaining backward compatibility with the global token.

## User Stories

1. As an arrendador, I want to access a Settings page, so that I can manage my account configuration
2. As an arrendador, I want to see an Integrations section in Settings, so that I can manage third-party integrations
3. As an arrendador, I want to enter my Mercado Pago access token, so that I can receive payments under my own account
4. As an arrendador, I want the system to validate my token before saving, so that I know it works correctly
5. As an arrendador, I want to see if my Mercado Pago is connected or not, so that I can troubleshoot issues
6. As an arrendador, I want to disconnect my Mercado Pago, so that I can change to a different account
7. As the system, I want to use the arrendador's token when generating payment links, so that payments go to the correct account
8. As the system, I want to fallback to the global token if no user token is configured, so that existing functionality continues working
9. As the system, I want to show an error message if no token is configured, so that the arrendador knows they need to set it up
10. As an arrendador, I want to receive webhook notifications at my own URL, so that I can track my payments independently

## Implementation Decisions

### Schema Changes

Create `UserIntegration` model to store per-user integration credentials:
- `userId`: Foreign key to UserProfile
- `provider`: Enum (MERCADO_PAGO, STRIPE, etc.) for extensibility
- `accessToken`: Encrypted storage of the API token
- `isActive`: Boolean to enable/disable without deleting
- `metadata`: JSON field for provider-specific settings (webhook URL, etc.)
- `createdAt`, `updatedAt`: Timestamps

### Modules to Build/Modify

1. **UserIntegration Model (Prisma)**
   - New model with unique constraint on (userId, provider)
   - Migration to add table

2. **saveMercadoPagoToken Action**
   - Input: userId, accessToken
   - Validate token by making test API call to MP
   - If valid, save/update UserIntegration record
   - If invalid, return error message
   - Return status: success, error, or already_configured

3. **getMercadoPagoToken Action**
   - Input: userId
   - Output: accessToken or null
   - Used by generateMercadoPagoLink to get user's token

4. **Settings Integrations UI**
   - New page at `/settings/integrations` or section within `/settings`
   - Display current Mercado Pago connection status
   - Input field for access token (masked)
   - "Connect" button that validates and saves
   - "Disconnect" button to clear configuration
   - Visual feedback: Connected (green), Not connected (red), Validating (loading)

5. **Modify generateMercadoPagoLink**
   - First attempt: fetch user's token from UserIntegration
   - If found, use user's token for API calls
   - If not found, fallback to global MERCADOPAGO_ACCESS_TOKEN
   - If neither available, return error: "Mercado Pago not configured. Please add your access token in Settings."

### API Contracts

No new API endpoints required - use existing patterns:
- `POST /api/settings/integrations` - Save/update integration (uses existing server actions pattern)
- Settings page reads from user session and UserIntegration table

### Edge Cases

- User tries to configure with expired/revoked token → Show validation error
- User disconnects → Future payments use global token (if available) or fail
- User has partial payments pending → Continue using original token for those
- Two users trying to use same token → Allow (MP supports multiple accounts)

## Testing Decisions

### What makes a good test
- Test external behavior, not implementation details
- Mock external API calls (Mercado Pago validation endpoint)
- Test validation logic independently

### Modules to test
1. **saveMercadoPagoToken action**
   - Valid token → saves successfully
   - Invalid token → returns error
   - Re-saving with new token → updates existing record

2. **Settings UI component**
   - Renders correctly when not connected
   - Renders correctly when connected
   - Shows loading state during validation
   - Shows error message on validation failure

3. **generateMercadoPagoLink integration**
   - Uses user token when available
   - Falls back to global token
   - Returns proper error when no token available

## Out of Scope

- Stripe or other payment provider integrations (extensible design but not implemented)
- Automatic webhook URL configuration per user (uses global webhook for now)
- Token rotation/expiration handling (future enhancement)
- Multi-tenant webhook isolation (future enhancement)

## Further Notes

- Mercado Pago webhook configuration currently uses global URL. Future enhancement could allow per-user webhook URLs.
- The `external_reference` format includes reservationId and will work correctly with the user-specific token since the reservation already has userId.
- Security consideration: access tokens should be encrypted at rest. For MVP, storing as-is in DB is acceptable with future encryption upgrade.