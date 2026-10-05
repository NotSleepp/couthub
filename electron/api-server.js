const { randomBytes, timingSafeEqual } = require('node:crypto');
const { createApplication } = require('./application');

function sendJson(res,status,data) {
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff' });
  res.end(JSON.stringify(data));
}
function parseBody(req) {
  return new Promise((resolve,reject) => {
    let size=0, chunks=[];
    const timer=setTimeout(()=>{ reject(new Error('La solicitud tardó demasiado.')); req.resume(); },15000);
    const finish=fn=>value=>{clearTimeout(timer);fn(value);};
    req.on('data',chunk=>{
      size+=chunk.length;
      if(size>2*1024*1024) { chunks=[]; finish(reject)(new Error('La solicitud supera 2 MB.')); }
      else chunks.push(chunk);
    });
    req.on('end',()=>{ try { finish(resolve)(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { finish(reject)(new Error('JSON inválido.')); } });
    req.on('error',finish(reject));
    req.on('aborted',finish(reject));
  });
}
function createApiBridge(options={}) {
  const application=options.application || createApplication(options);
  const token=randomBytes(32).toString('hex');
  async function handleApiRequest(req,res,next) {
    if(!req.url?.startsWith('/api/')) return next?.();
    try {
      const address=req.socket.remoteAddress || '';
      const host=req.headers.host || '';
      if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address) || !/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host)) return sendJson(res,403,{error:'Acceso local requerido.'});
      const origin=req.headers.origin;
      if((origin && origin !== 'http://'+host) || req.headers['sec-fetch-site']==='cross-site') return sendJson(res,403,{error:'Origen no autorizado.'});
      if(req.url==='/api/session' && req.method==='GET') return sendJson(res,200,{token});
      const supplied=Buffer.from(String(req.headers['x-accounthub-token'] || ''));
      const expected=Buffer.from(token);
      if(supplied.length!==expected.length || !timingSafeEqual(supplied,expected)) return sendJson(res,403,{error:'Sesión local inválida. Recargá la aplicación.'});
      if(req.url!=='/api/rpc' || req.method!=='POST') return sendJson(res,404,{error:'Operación no encontrada.'});
      if(!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return sendJson(res,415,{error:'Se requiere JSON.'});
      const {method,args}=await parseBody(req);
      return sendJson(res,200,{result:await application.invoke(method,args)});
    } catch(err) { if(!res.headersSent) sendJson(res,400,{error:err?.message || 'Error en la operación local.'}); }
  }
  return {application,handleApiRequest,close:()=>application.close()};
}
module.exports={createApiBridge};
