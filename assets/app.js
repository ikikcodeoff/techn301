// TECHN301 — app.js (version stable, simple, multi-pages)
// HTML/CSS/JS + Supabase (clé publishable) — projet Techno

// 1) Mets tes infos Supabase ici :
const SUPABASE_URL = "https://hcalvcfkwagzkdkkwpau.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjYWx2Y2Zrd2Fnemtka2t3cGF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNDk0NjEsImV4cCI6MjA4NTcyNTQ2MX0.7gP-SgeejLvv02whQ5AdhEXWsIhWja3jb8Bh6kOW_Hg";

// 2) Client Supabase
let sb = null;
try{
  const okKey = typeof SUPABASE_KEY === "string" && (
    SUPABASE_KEY.startsWith("sb_publishable_") ||
    SUPABASE_KEY.startsWith("sb_") ||
    SUPABASE_KEY.startsWith("sb-") ||
    SUPABASE_KEY.startsWith("eyJ")
  );
  if(okKey && window.supabase) sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}catch(e){}

const $ = (id)=>document.getElementById(id);
const SESSION_KEY = "t301_session";

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function setStatus(text, ok=null){
  const tag = $("statusTag");
  if(!tag) return;
  tag.textContent = text || "";
  if(ok === true){
    tag.style.borderColor = "rgba(43,213,118,.45)";
    tag.style.background = "rgba(43,213,118,.10)";
    tag.style.color = "rgba(232,238,252,.95)";
  }else if(ok === false){
    tag.style.borderColor = "rgba(255,77,109,.45)";
    tag.style.background = "rgba(255,77,109,.10)";
    tag.style.color = "rgba(232,238,252,.95)";
  }else{
    tag.style.borderColor = "rgba(255,255,255,.10)";
    tag.style.background = "rgba(255,255,255,.04)";
    tag.style.color = "rgba(168,179,214,.95)";
  }
}

function showNotice(id, msg, ok=false){
  const box = $(id);
  if(!box) return;
  if(!msg){
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }
  box.classList.remove("hidden");
  box.innerHTML = (ok ? "✅ " : "⚠️ ") + escapeHtml(msg);
}

