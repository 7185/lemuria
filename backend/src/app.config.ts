interface AppConfig {
  cache: {
    threshold: number
    timeout: number
  }
  cookie: {
    secure: boolean
    sameSite: 'strict' | 'lax' | 'none'
    accessName: string
    accessExpires: number
    accessPath: string
    refreshName: string
    refreshExpires: number
    refreshPath: string
  }
  positionUpdateTick: number
  heartbeatRate: number
  secret: string
}

export const config: AppConfig = {
  cache: {
    threshold: 5000,
    timeout: 3600
  },
  cookie: {
    secure: false,
    sameSite: 'strict',
    accessName: 'lemuria_token_access',
    accessExpires: 900,
    accessPath: '/api/v1/',
    refreshName: 'lemuria_token_renew',
    refreshExpires: 2592000,
    refreshPath: '/api/v1/auth/renew'
  },
  positionUpdateTick: 200,
  heartbeatRate: 60000,
  secret: '**changeme**'
}
