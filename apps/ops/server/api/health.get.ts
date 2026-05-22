import { defineEventHandler } from 'h3'

// Coolify liveness probe. Намеренно НЕ требует auth — endpoint публичный.
// НЕ дёргает базу (Supabase): liveness ≠ readiness, мы не хотим, чтобы Coolify
// считал контейнер нездоровым из-за лага БД и рестартил его.
export default defineEventHandler(() => ({ status: 'ok' }))
