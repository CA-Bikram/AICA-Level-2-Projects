// TaskAlly - office server (no external dependencies). Data is saved in ./data/taskally.json
const http=require("http"),fs=require("fs"),path=require("path"),os=require("os"),crypto=require("crypto"),cp=require("child_process");
const PORT=+process.env.PORT||+process.argv[2]||3000;
const base=process.pkg?path.dirname(process.execPath):__dirname;
const dataDir=path.join(base,"data"),file=path.join(dataDir,"taskally.json");
const COLS=["members","tasks","comments"];
fs.mkdirSync(path.join(dataDir,"backups"),{recursive:true});
let db={members:{},tasks:{},comments:{}};
try{db=Object.assign(db,JSON.parse(fs.readFileSync(file,"utf8")))}catch(e){}
if(fs.existsSync(file)){const d=new Date().toISOString().slice(0,10),b=path.join(dataDir,"backups","taskally-"+d+".json");if(!fs.existsSync(b))fs.copyFileSync(file,b)}
let saving=false,again=false;
function save(){if(saving){again=true;return}saving=true;const tmp=file+".tmp";fs.writeFile(tmp,JSON.stringify(db),err=>{if(!err)fs.rename(tmp,file,()=>{});saving=false;if(again){again=false;save()}})}
function demoData(){const D=n=>{const d=new Date();d.setDate(d.getDate()-n);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")},now=Date.now(),P=["#7c3aed","#ec4899","#06b6d4","#f59e0b"];
const M=[["Ananya Sen","ananya@example.com"],["Rahul Verma","rahul@example.com"],["Priya Das","priya@example.com"],["Sourav Ghosh","sourav@example.com"]];
const T=[[0,"GSTR-3B filing - Sharma Traders",2,0,"In Progress",""],[0,"Reconcile GSTR-2B with purchase register",3,0,"Pending",""],[0,"TDS return 26Q - Q2 data entry",2.5,1,"Completed","Challans verified"],[0,"Prepare GST notice reply draft",4,2,"Completed",""],
[1,"Bank reconciliation - Mehta Exports",3,0,"Pending",""],[1,"Statutory audit working papers - Patel & Sons",6,1,"In Progress","Waiting for debtor confirmations"],[1,"Fixed asset register update",2,3,"Completed",""],
[2,"ITR-3 computation - Dr. Banerjee",4,0,"In Progress",""],[2,"Advance tax calculation - 3 clients",2,1,"Completed",""],[2,"Form 3CD clause review",5,2,"Blocked","Client has not sent stock details"],
[3,"ROC annual filing - AOC-4 / MGT-7",3,0,"Pending",""],[3,"Payroll and PF/ESI returns",2,1,"Completed",""],[3,"Tally data cleanup - Roy Enterprises",3,1,"Blocked","Backup file missing"],[3,"TDS reconciliation vs 26AS",2.5,4,"Completed",""]];
const C=[[5,"Please share the debtor confirmation status by evening."],[9,"Follow up with the client today and escalate if stock details are not received by tomorrow."],[12,"Please ask the client to resend the Tally backup."]];
const o={members:{},tasks:{},comments:{}};
M.forEach((m,i)=>o.members["demo-m"+(i+1)]={name:m[0],email:m[1],color:P[i],createdAt:now});
T.forEach((t,i)=>o.tasks["demo-t"+(i+1)]={memberId:"demo-m"+(t[0]+1),title:t[1],est:t[2],date:D(t[3]),status:t[4],note:t[5],createdAt:now});
C.forEach((c,i)=>{const t=T[c[0]];o.comments["demo-c"+(i+1)]={taskId:"demo-t"+(c[0]+1),memberId:"demo-m"+(t[0]+1),author:"Admin",text:c[1],at:now}});
return o}
if(!fs.existsSync(file)){if(!process.argv.includes("--empty"))Object.assign(db,demoData());save()}
const send=(res,code,obj,type="application/json")=>{res.writeHead(code,{"Content-Type":type+"; charset=utf-8","Cache-Control":"no-store"});res.end(type==="application/json"?JSON.stringify(obj):obj)};
const body=req=>new Promise((ok,no)=>{let s="";req.on("data",c=>{s+=c;if(s.length>1e6){no();req.destroy()}});req.on("end",()=>{try{ok(JSON.parse(s||"{}"))}catch(e){no(e)}});req.on("error",no)});
const clean=o=>{const r={};for(const k of Object.keys(o||{}))if(k!=="id"&&k!=="__proto__")r[k]=o[k];return r};
http.createServer(async(req,res)=>{
  try{
    const u=new URL(req.url,"http://x"),p=u.pathname.split("/").filter(Boolean);
    if(req.method==="GET"&&(u.pathname==="/"||u.pathname==="/index.html"))return send(res,200,fs.readFileSync(path.join(__dirname,"public","index.html"),"utf8"),"text/html");
    if(p[0]!=="api")return send(res,404,{error:"Not found"});
    if(req.method==="GET"&&p[1]==="state"){const o={};COLS.forEach(c=>o[c]=Object.entries(db[c]).map(([id,v])=>({...v,id})));return send(res,200,o)}
    const c=p[1],id=p[2];if(!COLS.includes(c))return send(res,404,{error:"Unknown collection"});
    if(req.method==="POST"&&!id){const nid=crypto.randomUUID();db[c][nid]=clean(await body(req));save();return send(res,200,{id:nid})}
    if(req.method==="PATCH"&&id){if(!db[c][id])return send(res,404,{error:"Missing"});Object.assign(db[c][id],clean(await body(req)));save();return send(res,200,{ok:1})}
    if(req.method==="DELETE"&&id){delete db[c][id];save();return send(res,200,{ok:1})}
    send(res,400,{error:"Bad request"});
  }catch(e){send(res,500,{error:"Server error"})}
}).listen(PORT,"0.0.0.0",()=>{
  const ips=[].concat(...Object.values(os.networkInterfaces())).filter(i=>i.family==="IPv4"&&!i.internal).map(i=>i.address);
  console.log("\n  TaskAlly is running.\n  On this PC:        http://localhost:"+PORT);
  ips.forEach(ip=>console.log("  Team (same Wi-Fi/LAN): http://"+ip+":"+PORT));
  console.log("\n  Data file: "+file+"\n  Keep this window open. Press Ctrl+C to stop.\n");
  if(process.platform==="win32")cp.exec('start "" http://localhost:'+PORT);
}).on("error",e=>{console.log(e.code==="EADDRINUSE"?"Port "+PORT+" is already in use. Run: server.js <other port>":e.message);process.exit(1)});
