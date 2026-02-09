// TECHN301 — app.js (stable + messages d'erreur clairs)

// Supabase
const SUPABASE_URL = "https://hcalvcfkwagzkdkkwpau.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjYWx2Y2Zrd2Fnemtka2t3cGF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNDk0NjEsImV4cCI6MjA4NTcyNTQ2MX0.7gP-SgeejLvv02whQ5AdhEXWsIhWja3jb8Bh6kOW_Hg";

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

function esc(s){
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

function showBox(id, msg){
  const box = $(id);
  if(!box) return;
  if(!msg){
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }
  box.style.display = "block";
  box.innerHTML = "⚠️ " + esc(msg);
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

function explainSupabaseProblem(detail){
  const bits = [
    "Connexion à la base impossible.",
    "Vérifie :",
    "1) Site en HTTPS (GitHub Pages).",
    "2) Tables créées (accounts, students...).",
    "3) RLS désactivé (ou policies) sur la table accounts."
  ];
  if(detail) bits.push("", "Détail : " + detail);
  return bits.join("\n");
}

function requireSb(){
  if(!sb) throw new Error(explainSupabaseProblem("Supabase non initialisé (URL/clé)."));
}

function errMsg(e){
  if(!e) return "Erreur inconnue.";
  if(typeof e === "string") return e;
  const parts = [];
  if(e.message) parts.push(e.message);
  if(e.details) parts.push(e.details);
  if(e.hint) parts.push(e.hint);
  if(e.code) parts.push("code: " + e.code);
  return parts.filter(Boolean).join(" — ") || "Erreur inconnue.";
}

// Test DB : si ça rate -> message clair (RLS / tables)
async function pingAccounts(){
  requireSb();
  const { error } = await sb.from("accounts").select("email").limit(1);
  if(error){
    throw new Error(explainSupabaseProblem(errMsg(error)));
  }
  return true;
}

async function login(email, code){
  await pingAccounts();
  const em = String(email||"").trim().toLowerCase();
  const cd = String(code||"").trim();
  if(!em || !/^[0-9]{4}$/.test(cd)) throw new Error("Email + code (4 chiffres) requis.");

  const { data, error } = await sb
    .from("accounts")
    .select("email, role, student_id, provisional")
    .eq("email", em)
    .eq("code", cd)
    .maybeSingle();
  if(error) throw new Error(errMsg(error));
  if(!data) throw new Error("Email ou code incorrect.");

  const s = { email: data.email, role: data.role, student_id: data.student_id || null };
  setSession(s);
  return s;
}

function logout(){
  setSession(null);
  location.href = "login.html";
}

function mountNav(activeKey){
  const nav = $("nav");
  if(!nav) return;
  const s = getSession();
  nav.innerHTML = "";
  if(!s) return;

  const items = [
    ["dashboard.html","Dashboard",["admin","prof"]],
    ["classes.html","Classes",["admin"]],
    ["matieres.html","Matières",["admin"]],
    ["devoirs.html","Devoirs",["admin","prof","student"]],
    ["messages.html","Messages",["admin","prof","student"]],
    ["notes.html","Notes",["admin","prof","student"]],
    ["npunitions.html","NPunitions",["admin","prof","student"]],
    ["sanctions.html","Sanctions",["admin","prof","student"]],
    ["student.html","Mon espace",["student"]],
  ];

  for(const [href,label,roles] of items){
    if(!roles.includes(s.role)) continue;
    const a = document.createElement("a");
    a.href = href;
    a.className = "chip" + (activeKey && href.startsWith(activeKey) ? " active" : "");
    a.textContent = label;
    nav.appendChild(a);
  }
}

async function initCommon(active){
  const s = getSession();
  const who = $("who"); if(who) who.textContent = s ? s.email : "Déconnecté";
  const roleTxt = $("roleTxt"); if(roleTxt) roleTxt.textContent = s ? s.role : "—";
  const modeTxt = $("modeTxt"); if(modeTxt) modeTxt.textContent = "";
  mountNav(active || "");
  const btnLogout = $("btnLogout"); if(btnLogout) btnLogout.onclick = logout;
  return s;
}

async function pageLogin(){
  setStatus("📝 Prêt", null);
  showBox("loginError", "");

  const btn = $("btnLogin");
  if(!btn) return;

  btn.onclick = async ()=>{
    try{
      showBox("loginError", "");
      const s = await login($("loginEmail")?.value, $("loginCode")?.value);
      setStatus("✅ Connecté", true);
      location.href = (s.role === "student") ? "student.html" : "dashboard.html";
    }catch(e){
      console.error(e);
      setStatus("❌ Connexion impossible", false);
      showBox("loginError", errMsg(e));
    }
  };
}

window.T301 = {
  initCommon,
  login,
  logout,
  pageLogin,
  setStatus
};
