const https = require('https');
const host = 'warden-travel-agent-bayx.onrender.com';
const urls = ['/.well-known/agent-card.json', '/info', '/ok', '/agent-hub', '/'];

urls.forEach((path) => {
  const options = { hostname: host, path, method: 'GET' };
  const req = https.request(options, (res) => {
    console.log('PATH', path, 'STATUS', res.statusCode);
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('BODY', data.slice(0, 500));
      if (data.length > 500) console.log('...truncated');
      console.log('---');
    });
  });
  req.on('error', (e) => {
    console.error('ERROR', path, e.message);
  });
  req.end();
});
