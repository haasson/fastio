import type { SupabaseClient } from '@supabase/supabase-js'

export const functionsApi = {
  listTeam(sb: SupabaseClient, body: object) {
    return sb.functions.invoke('list-team', { body })
  },

  inviteMember(sb: SupabaseClient, body: object) {
    return sb.functions.invoke('invite-member', { body })
  },

  acceptInvite(sb: SupabaseClient, body: object) {
    return sb.functions.invoke('accept-invite', { body })
  },

  getInvite(sb: SupabaseClient, body: object) {
    return sb.functions.invoke('get-invite', { body })
  },
}
