// Techn301 — multi-pages • Version finale (Supabase Storage)
// Build: 2026-02-08T17:14:29.273129Z

const SUPABASE_URL = "https://hcalvcfkwagzkdkkwpau.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjYWx2Y2Zrd2Fnemtka2t3cGF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNDk0NjEsImV4cCI6MjA4NTcyNTQ2MX0.7gP-SgeejLvv02whQ5AdhEXWsIhWja3jb8Bh6kOW_Hg"; // Remplace par la vraie anon key (souvent eyJ...) pour activer Supabase

const isLikelyKey = (typeof SUPABASE_KEY === "string" && (
  SUPABASE_KEY.startsWith("eyJ") ||
  SUPABASE_KEY.startsWith("sb_") ||
  SUPABASE_KEY.startsWith("sb-") ||
  SUPABASE_KEY.startsWith("sb_publishable_")
));

let sb = null;
try{
  if(isLikelyKey && window.supabase) sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}catch(e){}

const MODE = ""; // volontairement simple (pas affiché)


const $ = (id)=>document.getElementById(id);

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function fmtDate(iso){ try{ return new Date(iso).toLocaleString("fr-FR"); }catch{ return iso; } }
function itemHTML(title, meta){
  return `<div class="item"><div class="t">${escapeHtml(title)}</div><div class="m">${escapeHtml(meta||"")}</div></div>`;
}

function setStatus(text, ok=null){
  const tag = $("statusTag");
  if(!tag) return;
  tag.textContent = text;
  tag.style.borderColor = ok===true ? "rgba(43,213,118,.45)" : ok===false ? "rgba(255,77,109,.45)" : "rgba(255,255,255,.10)";
  tag.style.background  = ok===true ? "rgba(43,213,118,.10)" : ok===false ? "rgba(255,77,109,.10)" : "rgba(255,255,255,.04)";
  tag.style.color       = ok===null ? "rgba(168,179,214,.95)" : "rgba(232,238,252,.95)";
}
function showNotice(id, msg, ok=false){
  const el = $(id);
  if(!el) return;
  el.classList.toggle("hidden", !msg);
  el.classList.toggle("ok", !!ok);
  el.textContent = msg || "";
}


  // ---- FICHIERS
  async addFiles(files, owner_email){
    const out = [];
    const list = [...(files||[])];
    for(const f of list){
      // Si Supabase est dispo: upload dans Storage (bucket public "techn301")
      if(sb){
        const id = (crypto.randomUUID ? crypto.randomUUID() : (Date.now()+"_"+Math.random().toString(16).slice(2)));
        const safeName = (f.name||"fichier").replaceAll("..","").replaceAll("/","_").replaceAll("\\","_");
        const path = `uploads/${id}-${safeName}`;
        const { error: upErr } = await sb.storage.from("techn301").upload(path, f, { upsert:false, contentType: f.type || "application/octet-stream" });
        if(upErr) throw upErr;

        // public url (bucket public)
        const { data: pub } = sb.storage.from("techn301").getPublicUrl(path);

        // enregistre meta dans table files_meta si elle existe
        let fileId = null;
        try{
          const { data: ins, error: insErr } = await sb
            .from("files_meta")
            .insert({ owner_email: owner_email||"", name: safeName, mime: f.type||"application/octet-stream", size_bytes: f.size||0, storage_path: path, public_url: pub?.publicUrl || null })
            .select("id")
            .maybeSingle();
          if(insErr) throw insErr;
          fileId = ins?.id || null;
        }catch(_e){
          // si table absente, on renvoie juste le path/url
        }

        out.push({ id: fileId || id, name: safeName, type: f.type||"application/octet-stream", size: f.size||0, created_at: new Date().toISOString(), owner_email: owner_email||"", storage_path: path, public_url: pub?.publicUrl || null });
      }else{
        // Mode standard (navigateur)
        const meta = await idbPutFile(f, owner_email);
        out.push(meta);
      }
    }
    return out;
  },
  async getFileRow(id){
    if(sb){
      // en mode Storage: récupérer meta si possible
      try{
        const { data, error } = await sb.from("files_meta").select("id, name, mime, size_bytes, storage_path, public_url").eq("id", id).maybeSingle();
        if(error) throw error;
        return data || null;
      }catch(_e){
        return null;
      }
    }
    return await idbGetFile(id);
  }
};

