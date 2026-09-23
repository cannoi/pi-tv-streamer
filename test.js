const http = require('http');
const PORT = process.env.PORT || 8080;

// Check if server is already running or start one for testing
const options = {
  hostname: '127.0.0.1',
  port: PORT,
  path: '/health',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('Test passed: /health returned 200 OK');
      process.exit(0);
    } else {
      console.error(`Test failed: status code ${res.statusCode}`);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  // If the server isn't running yet, we can spin up server.js for testing
  console.log('Starting server for test...');
  require('./server.js');
  setTimeout(() => {
    const retryReq = http.request(options, (retryRes) => {
      if (retryRes.statusCode === 200) {
        console.log('Test passed on retry: /health returned 200 OK');
        process.exit(0);
      } else {
        console.error(`Test failed on retry: status code ${retryRes.statusCode}`);
        process.exit(1);
      }
    });
    retryReq.on('error', (err) => {
      console.error('Test failed: server could not be reached', err.message);
      process.exit(1);
    });
    retryReq.end();
  }, 1000);
});

req.end();
