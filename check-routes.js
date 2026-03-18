const http = require('http');
const paths=['/agent-hub','/info','/.well-known/agent-card.json','/ok'];
(async()=>{
  for(const p of paths){
    await new Promise((resolve,reject)=>{
      http.get('http://localhost:3000'+p, resp=>{
        let b='';
        resp.on('data',d=>b+=d);
        resp.on('end',()=>{
          console.log(p, resp.statusCode, b.slice(0,300));
          resolve();
        });
      }).on('error',reject);
    });
  }
})();