// Session
const SESSION_KEY = "t301_session_v2";
function setSession(s){ if(!s) mémoire du navigateur.removeItem(SESSION_KEY); else mémoire du navigateur.setItem(SESSION_KEY, JSON.stringify(s)); }
function getSession(){ const raw=mémoire du navigateur.getItem(SESSION_KEY); if(!raw) return null; try{ return JSON.parse(raw); }catch{ return null; } }

function requireAuth(roles){
  const s = getSession();
  if(!s){ window.location.href = "login.html"; return null; }
  if(roles && !roles.includes(s.role)){ window.location.href = "login.html"; return null; }
  return s;
}

function mountHeaderUser(){
  const s = getSession();
  if($("who")) $("who").textContent = s ? s.email : "Déconnecté";
  if($("roleTxt")) $("roleTxt").textContent = s ? s.role : "—";
  if($("modeTxt")) $("modeTxt").textContent = api.mode;
}

function mountNav(active){
  const nav = $("nav");
  if(!nav) return;
  const s = getSession();
  const links = [];
  const push = (href,label,key,roles)=>{
    if(!s) return;
    if(roles && !roles.includes(s.role)) return;
    links.push({href,label,key});
  };
  push("dashboard.html","Dashboard","dashboard",["admin","prof"]);
  push("codes.html","Codes","codes",["admin","prof"]);
  push("npunitions.html","NPunitions","np",["admin","prof"]);
  push("notes.html","Notes","notes",["admin","prof"]);
  push("sanctions.html","Sanctions","sanctions",["admin","prof"]);
  push("classes.html","Classes","classes",["admin"]);
  push("matieres.html","Matières","matieres",["admin"]);
  push("devoirs.html","Devoirs","devoirs",["admin","prof","student"]);
  push("messages.html","Messagerie","msg",["admin","prof","student"]);
  push("student.html","Mon espace","student",["student"]);
  nav.innerHTML = links.map(l=>`<a href="${l.href}" class="${l.key===active?'active':''}">${l.label}</a>`).join("");
}

async function fillStudentsSelect(selectId){
  const sel = $(selectId);
  if(!sel) return [];
  const students = await api.getStudents();
  sel.innerHTML = `<option value="">— Choisir —</option>` + students.map(s => `<option value="${s.id}">${escapeHtml(s.first_name)} ${escapeHtml(s.last_name)}</option>`).join("");
  return students;
}

async function login(email, code){
  try{
    const acc = await api.getAccount(email, code);
    if(!acc) return {ok:false, error:"Email ou code incorrect."};
    const s = {email: acc.email, role: acc.role, student_id: acc.student_id};
    setSession(s);
    return {ok:true, session:s};
  }catch(e){
    return {ok:false, error:(e && (e.message||e.error_description)) ? (e.message||e.error_description) : String(e)};
  }
}
function resetDemo(){
  try{ mémoire du navigateur.removeItem(DATA_KEY); }catch(e){}
  try{ mémoire du navigateur.removeItem(SESSION_KEY); }catch(e){}
}
function logout(){
  mémoire du navigateur.removeItem(SESSION_KEY);
  window.location.href = "login.html";
}
function mountLogout(){
  const btn = $("btnLogout");
  if(btn) btn.onclick = logout;
}
function initCommon(active){
  mountHeaderUser();
  mountNav(active);
  mountLogout();
  if($("modeTxt")) $("modeTxt").textContent = api.mode;
}

// Pages
async function pageDashboard(){
  const s = requireAuth(["admin","prof"]); if(!s) return;
  mountHeaderUser(); mountNav("dashboard"); mountLogout();

  if($("meEmail")) $("meEmail").textContent = s.email;
  if($("meRole")) $("meRole").textContent = s.role;

  const grades = await api.listGrades({student_id:null, onlyPublished:false});
  const evs    = await api.listDiscipline({student_id:null, onlyPublished:false});
  let gd=0,gp=0, nd=0,np=0, sd=0,sp=0;
  for(const g of grades) (g.published?gp++:gd++);
  for(const e of evs){
    if(e.type==="NPunitions") (e.published?np++:nd++);
    else (e.published?sp++:sd++);
  }
  $("kpiBox").innerHTML = `
    <div class="k"><div class="label">NPunitions — brouillons</div><div class="val">${nd}</div></div>
    <div class="k"><div class="label">NPunitions — publiés</div><div class="val">${np}</div></div>
    <div class="k"><div class="label">Notes — brouillons</div><div class="val">${gd}</div></div>
    <div class="k"><div class="label">Notes — publiées</div><div class="val">${gp}</div></div>
    <div class="k"><div class="label">Sanctions — brouillons</div><div class="val">${sd}</div></div>
    <div class="k"><div class="label">Sanctions — publiées</div><div class="val">${sp}</div></div>
  `;
  setStatus("✅ Dashboard à jour", true);

  if($("btnPublish")) $("btnPublish").onclick = async ()=>{
    const n = await api.publishGrades();
    showNotice("publishInfo", `✅ Publication : ${n} note(s).`, true);
    setStatus("✅ Notes publiées", true);
    await pageDashboard();
  };
  if($("btnPublishAll")) $("btnPublishAll").onclick = async ()=>{
    const r = await api.publishAll();
    showNotice("publishInfo", `✅ Tout publié : ${r.grades} note(s) + ${r.events} événement(s).`, true);
    setStatus("✅ Tout publié", true);
    await pageDashboard();
  };
}

