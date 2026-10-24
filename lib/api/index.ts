// Typed client API for Pass It On. Import from client components:
//
//   import { requestRental, payRental } from '@/lib/api'
//
// Every function throws ApiError (with a human-readable message) on failure.
// Contract and state machines: docs/Database.md.

export { ApiError } from './client'
export * from './rentals'
export * from './sales'
export * from './disputes'
export * from './notifications'
export * from './wallet'
export * from './storage'
export * from './admin'
export * from './chat'
export * from './listings'
export * from './profiles'
export * from './reviews'
export * from './deals'
export * from './escrow'
export * from './mappers'
