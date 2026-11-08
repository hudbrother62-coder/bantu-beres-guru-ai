import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ROOT=new URL('../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,ROOT),'utf8');
const paths=['sites/guru-ai-utama','sites/guru-ai-v2'];
const KEY='gsk_testkeyofthirtycharacters123456789';
const JSON_HEADERS={'content-type':'application/json'};

for(const path of paths) {
  test(path+' has complete Groq backend and preserved workspace files',()=>{
    const html=read(path+'/public/index.html');
    const client=read(path+'/public/groq-client.js');
    const proxy=read(path+'/netlify/functions/groq-api.mjs');
    assert.match(html,/groq-client\.js/);
    assert.match(client,/\.netlify\/functions\/groq-api/);
    assert.match(proxy,/https:\/\/api\.groq\.com\/openai\/v1/);
    assert.doesNotMatch(html,/generativelanguage\.googleapis\.com/);
    assert.doesNotMatch(html,/\/\.netlify\/scripts\/hud/);
    const renderedCode=html+(path.endsWith("v2")?read(path+"/public/app.js"):"");
    assert.match(renderedCode,/GroqCloud/);
    assert.match(renderedCode,/20261108/);
    assert.match(renderedCode,/console\.groq\.com\/keys/);
  });
  test(path+' Netlify Function validates keys and shields credential',async()=>{
    const {default:handler}=await import(new URL(path+'/netlify/functions/groq-api.mjs',ROOT));
    const req=(body,origin='https://app.netlify.app')=>new Request('https://app.netlify.app/.netlify/functions/groq-api',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const bad=await handler(req({action:'models',key:'AIzaOldGoogleKey'}));
    assert.equal(bad.status,400);
    const blocked=await handler(req({action:'models',key:KEY},'https://other.example'));
    assert.equal(blocked.status,403);
    const old=globalThis.fetch;
    globalThis.fetch=async(url,options)=>{
      assert.equal(options.headers.Authorization,'Bearer '+KEY);
      if(String(url).endsWith('/models'))return new Response(JSON.stringify({data:[{id:'openai/gpt-oss-120b',active:true}]}),{status:200,headers:JSON_HEADERS});
      if(String(url).endsWith('/chat/completions'))return new Response(JSON.stringify({choices:[{message:{content:'Terhubung'}}]}),{status:200,headers:JSON_HEADERS});
      throw Error('unexpected URL: '+url);
    };
    try{
      const m=await handler(req({action:'models',key:KEY}));
      assert.equal(m.status,200);const mr=await m.json();assert.deepEqual(mr.models,['openai/gpt-oss-120b']);
      assert.doesNotMatch(JSON.stringify(mr),/gsk_/);
      const chat=await handler(req({action:'chat',key:KEY,model:'openai/gpt-oss-120b',messages:[{role:'user',content:'Halo'}]}));
      assert.equal(chat.status,200);assert.equal((await chat.json()).reply,'Terhubung');
    }finally{globalThis.fetch=old;}
  });
}
test('main Guru AI preserves old localStorage keys and parses inline app JavaScript',()=>{
  const html=read('sites/guru-ai-utama/public/index.html');
  for(const key of ['bbe_projects','bbe_outputs','bbe_versions','bbe_credential','bbe_chat','bbe_active_project'])
    assert.match(html,new RegExp(key));
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  const application=scripts.map(m=>m[1]).find(code=>code.includes('const SUBJECTS='));
  assert.ok(application,'original inline application exists');
  new vm.Script(application,{filename:'guru-ai-main-app.js'});
  assert.match(application,/async function groq\(/);
  assert.match(application,/saveNewGroqKey/);
  assert.doesNotMatch(application,/async function gemini\(/);
});
test('V2 preserves storage key, tools, custom subjects and popup notice',()=>{
  const js=read('sites/guru-ai-v2/public/app.js');
  assert.match(js,/bantuberes-guru-ai-v2/);
  for(const name of ['Modul Ajar','LKPD','Asesmen Soal','Strategi Pembelajaran','Bahan Ajar','Rubrik Penilaian','Panduan Presentasi','Peta Konsep'])assert.ok(js.includes(name));
  assert.match(js,/function openProjectModal/);
  assert.match(js,/showGroqUpdate/);
  assert.match(js,/function callGroq/);
  assert.match(js,/console\.groq\.com\/keys/);
  assert.doesNotMatch(js,/generativelanguage\.googleapis\.com/);
});
test('browser client automatically chooses available model and fallback',async()=>{
  const client=read('sites/guru-ai-v2/public/groq-client.js');
  const calls=[];
  const ctx={window:{},console,Map,Set,Date,AbortSignal,
    fetch:async(url,options)=>{
      const payload=JSON.parse(options.body);
      calls.push(payload);
      if(payload.action==='models')return new Response(JSON.stringify({models:['llama-3.1-8b-instant','openai/gpt-oss-120b']}),{status:200,headers:JSON_HEADERS});
      if(payload.model==='openai/gpt-oss-120b')return new Response(JSON.stringify({error:'model not available'}),{status:404,headers:JSON_HEADERS});
      return new Response(JSON.stringify({reply:'Lanjut dari model cadangan'}),{status:200,headers:JSON_HEADERS});
    }
  };
  vm.createContext(ctx);vm.runInContext(client,ctx);
  const result=await ctx.window.GuruGroq.chat('Buat LKPD',KEY);
  assert.equal(result.model,'llama-3.1-8b-instant');
  assert.equal(result.text,'Lanjut dari model cadangan');
  assert.deepEqual(calls.filter(x=>x.action==='chat').map(x=>x.model),['openai/gpt-oss-120b','llama-3.1-8b-instant']);
});


test("Both Netlify Guru AI variants embed the user's GroqCloud tutorial and retain their AI settings", () => {
  const main=read("sites/guru-ai-utama/public/index.html");
  const v2=read("sites/guru-ai-v2/public/app.js");
  const css=read("sites/guru-ai-v2/public/app.css");
  for (const app of [main,v2]) {
    assert.match(app,/youtube\.com\/embed\/WBX9Yvk4eKs/);
    assert.match(app,/youtu\.be\/WBX9Yvk4eKs/);
    assert.match(app,/console\.groq\.com\/keys/);
    assert.match(app,/allowfullscreen/);
    assert.match(app,/model otomatis|Model otomatis|Model dipilih otomatis/i);
  }
  assert.match(css,/groq-video-frame iframe/);
});