async function pageCodes(){
  const s = requireAuth(["admin","prof"]); if(!s) return;
  mountHeaderUser(); mountNav("codes"); mountLogout();

  $("btnLoadCodes").onclick = async ()=>{
    const students = await api.getStudents();
    const emails = students.map(x=>x.email);
    const acc = await api.getAccountsByEmails(emails);
    const map = new Map(acc.map(a=>[a.email, a.code]));
    $("codesBox").innerHTML = students.map(st => {
      const code = map.get(st.email) || "????";
      return `<div class="item"><div class="t">${escapeHtml(st.first_name)} ${escapeHtml(st.last_name)}</div>
        <div class="m"><span class="mono">${escapeHtml(st.email)}</span> — code: <b class="mono">${escapeHtml(code)}</b></div></div>`;
    }).join("");
    setStatus("✅ Codes chargés", true);
  };

  $("btnCopyCodes").onclick = async ()=>{
    const items = [...$("codesBox").querySelectorAll(".item")];
    if(!items.length) return setStatus("⚠️ Rien à copier", false);
    const lines = items.map(it => it.innerText.replace(/\s+/g," ").trim());
    const txt = "TECHN301 — Codes provisoires\n\n" + lines.join("\n");
    try{ await navigator.clipboard.writeText(txt); setStatus("✅ Copié", true); }
    catch{ setStatus("⚠️ Clipboard bloqué", false); }
  };
}

async function pageNP(){
  const s = requireAuth(["admin","prof"]); if(!s) return;
  mountHeaderUser(); mountNav("np"); mountLogout();

  await fillStudentsSelect("npStudent");
  $("npList").innerHTML = itemHTML("Choisis un élève","Puis clique “Voir historique”.");
  $("npScore").textContent = "—";

  async function computeNpScore(studentId, onlyPublished){
    const rows = await api.listDiscipline({student_id:studentId, type:"NPunitions", onlyPublished:!!onlyPublished});
    const sum = (rows||[]).reduce((t,r)=>t+(Number(r.points_delta)||0),0);
    const score = Math.max(0, Math.min(20, 20 + sum));
    return {score, count: rows.length};
  }

  async function loadHistory(){
    const sid = Number($("npStudent").value||"0");
    if(!sid) return setStatus("⚠️ Choisis un élève", false);
    const rows = await api.listDiscipline({student_id:sid, type:"NPunitions", onlyPublished:false});
    const {score} = await computeNpScore(sid,false);
    $("npScore").textContent = score.toFixed(1)+" / 20";
    $("npList").innerHTML = rows.length ? rows.map(e=>{
      const st = e.published ? "Publié" : "Brouillon";
      const badge = e.published ? "✅" : "📝";
      const delta = Number(e.points_delta)||0;
      const dTxt = delta < 0 ? `${delta} pt` : `+${delta} pt`;
      return itemHTML(`${badge} ${e.reason} — ${dTxt}`, `${fmtDate(e.created_at)} • ${st} • ${e.detail||""} • ${e.author}`);
    }).join("") : itemHTML("Aucune NPunition","Départ 20/20 👍");
    setStatus("✅ Historique chargé", true);
  }

  $("btnNpLoad").onclick = loadHistory;

  $("btnNpAdd").onclick = async ()=>{
    const sid = Number($("npStudent").value||"0");
    if(!sid) return setStatus("⚠️ Choisis un élève", false);
    const minus = Number(($("npMinus").value||"").trim().replace(",","."));
    if(!Number.isFinite(minus) || minus<=0) return setStatus("⚠️ Points invalides", false);

    await api.insertDiscipline({
      student_id:sid, type:"NPunitions", reason:$("npReason").value,
      detail:($("npDetail").value||"").trim(),
      points_delta:-Math.abs(Math.round(minus*10)/10),
      minutes:null, author:s.email, published:false
    });
    $("npMinus").value=""; $("npDetail").value="";
    await loadHistory();
    setStatus("✅ NPunition ajoutée (brouillon)", true);
  };
}

