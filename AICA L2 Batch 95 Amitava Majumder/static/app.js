'use strict';
const $ = s => document.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const token = $('meta[name="cdrt-token"]').content;
let state = {clients:[],requests:[],today:''}, currentView = 'overview', toastTimer;
const titles = {
  overview:['Your document desk.','Keep every request visible, from the first ask to the final receipt.'],
  requests:['Every request. One place.','Search, update and export your document collection register.'],
  clients:['A clearer client picture.','Keep your contacts and outstanding requests together.'],
  reminders:['Make follow-ups easier.','Turn pending requests into a clear, editable reminder.']
};
function toast(message) { $('#toast').textContent=message; $('#toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').hidden=true,4500); }
function error(message) { $('#error-banner').textContent=message; $('#error-banner').hidden=!message; }
async function api(path,data) {
  const options=data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-CDRT-Token':token},body:JSON.stringify(data)};
  let res;
  try { res=await fetch(path,options); } catch(e) {throw Error('Cannot reach CDRT. Keep the application window open and refresh this page.');}
  if (!res.ok) {const problem=await res.json(); throw Error(problem.error||'The action could not be completed.');}
  return res;
}
function badge(text) {const kind=/^\d+ overdue$/.test(text)?'overdue':text.toLowerCase().replaceAll(' ','-');return `<span class="badge ${kind}">${esc(text)}</span>`;}
function prettyDate(iso) {return new Date(iso+'T12:00:00').toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});}
function selectClients(selector,placeholder) {
  const el=$(selector), old=el.value;
  el.innerHTML=`<option value="">${esc(placeholder)}</option>`+state.clients.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  if(state.clients.some(c=>String(c.id)===old)) el.value=old;
}
async function refresh() {
  const fresh=await (await api('/api/state')).json();
  if(JSON.stringify(fresh)!==JSON.stringify(state)) clearDraft();
  state=fresh;
  $('#today').textContent=prettyDate(state.today);
  $('#demo-banner').hidden=state.clients.length>0||state.requests.length>0;
  selectClients('#client-filter','All clients'); selectClients('#request-client','Choose a client'); selectClients('#reminder-client','Choose a client');
  renderOverview(); renderRequests(); renderClients(); error('');
}
function showView(view) {
  if(!titles[view]) return;
  currentView=view;
  for(const name of Object.keys(titles)) $(`#${name}-view`).hidden=name!==view;
  document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  $('#page-title').textContent=titles[view][0]; $('#page-description').textContent=titles[view][1];
  error('');
}
function renderOverview() {
  const rows=state.requests, pending=rows.filter(r=>r.status==='Pending'), received=rows.filter(r=>r.status==='Received'), excluded=rows.filter(r=>r.status==='Not required');
  $('#total-count').textContent=rows.length; $('#pending-count').textContent=pending.length;
  $('#overdue-count').textContent=pending.filter(r=>r.timing==='Overdue').length; $('#received-count').textContent=received.length;
  const attention=pending.filter(r=>r.timing==='Overdue'||r.timing==='Due today');
  $('#attention-count').textContent=`${attention.length} item${attention.length===1?'':'s'}`;
  $('#attention-list').innerHTML=attention.length?attention.slice(0,5).map(r=>`<div class="attention-row"><div><strong>${esc(r.document)}</strong><p>${esc(r.client_name)} · ${esc(r.period)}</p></div><div>${badge(r.timing)}<br><button class="text-button" data-edit-request="${r.id}">${r.days_overdue?`${r.days_overdue} days overdue`:'Due today'} →</button></div></div>`).join('')+(attention.length>5?'<div class="attention-row"><button class="text-button" data-overdue="true">View all outstanding requests →</button></div>':''):'<div class="empty"><strong>You’re all caught up.</strong>No pending documents are overdue or due today.</div>';
  const required=pending.length+received.length, pct=required?Math.round(received.length/required*100):0;
  $('#progress-number').innerHTML=`${pct}<span>%</span>`; $('#progress-bar').style.width=`${pct}%`;
  $('#progress-detail').textContent=required?`${received.length} of ${required} required documents received.`:'No required documents yet.';
  $('#legend-received').textContent=received.length; $('#legend-pending').textContent=pending.length; $('#legend-excluded').textContent=excluded.length;
  $('#client-snapshot').innerHTML=state.clients.length?state.clients.map(c=>{
    const p=pending.filter(r=>r.client_id===c.id), o=p.filter(r=>r.timing==='Overdue');
    return `<div class="snapshot-row"><div><strong>${esc(c.name)}</strong><p>${esc(c.contact||'No contact person added')}</p></div><div>${p.length} <small>pending</small></div><div>${o.length?badge(o.length+' overdue'):'<small>No overdue</small>'}</div><button class="text-button" data-client-requests="${c.id}">View requests →</button></div>`;
  }).join(''):'<div class="empty"><strong>A fresh start.</strong>Add your first client, or load the sample data above.</div>';
}
function filteredRows() {
  const q=$('#search').value.trim().toLowerCase(), cid=$('#client-filter').value, status=$('#status-filter').value;
  return state.requests.filter(r=>(!cid||String(r.client_id)===cid)&&(!status||r.status===status||r.timing===status)&&(!q||[r.document,r.client_name,r.period,r.service,r.notes].join(' ').toLowerCase().includes(q)));
}
function renderRequests() {
  const rows=filteredRows(); $('#request-summary').textContent=`Showing ${rows.length} of ${state.requests.length} requests`;
  $('#export').disabled=!rows.length;
  $('#request-table').innerHTML=rows.length?rows.map(r=>`<tr><td><strong>${esc(r.document)}</strong><small>${esc(r.period)} · ${esc(r.service)}</small></td><td>${esc(r.client_name)}</td><td>${esc(prettyDate(r.due_date))}<small>${r.days_overdue?r.days_overdue+' days overdue':r.timing==='Due today'?'Due today':''}</small></td><td>${badge(r.status==='Pending'?r.timing:r.status)}${r.received_date?`<small>Received ${esc(prettyDate(r.received_date))}</small>`:''}</td><td><div class="row-actions">${r.status==='Pending'?`<button data-receive="${r.id}" title="Mark document received">✓ Received</button>`:''}<button data-edit-request="${r.id}">Edit</button><button class="delete" data-delete="${r.id}" aria-label="Delete ${esc(r.document)}">Delete</button></div></td></tr>`).join(''):'<tr><td colspan="5"><div class="empty"><strong>No requests to show.</strong>Add a request or adjust your filters.</div></td></tr>';
}
function renderClients() {
  $('#client-cards').innerHTML=state.clients.length?state.clients.map(c=>`<article class="client-card"><div class="client-initial">${esc(c.name.charAt(0).toUpperCase())}</div><h3>${esc(c.name)}</h3><p>${esc(c.contact||'No contact person')}</p><p>${esc(c.email||'No email added')}</p><div class="client-actions"><button class="text-button" data-edit-client="${c.id}">Edit details</button><button class="text-button" data-remind="${c.id}">Draft reminder ↗</button></div></article>`).join(''):'<div class="empty"><strong>Your clients will appear here.</strong>Choose “Add client” to begin.</div>';
}
function openClient(id) {
  const form=$('#client-form'); form.reset(); form.elements.id.value=''; form.querySelector('.form-error').textContent='';
  const c=state.clients.find(c=>c.id===id);
  $('#client-dialog-title').textContent=c?'Edit client':'Add a client';
  if(c) for(const k of ['id','name','contact','email']) form.elements[k].value=c[k];
  $('#client-dialog').showModal();
}
function openRequest(id) {
  if(!state.clients.length) {toast('Add a client first, then create a document request.'); openClient(); return;}
  const form=$('#request-form'); form.reset(); form.elements.id.value=''; form.querySelector('.form-error').textContent='';
  const r=state.requests.find(r=>r.id===id);
  $('#request-dialog-title').textContent=r?'Edit request':'Create a request';
  if(r) for(const k of ['id','client_id','document','service','period','due_date','status','notes']) form.elements[k].value=r[k];
  else {form.elements.due_date.value=state.today; if($('#client-filter').value) form.elements.client_id.value=$('#client-filter').value;}
  $('#request-dialog').showModal();
}
function clearDraft() {for(const s of ['#draft-to','#draft-subject','#draft-body']) $(s).value='';$('#copy-draft').disabled=true;$('#download-draft').disabled=true;}
async function generateReminder() {
  clearDraft();
  const cid=Number($('#reminder-client').value);
  if(!cid) throw Error('Choose a client to prepare a reminder.');
  const draft=await (await api('/api/reminder',{client_id:cid,tone:$('#reminder-tone').value})).json();
  $('#draft-to').value=draft.to; $('#draft-subject').value=draft.subject; $('#draft-body').value=draft.body;
  $('#copy-draft').disabled=false; $('#download-draft').disabled=false;
}
function draftText() {return `To: ${$('#draft-to').value}\nSubject: ${$('#draft-subject').value}\n\n${$('#draft-body').value}`;}
function download(blob,name) {const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
document.addEventListener('click',async event=>{
  const b=event.target.closest('button'); if(!b) return;
  try {
    if(b.dataset.view) showView(b.dataset.view);
    if(b.dataset.close) $('#'+b.dataset.close).close();
    if(b.dataset.editRequest) openRequest(Number(b.dataset.editRequest));
    if(b.dataset.editClient) openClient(Number(b.dataset.editClient));
    if(b.dataset.clientRequests) {$('#client-filter').value=b.dataset.clientRequests;$('#search').value='';$('#status-filter').value='';renderRequests();showView('requests');}
    if(b.dataset.overdue) {$('#client-filter').value='';$('#search').value='';$('#status-filter').value='Pending';renderRequests();showView('requests');}
    if(b.dataset.remind) {showView('reminders');$('#reminder-client').value=b.dataset.remind;await generateReminder();}
    if(b.dataset.receive) {b.disabled=true;const r=state.requests.find(r=>r.id===Number(b.dataset.receive));await api('/api/request',{...r,status:'Received'});clearDraft();await refresh();toast('Document marked received.');}
    if(b.dataset.delete) {const r=state.requests.find(r=>r.id===Number(b.dataset.delete));if(confirm(`Delete “${r.document}” for ${r.client_name}? This removes the tracking record permanently.`)){await api('/api/delete',{id:r.id});clearDraft();await refresh();toast('Request deleted.');}}
  } catch(e) {error(e.message);b.disabled=false;}
});
$('#new-request').addEventListener('click',()=>openRequest()); $('#new-client').addEventListener('click',()=>openClient());
for(const [formId,path,dialog] of [['#client-form','/api/client','#client-dialog'],['#request-form','/api/request','#request-dialog']]) {
  $(formId).addEventListener('submit',async event=>{
    event.preventDefault();const form=event.target,button=form.querySelector('[type="submit"]');button.disabled=true;
    try {const data=Object.fromEntries(new FormData(form)); data.id=data.id?Number(data.id):null;if('client_id' in data)data.client_id=Number(data.client_id);await api(path,data);$(dialog).close();clearDraft();await refresh();toast(formId==='#client-form'?'Client saved.':'Request saved.');}
    catch(e) {form.querySelector('.form-error').textContent=e.message;}
    finally {button.disabled=false;}
  });
}
$('#load-demo').addEventListener('click',async()=>{const b=$('#load-demo');b.disabled=true;try{await api('/api/demo',{});await refresh();toast('Sample workspace loaded. All names and records are fictional.');}catch(e){error(e.message);}finally{b.disabled=false;}});
for(const sel of ['#search','#client-filter','#status-filter']) $(sel).addEventListener('input',renderRequests);
$('#clear-filters').addEventListener('click',()=>{for(const s of ['#search','#client-filter','#status-filter'])$(s).value='';renderRequests();});
$('#reminder-client').addEventListener('change',clearDraft);$('#reminder-tone').addEventListener('change',clearDraft);
$('#reminder-form').addEventListener('submit',async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{await generateReminder();error('');}catch(err){error(err.message);}finally{b.disabled=false;}});
$('#copy-draft').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(draftText());toast('Reminder copied. Review it before sending.');}catch(e){toast('Clipboard unavailable. Select and copy the text, or download the draft.');}});
$('#download-draft').addEventListener('click',()=>download(new Blob([draftText()],{type:'text/plain;charset=utf-8'}),'CDRT-reminder.txt'));
$('#export').addEventListener('click',async()=>{try{const res=await api('/api/export',{ids:filteredRows().map(r=>r.id)});download(await res.blob(),'CDRT-document-status.csv');toast('Filtered document register exported.');}catch(e){error(e.message);}});
$('#backup-data').addEventListener('click',async()=>{const b=$('#backup-data');b.disabled=true;try{const res=await api('/api/backup',{});download(await res.blob(),`CDRT-backup-${state.today}.sqlite3`);toast('Backup download started. Keep this file private and in a safe place.');}catch(e){error(e.message);}finally{b.disabled=false;}});
refresh().catch(e=>error(e.message));
// Refresh date-based status when returning to the app, including after midnight.
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!document.querySelector('dialog[open]'))refresh().catch(e=>error(e.message));});