function getSession(){
  try{
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch{ return null; }
}
function setSession(s){
  if(!s) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

function requireSb(){
  if(!sb) throw new Error("Connexion à la base impossible. Vérifie URL/clé Supabase + ouverture en HTTPS (GitHub Pages).");
}

async function login(email, code){
  requireSb();
  const em = String(email||"").trim().toLowerCase();
  const cd = String(code||"").trim();
  if(!em || !/^[0-9]{4}$/.test(cd)) throw new Error("Email + code (4 chiffres) requis.");

  const { data, error } = await sb
    .from("accounts")
    .select("email, role, student_id, provisional")
    .eq("email", em)
    .eq("code", cd)
    .maybeSingle();
  if(error) throw error;
  if(!data) throw new Error("Email ou code incorrect.");

  const s = { email: data.email, role: data.role, student_id: data.student_id || null };
  setSession(s);
  return s;
}

function logout(){
  setSession(null);
  location.href = "login.html";
}

// Nav simple (centré)
const NAV = [
  {href:"dashboard.html", label:"Dashboard", roles:["admin","prof"]},
  {href:"classes.html", label:"Classes", roles:["admin"]},
  {href:"matieres.html", label:"Matières", roles:["admin"]},
  {href:"devoirs.html", label:"Devoirs", roles:["admin","prof","student"]},
  {href:"messages.html", label:"Messages", roles:["admin","prof","student"]},
  {href:"notes.html", label:"Notes", roles:["admin","prof","student"]},
  {href:"npunitions.html", label:"NPunitions", roles:["admin","prof","student"]},
  {href:"sanctions.html", label:"Sanctions", roles:["admin","prof","student"]},
];

function mountNav(activeKey){
  const nav = $("nav");
  if(!nav) return;
  const s = getSession();
  nav.innerHTML = "";
  if(!s) return;
  for(const it of NAV){
    if(!it.roles.includes(s.role)) continue;
    const a = document.createElement("a");
    a.href = it.href;
    a.className = "chip" + (activeKey && it.href.startsWith(activeKey) ? " active" : "");
    a.textContent = it.label;
    nav.appendChild(a);
  }
}

async function initCommon(active){
  const s = getSession();
  const who = $("who"); if(who) who.textContent = s ? s.email : "Déconnecté";
  const roleTxt = $("roleTxt"); if(roleTxt) roleTxt.textContent = s ? s.role : "—";
  const modeTxt = $("modeTxt"); if(modeTxt) modeTxt.textContent = ""; // pas de terme compliqué
  mountNav(active || "");
  const btnLogout = $("btnLogout");
  if(btnLogout) btnLogout.onclick = logout;
  return s;
}

// ---- Helpers UI list
function itemHTML(title, meta){
  return `<div class="item"><div class="t">${escapeHtml(title)}</div><div class="m">${escapeHtml(meta||"")}</div></div>`;
}
function fmtDate(iso){
  try{ return new Date(iso).toLocaleString("fr-FR"); }catch{ return iso; }
}

// ---- PAGES (simple, pas de crash si un bloc manque)
async function pageLogin(){
  setStatus("📝 Prêt", null);
  const btn = $("btnLogin");
  if(btn){
    btn.onclick = async ()=>{
      try{
        showNotice("loginError","",false);
        const s = await login($("loginEmail")?.value, $("loginCode")?.value);
        setStatus("✅ Connecté", true);
        location.href = (s.role === "student") ? "student.html" : "dashboard.html";
      }catch(e){
        console.error(e);
        setStatus("❌ Connexion impossible", false);
        showNotice("loginError", e.message || "Erreur.", false);
      }
    };
  }
}

// Dashboard: juste compter brouillons/publiés si éléments présents
async function pageDashboard(){
  const s = await initCommon("dashboard");
  if(!s) return location.href="login.html";
  if(!(s.role==="admin"||s.role==="prof")) return location.href="student.html";
  requireSb();

  try{
    const kpi = $("kpiBox");
    if(!kpi) return;

    const { data: g } = await sb.from("grades").select("published");
    const { data: d } = await sb.from("discipline_events").select("published,type");
    const grades = {draft:0,pub:0}; (g||[]).forEach(x=>x.published?grades.pub++:grades.draft++);
    const np = {draft:0,pub:0}; const sanc = {draft:0,pub:0};
    (d||[]).forEach(x=>{
      const b = (x.type==="NPunitions") ? np : sanc;
      x.published ? b.pub++ : b.draft++;
    });

    kpi.innerHTML = `
      <div class="k"><div class="label">NPunitions (brouillons)</div><div class="val">${np.draft}</div></div>
      <div class="k"><div class="label">NPunitions (publiés)</div><div class="val">${np.pub}</div></div>
      <div class="k"><div class="label">Notes (brouillons)</div><div class="val">${grades.draft}</div></div>
      <div class="k"><div class="label">Notes (publiées)</div><div class="val">${grades.pub}</div></div>
      <div class="k"><div class="label">Sanctions (brouillons)</div><div class="val">${sanc.draft}</div></div>
      <div class="k"><div class="label">Sanctions (publiées)</div><div class="val">${sanc.pub}</div></div>
    `;
    setStatus("✅ Dashboard à jour", true);
  }catch(e){
    console.error(e);
    setStatus("❌ Dashboard: erreur base", false);
  }
}

// Placeholder pages: évite les crashs
async function pageClasses(){ await initCommon("classes"); if(!getSession()) location.href="login.html"; }
async function pageMatieres(){ await initCommon("matieres"); if(!getSession()) location.href="login.html"; }
async function pageDevoirs(){ await initCommon("devoirs"); if(!getSession()) location.href="login.html"; }
async function pageMessages(){ await initCommon("messages"); if(!getSession()) location.href="login.html"; }
async function pageNotes(){ await initCommon("notes"); if(!getSession()) location.href="login.html"; }
async function pageNP(){ await initCommon("npunitions"); if(!getSession()) location.href="login.html"; }
async function pageSanctions(){ await initCommon("sanctions"); if(!getSession()) location.href="login.html"; }

async function pageStudent(){
  const s = await initCommon("student");
  if(!s) return location.href="login.html";
  requireSb();
  try{
    const myEmail = $("myEmail"); if(myEmail) myEmail.textContent = s.email;
    // NP score (publié)
    const { data: npRows } = await sb.from("discipline_events")
      .select("points_delta")
      .eq("student_id", s.student_id)
      .eq("type","NPunitions")
      .eq("published", true);
    const sum = (npRows||[]).reduce((a,r)=>a+(Number(r.points_delta)||0),0);
    const score = Math.max(0, Math.min(20, 20+sum));
    const myNpScore = $("myNpScore"); if(myNpScore) myNpScore.textContent = score.toFixed(1)+" / 20";
    setStatus("✅ Espace élève à jour", true);
  }catch(e){
    console.error(e);
    setStatus("❌ Élève: erreur base", false);
  }
}

async function pageCodes(){
  const s = await initCommon("codes");
  if(!s) return location.href="login.html";
  if(!(s.role==="admin"||s.role==="prof")) return location.href="student.html";
  // IMPORTANT: on ne montre que les élèves (jamais les prof/admin)
}

// Export stable (PAS d’identifiant manquant)
window.T301 = {
  initCommon,
  login,
  logout,
  setStatus,
  showNotice,
  pageLogin,
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
