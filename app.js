const input=document.getElementById('fileInput');
const library=document.getElementById('library');
const audio=document.getElementById('audio');
const play=document.getElementById('play');
const search=document.getElementById('search');
const seek=document.getElementById('seek');
const current=document.getElementById('current');
const duration=document.getElementById('duration');
const nowTitle=document.getElementById('nowTitle');
const count=document.getElementById('count');
let songs=[], index=-1;

const fmt=s=>{if(!isFinite(s))return"0:00";return Math.floor(s/60)+":"+String(Math.floor(s%60)).padStart(2,"0")};

input.onchange=e=>{
  [...e.target.files].forEach(file=>{
    songs.push({file,url:URL.createObjectURL(file),title:file.name.replace(/\.[^/.]+$/,""),artist:"Archivo local"});
  });
  render(songs);
};

function render(list=songs){
  count.textContent=`${songs.length} ${songs.length===1?"canción":"canciones"}`;
  if(!list.length){library.innerHTML='<div class="empty">No se encontraron canciones.</div>';return}
  library.innerHTML=list.map((s,i)=>`
    <div class="song">
      <div class="thumb">🎵</div>
      <div><div class="song-title">${escapeHtml(s.title)}</div><div class="song-meta">${escapeHtml(s.artist)}</div></div>
      <button onclick="playSong(${songs.indexOf(s)})">▶</button>
      <a class="download" href="${s.url}" download="${escapeHtml(s.file.name)}"><button>⬇</button></a>
    </div>`).join("");
}
function escapeHtml(x){return x.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function playSong(i){if(!songs[i])return;index=i;audio.src=songs[i].url;audio.play();nowTitle.textContent=songs[i].title;play.textContent="⏸"}
play.onclick=()=>{if(index<0&&songs.length)playSong(0);else if(audio.paused){audio.play();play.textContent="⏸"}else{audio.pause();play.textContent="▶"}};
document.getElementById('prev').onclick=()=>{if(songs.length)playSong((index-1+songs.length)%songs.length)};
document.getElementById('next').onclick=()=>{if(songs.length)playSong((index+1)%songs.length)};
audio.ontimeupdate=()=>{seek.value=audio.duration?(audio.currentTime/audio.duration)*100:0;current.textContent=fmt(audio.currentTime);duration.textContent=fmt(audio.duration)};
seek.oninput=()=>{if(audio.duration)audio.currentTime=(seek.value/100)*audio.duration};
audio.onended=()=>document.getElementById('next').click();
search.oninput=()=>{const q=search.value.toLowerCase();render(songs.filter(s=>s.title.toLowerCase().includes(q)))};


// Supabase authentication
const SUPABASE_URL = "https://mqkoiyqaeyoiefeoxusy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Il7ZpPjVF9nRWc6Him0uFg_AN59J6li";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const authPanel=document.getElementById("authPanel");
const accountBtn=document.getElementById("accountBtn");
const closeAuth=document.getElementById("closeAuth");
const authSubmit=document.getElementById("authSubmit");
const switchAuth=document.getElementById("switchAuth");
const authTitle=document.getElementById("authTitle");
const authMessage=document.getElementById("authMessage");
const userEmail=document.getElementById("userEmail");
let signUpMode=false;

accountBtn.onclick=async()=>{
  const {data:{session}}=await supabaseClient.auth.getSession();
  if(session){ await supabaseClient.auth.signOut(); updateAccount(); }
  else authPanel.classList.remove("hidden");
};
closeAuth.onclick=()=>authPanel.classList.add("hidden");
switchAuth.onclick=()=>{
  signUpMode=!signUpMode;
  authTitle.textContent=signUpMode?"Crear cuenta":"Iniciar sesión";
  authSubmit.textContent=signUpMode?"Registrarme":"Iniciar sesión";
  switchAuth.textContent=signUpMode?"Ya tengo una cuenta":"Crear cuenta";
  authMessage.textContent=signUpMode?"Crea una cuenta para usar tu biblioteca.":"Accede a tu biblioteca de Mi Música.";
};

authSubmit.onclick=async()=>{
  const email=document.getElementById("email").value.trim();
  const password=document.getElementById("password").value;
  if(!email||password.length<6){alert("Escribe un correo y una contraseña de al menos 6 caracteres.");return}
  let result;
  if(signUpMode) result=await supabaseClient.auth.signUp({email,password});
  else result=await supabaseClient.auth.signInWithPassword({email,password});
  if(result.error){alert(result.error.message);return}
  if(signUpMode){alert("Cuenta creada. Si Supabase pide confirmar tu correo, revisa tu bandeja de entrada.");}
  authPanel.classList.add("hidden");
  updateAccount();
};

async function updateAccount(){
  const {data:{session}}=await supabaseClient.auth.getSession();
  if(session){
    userEmail.textContent=session.user.email||"Usuario";
    accountBtn.textContent="Cerrar sesión";
  }else{
    userEmail.textContent="Invitado";
    accountBtn.textContent="Iniciar sesión";
  }
}
supabaseClient.auth.onAuthStateChange(()=>updateAccount());
updateAccount();
