import { defineFeature } from '../_manifest'

export default defineFeature({
  key: 'team',
  vertical: 'shared',
  purpose: 'Команда тенанта: участники, роли, инвайты, мульти-филиальные доступы',
  tenantModule: false,

  routes: [
    { path: '/team/members', purpose: 'Список участников + инвайты' },
    { path: '/team/roles', purpose: 'Роли и матрица permissions' },
  ],

  permissions: [
    'team.view',
    'team.manage',
    'roles.manage',
  ],

  db: {
    tables: [
      'tenant_members',
      'tenant_invitations',
      'tenant_roles',
    ],
  },

  dependsOn: [
    'shared.data.useDatabase',
    'shared.stores.tenant',
    'shared.stores.auth',
    '@fastio/shared',
  ],
})
