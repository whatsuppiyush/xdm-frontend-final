// workers/index.js
const { DMWorker } = require('./dm-worker');
const { startHealthServer } = require('./health-server');
const { messageTransformFunction } = require('./utils');

// Handle any initialization failures gracefully
process.on('unhandledRejection', (error) => {
  console.error('unhandledRejection', error);
});

// Start the health check server
startHealthServer();

// Start the worker
const worker = new DMWorker();
worker.initialize().catch(console.error);

// Export for potential programmatic use
module.exports = { 
  DMWorker,
  messageTransformFunction
}; 