async function pageNotes(){
  const s = requireAuth(["admin","prof"]); if(!s) return;
  mountHeaderUser(); mountNav("notes"); mountLogout();

  await fillStudentsSelect("gStudent");
  $("gradesList").innerHTML = itemHTML("Choisis un élève","Puis clique “Voir notes”.");

  async function loadGrades(){
    const sid = Number($("gStudent").value||"0");
    if(!sid) return setStatus("⚠️ Choisis un élève", false);
    const rows = await api.listGrades({student_id:sid, onlyPublished:false});
    $("gradesList").innerHTML = rows.length ? rows.map(g=>{
      const st = g.published ? "Publié" : "Brouillon";
      const badge = g.published ? "✅" : "📝";
      const kind = g.kind === "eval" ? "Éval" : "Devoir";
      const val = `${Number(g.score).toFixed(1)} / ${Number(g.out_of).toFixed(1)}`;
      return itemHTML(`${badge} ${kind} — ${g.title} — ${val}`, `${fmtDate(g.created_at)} • ${st} • ${g.author}`);
    }).join("") : itemHTML("Aucune note","Crée une note à gauche.");
    setStatus("✅ Notes chargées", true);
  }
  $("btnGradesLoad").onclick = loadGrades;

  $("btnGradeAdd").onclick = async ()=>{
    const sid = Number($("gStudent").value||"0");
    if(!sid) return setStatus("⚠️ Choisis un élève", false);

    const title = ($("gTitle").value||"").trim();
    if(!title) return setStatus("⚠️ Titre manquant", false);

    const score = Number(($("gScore").value||"").replace(",","."));
    const outOf = Number(($("gOutOf").value||"20").replace(",","."));
    if(!Number.isFinite(score) || !Number.isFinite(outOf) || outOf<=0) return setStatus("⚠️ Note invalide", false);

    await api.insertGrade({
      student_id:sid, kind:$("gKind").value, title,
      score, out_of:outOf, author:s.email, published:false
    });

    $("gTitle").value=""; $("gScore").value="";
    await loadGrades();
    setStatus("✅ Note créée (brouillon)", true);
  };
}

async function pageSanctions(){
  const s = requireAuth(["admin","prof"]); if(!s) return;
  mountHeaderUser(); mountNav("sanctions"); mountLogout();

  await fillStudentsSelect("dStudent");
  $("disList").innerHTML = itemHTML("Choisis un élève","Puis clique “Voir sanctions”.");

  async function loadDis(){
    const sid = Number($("dStudent").value||"0");
    if(!sid) return setStatus("⚠️ Choisis un élève", false);
    const rows = await api.listDiscipline({student_id:sid, notType:"NPunitions", onlyPublished:false});
    $("disList").innerHTML = rows.length ? rows.map(d=>{
      const st = d.published ? "Publié" : "Brouillon";
      const badge = d.published ? "✅" : "📝";
      const mins = d.minutes ? ` • ${d.minutes} min` : "";
      const pts  = d.points_delta ? ` • ${d.points_delta} pt` : "";
      return itemHTML(`${badge} ${d.type}${mins}${pts}`, `${fmtDate(d.created_at)} • ${st} • ${d.detail||""} • ${d.author}`);
    }).join("") : itemHTML("Aucune sanction","Rien pour l’instant.");
    setStatus("✅ Sanctions chargées", true);
  }
  $("btnDisLoad").onclick = loadDis;

  $("btnDisAdd").onclick = async ()=>{
    const sid = Number($("dStudent").value||"0");
    if(!sid) return setStatus("⚠️ Choisis un élève", false);

    const dtype = $("dType").value;
    const detail = ($("dText").value||"").trim();

    const minutesRaw = ($("dMinutes").value||"").trim();
    const minutes = minutesRaw ? Number(minutesRaw) : null;
    if(minutesRaw && (!Number.isFinite(minutes) || minutes<=0)) return setStatus("⚠️ Minutes invalides", false);

    const minusRaw = ($("dMinus").value||"").trim();
    let pointsDelta = 0;
    if(minusRaw){
      const m = Number(minusRaw.replace(",","."));
      if(!Number.isFinite(m) || m<=0) return setStatus("⚠️ Points invalides", false);
      pointsDelta = -Math.abs(Math.round(m*10)/10);
    }

    await api.insertDiscipline({
      student_id:sid, type:dtype, reason:dtype, detail,
      minutes, points_delta: pointsDelta,
      author:s.email, published:false
    });

    if(pointsDelta !== 0){
      await api.insertDiscipline({
        student_id:sid, type:"NPunitions", reason:dtype,
        detail: detail ? ("(lié à sanction) " + detail) : "(lié à sanction)",
        minutes:null, points_delta: pointsDelta,
        author:s.email, published:false
      });
    }

    $("dText").value=""; $("dMinutes").value=""; $("dMinus").value="";
    await loadDis();
    setStatus("✅ Sanction créée (brouillon)", true);
  };
}

