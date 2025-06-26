const baseUrl = `${window.location.protocol}//${window.location.host}/api/v1`

export const environment = {
  url: {
    websocket: `${baseUrl.replace('http', 'ws')}/ws`,
    server: baseUrl,
    mediaProxy: `${baseUrl}/proxy/url?url=`,
    mediaArchive: `${baseUrl}/proxy/archive?url=$1&date=$2`
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
      climbHeight: 0.6,
      groundAdjust: 0.00001,
      maxStepLength: 0.2,
      maxNbSteps: 30
    }
  },
  debug: false
}
