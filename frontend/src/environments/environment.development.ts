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
      width: 2000, // Width of each chunk, in centimeters
      depth: 2000, // Depth of each chunk, in centimeters
      loadCircular: true, // If true: will load chunks within a circular radius instead of a squared area
      loadRadius: 5 // In number of chunks
    },
    lod: {
      maxDistance: 100 // In meters
    },
    collider: {
      boxSide: 0.5,
      climbHeight: 0.6,
      groundAdjust: 0.00001,
      maxStepLength: 0.2,
      maxNbSteps: 30
    },
    physics: {
      baseGravity: 9.81, // In m/s^2 (1g)
      jumpVelocity: 5, // Initial upward jump speed in m/s
      maxFallSpeed: 40 // Terminal vertical speed in m/s
    }
  },
  debug: true
}
