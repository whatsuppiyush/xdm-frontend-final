const http = require('http');

// Create a simple health check server
function startHealthServer() {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  // Start the server on the specified port
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Health check server listening on port ${PORT}`);
  });

  return server;
}

module.exports = { startHealthServer }; 