async function pageStudent(){
  const s = requireAuth(["student"]); if(!s) return;
  mountHeaderUser(); mountNav("student"); mountLogout();
  $("myEmail").textContent = s.email;

  async function computeNpScore(onlyPublished){
    const rows = await api.listDiscipline({student_id:s.student_id, type:"NPunitions", onlyPublished:!!onlyPublished});
    const sum = (rows||[]).reduce((t,r)=>t+(Number(r.points_delta)||0),0);
    const score = Math.max(0, Math.min(20, 20 + sum));
    return {score, count: rows.length};
  }

  async function refresh(){
    const {score,count} = await computeNpScore(true);
    $("myNpScore").textContent = score.toFixed(1)+" / 20";
    $("myNpMeta").textContent = `${count} retrait(s) publié(s).`;

    const grades = await api.listGrades({student_id:s.student_id, onlyPublished:true});
    $("myGrades").innerHTML = grades.length ? grades.map(g=>{
      const kind = g.kind === "eval" ? "Éval" : "Devoir";
      return itemHTML(`${kind} — ${g.title} — ${Number(g.score).toFixed(1)} / ${Number(g.out_of).toFixed(1)}`, fmtDate(g.created_at));
    }).join("") : itemHTML("Aucune note publiée","Attends la publication.");

    const dis = await api.listDiscipline({student_id:s.student_id, notType:"NPunitions", onlyPublished:true});
    $("myDis").innerHTML = dis.length ? dis.map(d=>{
      const mins = d.minutes ? ` • ${d.minutes} min` : "";
      return itemHTML(`${d.type}${mins}`, `${fmtDate(d.created_at)} • ${d.detail||""}`);
    }).join("") : itemHTML("Aucune sanction publiée","Tout va bien ✅");

    $("myKpi").innerHTML = `
      <div class="k"><div class="label">Notes publiées</div><div class="val">${grades.length}</div></div>
      <div class="k"><div class="label">Sanctions publiées</div><div class="val">${dis.length}</div></div>
      <div class="k"><div class="label">NPunitions</div><div class="val">${score.toFixed(1)}</div></div>
    `;
    setStatus("✅ Espace élève à jour", true);
  }

  $("btnMyRefresh").onclick = refresh;
  await refresh();
}



// --------------------
// Pages (v3) : Classes / Devoirs / Messagerie
// --------------------


