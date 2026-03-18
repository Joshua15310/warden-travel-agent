const http=require('http');
http.get('http://localhost:3000/info', r=>{let b=''; r.on('data',d=>b+=d); r.on('end',()=>{console.log('status', r.statusCode); console.log(b); process.exit(0);});}).on('error', (e)=>{console.error('err',e); process.exit(1);});
