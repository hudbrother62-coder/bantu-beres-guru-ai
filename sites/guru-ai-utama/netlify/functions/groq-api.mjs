/* BYOK GroqCloud proxy. No keys are held in Netlify environment variables or logged. */
const UPSTREAM="https://api.groq.com/openai/v1";
const HEADERS={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store, private, max-age=0","X-Content-Type-Options":"nosniff"};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:HEADERS});
const keyOK=value=>/^gsk_[A-Za-z0-9_-]{20,}$/.test(String(value||"").trim());
const visibleError=(code)=>{
  if(code===401||code===403)return "API key GroqCloud ditolak. Periksa key pribadi pada menu Workspace.";
  if(code===429)return "Kuota atau batas penggunaan GroqCloud tercapai. Coba setelah kuota tersedia.";
  if(code>=500)return "GroqCloud sementara mengalami gangguan.";
  return "Permintaan ke GroqCloud tidak dapat diproses.";
};
export default async function handler(request) {
  if(request.method!=="POST")return json({error:"Metode tidak diizinkan."},405);
  const origin=request.headers.get("origin");
  if(origin&&origin!==new URL(request.url).origin)return json({error:"Permintaan lintas situs ditolak."},403);
  const length=Number(request.headers.get("content-length")||0);
  if(length>130000)return json({error:"Permintaan terlalu besar."},413);
  let body;
  try{const raw=await request.text();if(raw.length>130000)throw new Error("too large");body=JSON.parse(raw);}
  catch{return json({error:"Format permintaan tidak valid atau terlalu besar."},400);}
  const key=String(body.key||"").trim();
  if(!keyOK(key))return json({error:"Masukkan API key GroqCloud berawalan gsk_. Key Gemini tidak berlaku."},400);
  if(body.action!=="models"&&body.action!=="chat")return json({error:"Aksi tidak diizinkan."},400);
  if(body.action==="chat"){
    if(typeof body.model!=="string"||body.model.length>110||!/^[a-zA-Z0-9_.\/-]+$/.test(body.model))return json({error:"ID model tidak valid."},400);
    if(!Array.isArray(body.messages)||body.messages.length<1||body.messages.length>16)return json({error:"Format pesan tidak valid."},400);
    if(!body.messages.every(m=>["system","user","assistant"].includes(m?.role)&&typeof m.content==="string"&&m.content.length<=80000))return json({error:"Isi pesan tidak valid."},400);
    if(JSON.stringify(body.messages).length>105000)return json({error:"Konteks terlalu panjang."},413);
  }
  let upstream;
  try{
    upstream=await fetch(UPSTREAM+(body.action==="models"?"/models":"/chat/completions"),{
      method:body.action==="models"?"GET":"POST",
      headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},
      cache:"no-store",
      signal:AbortSignal.timeout(50000),
      ...(body.action==="chat"?{body:JSON.stringify({
        model:body.model,
        messages:body.messages,
        temperature:Math.min(1,Math.max(0,Number(body.temperature)||0.4)),
        max_completion_tokens:Math.min(8192,Math.max(32,Number(body.max_tokens)||4096)),
        stream:false
      })}:{})
    });
  }catch{
    return json({error:"Koneksi ke GroqCloud melewati batas waktu atau tidak tersedia."},504);
  }
  const result=await upstream.json().catch(()=>({}));
  if(!upstream.ok)return json({error:visibleError(upstream.status)},upstream.status);
  if(body.action==="models"){
    return json({models:(result.data||[]).filter(m=>m.active!==false&&typeof m.id==="string").map(m=>m.id).slice(0,100)});
  }
  const reply=result?.choices?.[0]?.message?.content;
  if(typeof reply!=="string"||!reply.trim())return json({error:"Model tidak menghasilkan jawaban."},502);
  return json({reply,model:body.model});
}