async function pageMatieres(){
  initCommon("matieres");
  const s = getSession();
  if(!s || s.role!=="admin"){ location.href="login.html"; return; }

  const subjName = $("subjName");
  const btnAddSubj = $("btnAddSubj");
  const listSubj = $("subjectsList");

  const selClass = $("msClass");
  const selSubj = $("msSubject");
  const btnLinkCS = $("btnLinkCS");

  const selProf = $("msProf");
  const selSubj2 = $("msSubject2");
  const btnLinkTS = $("btnLinkTS");

  async function refresh(){
    const subjects = await api.getSubjects();
    listSubj.innerHTML = subjects.length ? subjects.map(s=>itemHTML(s.name, `ID: ${s.id}`)).join("") : itemHTML("Aucune matière", "Crée une matière.");

    selSubj.innerHTML = `<option value="">— Choisir —</option>` + subjects.map(x=>`<option value="${x.id}">${escapeHtml(x.name)}</option>`).join("");
    selSubj2.innerHTML = `<option value="">— Choisir —</option>` + subjects.map(x=>`<option value="${x.id}">${escapeHtml(x.name)}</option>`).join("");

    const classes = await api.getClasses();
    selClass.innerHTML = `<option value="">— Choisir —</option>` + classes.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");

    const profs = await api.getTeachers();
    selProf.innerHTML = `<option value="">— Choisir —</option>` + profs.map(e=>`<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join("");

    setStatus("✅ Matières à jour", true);
  }

  btnAddSubj.onclick = async ()=>{
    try{
      showNotice("notice","",false);
      await api.createSubject(subjName.value);
      subjName.value="";
      await refresh();
      setStatus("✅ Matière créée", true);
    }catch(e){
      console.error(e);
      setStatus("❌ Erreur", false);
      showNotice("notice", e.message||"Erreur.", false);
    }
  };

  btnLinkCS.onclick = async ()=>{
    const cid = Number(selClass.value||0);
    const sid = Number(selSubj.value||0);
    if(!cid || !sid) return setStatus("⚠️ Choisis classe + matière", false);
    await api.linkClassSubject(cid, sid);
    setStatus("✅ Classe liée", true);
  };

  btnLinkTS.onclick = async ()=>{
    const em = selProf.value;
    const sid = Number(selSubj2.value||0);
    if(!em || !sid) return setStatus("⚠️ Choisis prof + matière", false);
    await api.linkTeacherSubject(em, sid);
    setStatus("✅ Prof lié", true);
  };

  await refresh();
}

async function pageClasses(){
  initCommon("classes");
  const s = getSession();
  if(!s || s.role!=="admin"){ location.href="login.html"; return; }

  const nameIn = $("className");
  const btnAdd = $("btnAddClass");
  const list = $("classesList");
  const selStudent = $("classStudent");
  const selClass = $("classSelect");
  const btnAssign = $("btnAssignClass");

  async function refresh(){
    try{
      const classes = await api.getClasses();
      list.innerHTML = classes.map(c=>itemHTML(c.name, `ID: ${c.id}`)).join("") || itemHTML("Aucune classe", "Crée une classe ci-dessus.");

      // fill selects
      selClass.innerHTML = `<option value="">— Choisir —</option>` + classes.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");

      const students = await api.getStudents();
      selStudent.innerHTML = `<option value="">— Choisir —</option>` + students.map(st=>`<option value="${st.id}">${escapeHtml(st.first_name)} ${escapeHtml(st.last_name)}</option>`).join("");

      setStatus("✅ Classes à jour", true);
    }catch(e){
      console.error(e);
      setStatus("❌ Classes: erreur", false);
      showNotice("notice", (e && e.message) ? e.message : "Erreur.");
    }
  }

  btnAdd.onclick = async ()=>{
    try{
      showNotice("notice","",false);
      await api.createClass(nameIn.value);
      nameIn.value="";
      await refresh();
      setStatus("✅ Classe créée", true);
    }catch(e){
      console.error(e);
      setStatus("❌ Création: erreur", false);
      showNotice("notice", e.message||"Erreur.", false);
    }
  };

  btnAssign.onclick = async ()=>{
    const sid = Number(selStudent.value||0);
    const cid = Number(selClass.value||0);
    if(!sid || !cid) return setStatus("⚠️ Choisis élève + classe", false);
    try{
      showNotice("notice","",false);
      await api.setStudentClass(sid, cid);
      setStatus("✅ Élève assigné", true);
    }catch(e){
      console.error(e);
      setStatus("❌ Assignation: erreur", false);
      showNotice("notice", e.message||"Erreur.", false);
    }
  };

  await refresh();
}

async function pageDevoirs(){
  initCommon("devoirs");
  const s = getSession();
  if(!s){ location.href="login.html"; return; }

  const whoCanCreate = (s.role==="admin" || s.role==="prof");

  const selClass = $("assClass");
  const title = $("assTitle");
  const detail = $("assDetail");
  const due = $("assDue");
  const pub = $("assPublished");
  const btnCreate = $("btnCreateAssignment");
  const btnPublishAll = $("btnPublishAssignments");
  const list = $("assList");

  const myBox = $("myAssList");
  const subText = $("subText");
  const subFiles = $("subFiles");
  const btnSubmit = $("btnSubmit");
  const preview = $("subPreview");

  async function fillClassSelect(){
    const classes = await api.getClasses();
    selClass.innerHTML = `<option value="">— Choisir —</option>` + classes.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  }

  async function refreshProf(){
    const cid = Number(selClass.value||0) || null;
    const items = await api.listAssignments({class_id: cid, onlyPublished:false});
    const withCounts = [];
    for(const a of items){
      let n=0;
      try{ n = (await api.listSubmissions({assignment_id:a.id})).length; }catch{}
      withCounts.push({a,n});
    }
    list.innerHTML = withCounts.length ? withCounts.map(({a,n})=>{
      const st = a.published ? "✅ Publié" : "📝 Brouillon";
      const dueTxt = a.due_at ? ("• pour le " + fmtDate(a.due_at)) : "• sans date";
      return itemHTML(`${st} — ${a.title}`, `Classe #${a.class_id} ${dueTxt} • ${n} rendu(s) • ${a.author}`);
    }).join("") : itemHTML("Aucun devoir", "Crée un devoir à gauche.");
  }

  async function refreshStudent(){
    const classId = await api.getStudentClassId(s.student_id);
    const items = await api.listAssignments({class_id: classId, onlyPublished:true});
    myBox.innerHTML = items.length ? items.map(a=>{
      const dueTxt = a.due_at ? ("Pour le " + fmtDate(a.due_at)) : "Sans date limite";
      return `<div class="item">
        <div class="t">${escapeHtml(a.title)}</div>
        <div class="m">${escapeHtml(dueTxt)} • ${escapeHtml(a.detail||"")}</div>
        <div class="row" style="margin-top:8px">
          <span class="tag">ID: <b class="mono">${a.id}</b></span>
          <button class="primary" data-ass="${a.id}">Rendre</button>
        </div>
      </div>`;
    }).join("") : itemHTML("Aucun devoir publié", "Attends que le prof publie.");

    myBox.querySelectorAll("button[data-ass]").forEach(b=>{
      b.onclick=()=>{
        const id = Number(b.getAttribute("data-ass"));
        $("assId").value = id;
        window.scrollTo({top:document.body.scrollHeight, behavior:"smooth"});
      };
    });
  }

  // file preview
  subFiles.onchange = ()=>{
    const files=[...subFiles.files||[]];
    preview.innerHTML = files.length ? files.map(f=>itemHTML(f.name, `${Math.round((f.size||0)/1024)} KB • ${f.type||"fichier"}`)).join("") : itemHTML("Aucun fichier", "Tu peux joindre une photo/vidéo.");
  };

  if(whoCanCreate){
    $("profZone").classList.remove("hidden");
    $("studentZone").classList.add("hidden");
    await fillClassSelect();
    await refreshProf();

    btnCreate.onclick = async ()=>{
      try{
        showNotice("notice","",false);
        const cid = Number(selClass.value||0);
        if(!cid) return setStatus("⚠️ Choisis une classe", false);
        await api.createAssignment({
          class_id: cid,
          title: title.value,
          detail: detail.value,
          due_at: due.value ? new Date(due.value).toISOString() : null,
          published: !!pub.checked,
          author: s.email
        });
        title.value=""; detail.value=""; due.value=""; pub.checked=false;
        await refreshProf();
        setStatus("✅ Devoir créé", true);
      }catch(e){
        console.error(e);
        setStatus("❌ Création: erreur", false);
        showNotice("notice", e.message||"Erreur.", false);
      }
    };

    btnPublishAll.onclick = async ()=>{
      try{
        const n = await api.publishAssignmentsAll();
        await refreshProf();
        setStatus(`✅ ${n} devoir(s) publié(s)`, true);
      }catch(e){
        console.error(e);
        setStatus("❌ Publication: erreur", false);
        showNotice("notice", e.message||"Erreur.", false);
      }
    };

    selClass.onchange = refreshProf;

  }else{
    $("profZone").classList.add("hidden");
    $("studentZone").classList.remove("hidden");
    await refreshStudent();

    btnSubmit.onclick = async ()=>{
      const assId = Number($("assId").value||0);
      if(!assId) return setStatus("⚠️ Choisis un devoir (bouton Rendre)", false);
      try{
        showNotice("notice2","",false);
        const filesMeta = await api.addFiles([...subFiles.files||[]], s.email);
        await api.submitAssignment({
          assignment_id: assId,
          student_id: s.student_id,
          text: subText.value,
          files_meta: filesMeta
        });
        subText.value=""; subFiles.value=""; preview.innerHTML = itemHTML("Envoyé ✅", "Ton rendu a été enregistré.");
        setStatus("✅ Rendu envoyé", true);
      }catch(e){
        console.error(e);
        setStatus("❌ Envoi: erreur", false);
        showNotice("notice2", e.message||"Erreur.", false);
      }
    };
  }
}

