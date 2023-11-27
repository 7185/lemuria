export const environment = {
  url: {
    websocket: 'wss://lemuria.7185.fr/api/v1/ws',
    server: 'https://lemuria.7185.fr/api/v1',
    imgProxy: 'https://images.weserv.nl/?url='
  },
  csrf: {
    access: 'lemuria_csrf_access',
    renew: 'lemuria_csrf_renew'
  },
  world: {
    chunk: {
      width: 2000,
      depth: 2000,
      loadCircular: true,
      loadRadius: 5
    },
    lod: {
      maxDistance: 100
    },
    collider: {
      boxSide: 0.5,
      climbHeight: 0.55,
      groundAdjust: 0.00001,
      maxStepLength: 0.2,
      maxNbSteps: 30
    }
  },
  debug: false
}
