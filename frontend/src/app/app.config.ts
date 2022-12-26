export const config: any = {
  url: {
    websocket: 'ws://localhost:8080/api/v1/ws',
    server: 'http://localhost:8080/api/v1',
    imgProxy: 'https://images.weserv.nl/?url='
  },
  csrf: {
    access: 'lemuria_csrf_access',
    renew: 'lemuria_csrf_renew'
  },
  world: {
    chunk: {
      propBatchSize: 20, // How much props are allowed to be loaded in parallel before moving to the next ones
      width: 2000, // Width of each chunk, in centimeters
      depth: 2000, // Depth of each chunk, in centimeters
      loadCircular: true, // If true: will load chunks within a circular radius instead of a squared area
      loadRadius: 5, // In number of chunks
      prioritizeNearest: true // If true: will load nearest chunks first
    },
    lod: {
      maxDistance: 100 // In meters
    },
    collider: {
      boxSide: 0.50,
      climbHeight: 0.55,
      groundAdjust: 0.00001,
      maxStepLength: 0.2,
      maxNbSteps: 30
    }
  },
  debug: false
}