async function pageMessages(){
  initCommon("msg");
  const s = getSession();
  if(!s){ location.href="login.html"; return; }

  const toType = $("msgToType");
  const toValue = $("msgToValue");
  const text = $("msgText");
  const files = $("msgFiles");
  const btnSend = $("btnSendMsg");
  const list = $("msgList");
  const preview = $("msgPreview");

  async function fillTargets(){
    const classes = await api.getClasses();
    const teachers = await api.getTeachers();

    function fillDirect(){
      toValue.innerHTML = `<option value="">— Choisir —</option>` +
        teachers.map(e=>`<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join("");
    }
    function fillClass(){
      toValue.innerHTML = `<option value="">— Choisir —</option>` +
        classes.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
    }

    if(toType.value==="direct") fillDirect();
    else fillClass();
  }

  files.onchange = ()=>{
    const fs=[...files.files||[]];
    preview.innerHTML = fs.length ? fs.map(f=>itemHTML(f.name, `${Math.round((f.size||0)/1024)} KB • ${f.type||"fichier"}`)).join("") : itemHTML("Aucun fichier", "Tu peux joindre une photo/vidéo.");
  };

  async function render(){
    try{
      const msgs = await api.listMessagesForSession(s);
      // render as chat bubbles
      list.innerHTML = msgs.length ? msgs.map(m=>{
        const mine = m.from_email===s.email;
        const who = mine ? "Moi" : m.from_email;
        const target = m.to_type==="direct" ? ("→ " + m.to_value) : ("→ classe #" + m.to_value);
        const filesTxt = (m.file_ids||[]).length ? ` • ${m.file_ids.length} fichier(s)` : "";
        return `<div class="bubble ${mine?'mine':'other'}">
          <div class="meta">${escapeHtml(who)} <span class="ghost">${escapeHtml(target)}</span> • ${escapeHtml(fmtDate(m.created_at))}${escapeHtml(filesTxt)}</div>
          <div class="body">${escapeHtml(m.text||"")}</div>
          ${(m.file_ids||[]).length ? `<div class="files">${m.file_ids.map(id=>`<button class="filebtn" data-file="${id}">Ouvrir fichier</button>`).join("")}</div>` : ""}
        </div>`;
      }).join("") : itemHTML("Aucun message", "Envoie le premier message.");

      // file open
      list.querySelectorAll("button[data-file]").forEach(b=>{
        b.onclick = async ()=>{
          const id = b.getAttribute("data-file");
          const row = await api.getFileRow(id);
          if(!row || !row.blob){ return setStatus("⚠️ Fichier introuvable", false); }
          if(row.public_url){ window.open(row.public_url, "_blank"); return; }
          const url = URL.createObjectURL(row.blob);
          window.open(url, "_blank");
          setTimeout(()=>URL.revokeObjectURL(url), 20000);
        };
      });

      // scroll bottom
      list.scrollTop = list.scrollHeight;
      setStatus("✅ Messagerie à jour", true);
    }catch(e){
      console.error(e);
      setStatus("❌ Messagerie: erreur", false);
      showNotice("notice", e.message||"Erreur.", false);
    }
  }

  toType.onchange = fillTargets;

  btnSend.onclick = async ()=>{
    try{
      showNotice("notice","",false);
      const tt = toType.value;
      const tv = toValue.value;
      if(!tt || !tv) return setStatus("⚠️ Choisis un destinataire", false);

      const filesMeta = await api.addFiles([...files.files||[]], s.email);
      await api.sendMessage({
        from_email: s.email,
        from_role: s.role,
        from_student_id: s.student_id,
        to_type: tt,
        to_value: tt==="class" ? Number(tv) : tv,
        text: text.value,
        files_meta: filesMeta
      });

      text.value=""; files.value=""; preview.innerHTML=itemHTML("Envoyé ✅","Message envoyé.");
      await render();
      setStatus("✅ Envoyé", true);
    }catch(e){
      console.error(e);
      setStatus("❌ Envoi: erreur", false);
      showNotice("notice", e.message||"Erreur.", false);
    }
  };

  await fillTargets();
  await render();

  // Auto refresh light
  setInterval(()=>{ render().catch(()=>{}); }, 3000);
}
window.T301 = {
  MODE,
  initCommon,
  login,
  resetDemo,
  logout,
  setStatus,
  showNotice,
  pageDashboard,
  pageCodes,
  pageNP,
  pageNotes,
  pageSanctions,
  pageStudent,
  pageClasses,
  pageDevoirs,
  pageMessages,
  pageMatieres
};
