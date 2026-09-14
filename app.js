const SUPABASE_URL = "https://mqkoiyqaeyoiefeoxusy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Il7ZpPjVF9nRWc6Him0uFg_AN59J6li";
const BUCKET = "music";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = id => document.getElementById(id);
const input=$("fileInput"), coverInput=$("coverInput"), chooseCover=$("chooseCover");
const coverName=$("coverName"), uploadLabel=$("uploadLabel"), library=$("library");
const audio=$("audio"), play=$("play"), search=$("search"), seek=$("seek");
const current=$("current"), duration=$("duration"), nowTitle=$("nowTitle"), nowArtist=$("nowArtist");
const nowCover=$("cover"), count=$("count"), statusBox=$("status");

let songs=[], index=-1, selectedCover=null, favorites=new Set(), playlists=[], currentView="home";

const fmt=s=>!isFinite(s)?"0:00":Math.floor(s/60)+":"+String(Math.floor(s%60)).padStart(2,"0");
function esc(x){return String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function status(msg,error=false){if(!statusBox)return;statusBox.textContent=msg;statusBox.classList.remove("hidden");statusBox.classList.toggle("error",error);if(!error)setTimeout(()=>statusBox.classList.add("hidden"),3500);}
async function session(){return (await supabaseClient.auth.getSession()).data.session;}
function uploadEnabled(ok){if(uploadLabel){uploadLabel.style.opacity=ok?"1":".55";uploadLabel.style.pointerEvents=ok?"auto":"none";}if(chooseCover){chooseCover.disabled=!ok;chooseCover.style.opacity=ok?"1":".55";}}

if(chooseCover&&coverInput){chooseCover.onclick=()=>coverInput.click();coverInput.onchange=()=>{selectedCover=coverInput.files?.[0]||null;if(coverName)coverName.textContent=selectedCover?selectedCover.name:"Portada opcional";};}

async function loadSongs(){
  const s=await session();
  if(!s){songs=[];favorites.clear();playlists=[];renderSongs([],"Biblioteca");uploadEnabled(false);return;}
  uploadEnabled(true);
  const r=await supabaseClient.from("songs").select("*").order("created_at",{ascending:false});
  if(r.error){status("No se pudo cargar la biblioteca: "+r.error.message,true);return;}
  songs=r.data||[];await loadFavorites();await loadPlaylists();
  if(currentView==="favorites")renderFavorites();else if(currentView==="playlists")renderPlaylists();else renderSongs(search?.value?filterSongs(search.value):songs,currentView==="search"?"Resultados de búsqueda":"Biblioteca");
}

if(input)input.onchange=async e=>{
  const s=await session();if(!s){alert("Primero inicia sesión.");input.value="";return;}
  const files=[...e.target.files];if(!files.length)return;
  for(const file of files){
    if(!file.type.startsWith("audio/"))continue;
    try{
      status("Subiendo "+file.name+"...");
      const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_"), path=`${s.user.id}/${crypto.randomUUID()}-${safe}`;
      let r=await supabaseClient.storage.from(BUCKET).upload(path,file,{contentType:file.type||"audio/mpeg",upsert:false});
      if(r.error)throw r.error;
      let coverPath=null,coverMime=null;
      if(selectedCover){
        if(!selectedCover.type.startsWith("image/"))throw new Error("La portada debe ser una imagen.");
        const cs=selectedCover.name.replace(/[^a-zA-Z0-9._-]/g,"_");
        coverPath=`${s.user.id}/covers/${crypto.randomUUID()}-${cs}`;
        r=await supabaseClient.storage.from(BUCKET).upload(coverPath,selectedCover,{contentType:selectedCover.type,upsert:false});
        if(r.error){await supabaseClient.storage.from(BUCKET).remove([path]);throw r.error;}
        coverMime=selectedCover.type;
      }
      r=await supabaseClient.from("songs").insert({user_id:s.user.id,title:file.name.replace(/\.[^/.]+$/,""),artist:"Mi biblioteca",storage_path:path,file_name:file.name,mime_type:file.type||"audio/mpeg",cover_path:coverPath,cover_mime_type:coverMime}).select().single();
      if(r.error){await supabaseClient.storage.from(BUCKET).remove([path]);if(coverPath)await supabaseClient.storage.from(BUCKET).remove([coverPath]);throw r.error;}
    }catch(err){status("No se pudo subir "+file.name+": "+err.message,true);}
  }
  input.value="";selectedCover=null;if(coverInput)coverInput.value="";if(coverName)coverName.textContent="Portada opcional";await loadSongs();
};

async function coverUrl(song){if(!song?.cover_path)return null;const r=await supabaseClient.storage.from(BUCKET).createSignedUrl(song.cover_path,3600);return r.error?null:r.data?.signedUrl||null;}

async function renderSongs(list,title="Biblioteca"){
  if(!library)return;count.textContent=`${list.length} ${list.length===1?"canción":"canciones"}`;
  if(!list.length){library.innerHTML='<div class="empty">No hay canciones para mostrar.</div>';return;}
  library.innerHTML=`<div class="section-title"><h2>${esc(title)}</h2><span>${list.length} ${list.length===1?"canción":"canciones"}</span></div>`+
  list.map(s=>`<div class="song"><div class="thumb" id="thumb-${s.id}">🎵</div><div class="song-info"><div class="song-title">${esc(s.title)}</div><div class="song-meta">${esc(s.artist||"Mi biblioteca")}</div></div><div class="song-actions"><button onclick="playSongById('${s.id}')">▶</button><button onclick="toggleFavorite('${s.id}')">${favorites.has(s.id)?"❤️":"🤍"}</button><button onclick="editSong('${s.id}')">✏️</button><button onclick="addSongToPlaylist('${s.id}')">📋</button><button class="download" onclick="downloadSongById('${s.id}')">⬇</button><button onclick="deleteSong('${s.id}')">🗑️</button></div></div>`).join("");
  await Promise.all(list.map(async s=>{const u=await coverUrl(s);if(u){const el=$("thumb-"+s.id);if(el)el.innerHTML=`<img src="${u}" alt="Portada">`;}}));
}
function filterSongs(v){const q=String(v||"").trim().toLowerCase();return q?songs.filter(s=>(s.title||"").toLowerCase().includes(q)||(s.artist||"").toLowerCase().includes(q)):songs;}

async function playSongById(id){
  const i=songs.findIndex(s=>s.id===id);if(i<0)return;index=i;const song=songs[i];
  const r=await supabaseClient.storage.from(BUCKET).createSignedUrl(song.storage_path,3600);
  if(r.error){status("No se pudo reproducir: "+r.error.message,true);return;}
  audio.src=r.data.signedUrl;try{await audio.play();}catch(e){status("Pulsa ▶ para iniciar la reproducción.",true);}
  nowTitle.textContent=song.title;nowArtist.textContent=song.artist||"Mi biblioteca";const u=await coverUrl(song);if(nowCover)nowCover.innerHTML=u?`<img src="${u}" alt="Portada">`:"🎵";if(play)play.textContent="⏸";
}
window.playSongById=playSongById;

async function downloadSongById(id){const s=songs.find(x=>x.id===id);if(!s)return;const r=await supabaseClient.storage.from(BUCKET).createSignedUrl(s.storage_path,300);if(r.error){status("No se pudo preparar la descarga: "+r.error.message,true);return;}const a=document.createElement("a");a.href=r.data.signedUrl;a.download=s.file_name||s.title;a.target="_blank";document.body.appendChild(a);a.click();a.remove();}
window.downloadSongById=downloadSongById;

async function loadFavorites(){const r=await supabaseClient.from("favorites").select("song_id");if(!r.error)favorites=new Set((r.data||[]).map(x=>x.song_id));}
async function toggleFavorite(id){
  const s=await session();if(!s){alert("Primero inicia sesión.");return;}
  let r;
  if(favorites.has(id)){r=await supabaseClient.from("favorites").delete().eq("song_id",id);if(!r.error)favorites.delete(id);}
  else{r=await supabaseClient.from("favorites").insert({user_id:s.user.id,song_id:id});if(!r.error)favorites.add(id);}
  if(r.error){status("No se pudo cambiar favorito: "+r.error.message,true);return;}
  if(currentView==="favorites")renderFavorites();else renderSongs(filterSongs(search?.value),"Biblioteca");
}
window.toggleFavorite=toggleFavorite;
function renderFavorites(){currentView="favorites";renderSongs(songs.filter(s=>favorites.has(s.id)),"Favoritos ❤️");}

async function loadPlaylists(){const r=await supabaseClient.from("playlists").select("*").order("created_at",{ascending:false});if(!r.error)playlists=r.data||[];}
async function renderPlaylists(){
  currentView="playlists";count.textContent=`${playlists.length} ${playlists.length===1?"playlist":"playlists"}`;
  library.innerHTML=`<div class="section-title"><h2>Mis playlists 📚</h2><button class="primary" onclick="createPlaylist()">+ Nueva playlist</button></div>`+
  (playlists.length?playlists.map(p=>`<div class="song"><div class="thumb">📚</div><div class="song-info"><div class="song-title">${esc(p.name)}</div><div class="song-meta">Playlist</div></div><div class="song-actions"><button onclick="openPlaylist('${p.id}')">▶ Ver</button><button onclick="deletePlaylist('${p.id}')">🗑️</button></div></div>`).join(""):'<div class="empty">No tienes playlists todavía.</div>');
}
window.renderPlaylists=renderPlaylists;
async function createPlaylist(){
  const s=await session();if(!s){alert("Primero inicia sesión.");return;}const name=prompt("Nombre de la playlist:");if(!name?.trim())return;
  const r=await supabaseClient.from("playlists").insert({user_id:s.user.id,name:name.trim()}).select().single();
  if(r.error){status("No se pudo crear: "+r.error.message,true);return;}playlists.unshift(r.data);renderPlaylists();
}
window.createPlaylist=createPlaylist;
async function addSongToPlaylist(songId){
  if(!playlists.length){alert("Primero crea una playlist.");return;}
  const options=playlists.map((p,i)=>`${i+1}. ${p.name}`).join("\n"),n=Number(prompt("Elige una playlist:\n\n"+options));
  if(!Number.isInteger(n)||n<1||n>playlists.length)return;
  const r=await supabaseClient.from("playlist_songs").insert({playlist_id:playlists[n-1].id,song_id:songId});
  if(r.error&&!String(r.error.message).toLowerCase().includes("duplicate")){status("No se pudo agregar: "+r.error.message,true);return;}status("Canción agregada a la playlist.");
}
window.addSongToPlaylist=addSongToPlaylist;
async function openPlaylist(id){
  const p=playlists.find(x=>x.id===id);if(!p)return;const r=await supabaseClient.from("playlist_songs").select("song_id").eq("playlist_id",id);
  if(r.error){status("No se pudo abrir: "+r.error.message,true);return;}const ids=new Set((r.data||[]).map(x=>x.song_id));currentView="playlist";renderSongs(songs.filter(s=>ids.has(s.id)),p.name);
}
window.openPlaylist=openPlaylist;
async function deletePlaylist(id){if(!confirm("¿Eliminar esta playlist? Las canciones no se borrarán."))return;const r=await supabaseClient.from("playlists").delete().eq("id",id);if(r.error){status("No se pudo eliminar: "+r.error.message,true);return;}playlists=playlists.filter(p=>p.id!==id);renderPlaylists();}
window.deletePlaylist=deletePlaylist;

async function editSong(id){
  const s=songs.find(x=>x.id===id);if(!s)return;const title=prompt("Título:",s.title);if(title===null)return;const artist=prompt("Artista:",s.artist||"Mi biblioteca");if(artist===null)return;
  const r=await supabaseClient.from("songs").update({title:title.trim()||s.title,artist:artist.trim()||"Mi biblioteca"}).eq("id",id);
  if(r.error){status("No se pudo editar: "+r.error.message,true);return;}await loadSongs();
}
window.editSong=editSong;
async function deleteSong(id){
  const s=songs.find(x=>x.id===id);if(!s||!confirm(`¿Eliminar "${s.title}"?`))return;
  const paths=[s.storage_path];if(s.cover_path)paths.push(s.cover_path);
  let r=await supabaseClient.storage.from(BUCKET).remove(paths);if(r.error){status("No se pudo eliminar el archivo: "+r.error.message,true);return;}
  r=await supabaseClient.from("songs").delete().eq("id",id);if(r.error){status("No se pudo eliminar: "+r.error.message,true);return;}
  if(index>=0&&songs[index]?.id===id){audio.pause();audio.removeAttribute("src");audio.load();index=-1;if(nowTitle)nowTitle.textContent="Nada reproduciéndose";if(nowArtist)nowArtist.textContent="Mi biblioteca";if(nowCover)nowCover.innerHTML="🎵";if(play)play.textContent="▶";}
  await loadSongs();
}
window.deleteSong=deleteSong;

document.querySelectorAll(".nav").forEach(btn=>btn.addEventListener("click",async()=>{
  document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));btn.classList.add("active");
  const t=btn.textContent.toLowerCase();
  if(t.includes("inicio")){currentView="home";if(search)search.value="";renderSongs(songs,"Biblioteca");}
  else if(t.includes("buscar")){currentView="search";search?.focus();renderSongs(filterSongs(search?.value),"Buscar");}
  else if(t.includes("favoritos")){await loadFavorites();renderFavorites();}
  else if(t.includes("playlist")){await loadPlaylists();renderPlaylists();}
}));

if(search)search.oninput=()=>{currentView="search";renderSongs(filterSongs(search.value),"Resultados de búsqueda");};
if(play)play.onclick=async()=>{if(index<0&&songs.length)await playSongById(songs[0].id);else if(audio.paused){await audio.play();}else audio.pause();};
if($("prev"))$("prev").onclick=previousTrack;
if($("next"))$("next").onclick=nextTrack;
audio.ontimeupdate=()=>{if(seek)seek.value=audio.duration?(audio.currentTime/audio.duration)*100:0;if(current)current.textContent=fmt(audio.currentTime);if(duration)duration.textContent=fmt(audio.duration);};
audio.onended=()=>{ if (!repeatMode) nextTrack(); };audio.onplay=()=>{if(play)play.textContent="⏸";};audio.onpause=()=>{if(play)play.textContent="▶";};
if(seek)seek.oninput=()=>{if(audio.duration)audio.currentTime=(seek.value/100)*audio.duration;};


let shuffleMode = false;
let repeatMode = false;
const shuffleBtn = $("shuffle");
const repeatBtn = $("repeat");
const muteBtn = $("mute");
const volume = $("volume");

if (audio) audio.volume = 1;

if (shuffleBtn) {
  shuffleBtn.onclick = () => {
    shuffleMode = !shuffleMode;
    shuffleBtn.classList.toggle("active", shuffleMode);
    status(shuffleMode ? "Modo aleatorio activado." : "Modo aleatorio desactivado.");
  };
}

if (repeatBtn) {
  repeatBtn.onclick = () => {
    repeatMode = !repeatMode;
    repeatBtn.classList.toggle("active", repeatMode);
    audio.loop = repeatMode;
    status(repeatMode ? "Repetición activada." : "Repetición desactivada.");
  };
}

if (muteBtn) {
  muteBtn.onclick = () => {
    audio.muted = !audio.muted;
    muteBtn.textContent = audio.muted ? "🔇" : "🔊";
  };
}

if (volume) {
  volume.oninput = () => {
    audio.volume = Number(volume.value);
    audio.muted = audio.volume === 0;
    if (muteBtn) muteBtn.textContent = audio.muted ? "🔇" : "🔊";
  };
}

async function nextTrack() {
  if (!songs.length) return;
  if (shuffleMode && songs.length > 1) {
    let n = index;
    while (n === index) n = Math.floor(Math.random() * songs.length);
    await playSongById(songs[n].id);
  } else {
    await playSongById(songs[(index + 1) % songs.length].id);
  }
}

async function previousTrack() {
  if (!songs.length) return;
  await playSongById(songs[(index - 1 + songs.length) % songs.length].id);
}


const authPanel=$("authPanel"),accountBtn=$("accountBtn"),closeAuth=$("closeAuth"),authSubmit=$("authSubmit"),switchAuth=$("switchAuth"),authTitle=$("authTitle"),authMessage=$("authMessage"),userEmail=$("userEmail");
let signUpMode=false;
if(accountBtn)accountBtn.onclick=async()=>{const s=await session();if(s){await supabaseClient.auth.signOut();await updateAccount();await loadSongs();}else authPanel?.classList.remove("hidden");};
if(closeAuth)closeAuth.onclick=()=>authPanel?.classList.add("hidden");
if(switchAuth)switchAuth.onclick=()=>{signUpMode=!signUpMode;if(authTitle)authTitle.textContent=signUpMode?"Crear cuenta":"Iniciar sesión";if(authSubmit)authSubmit.textContent=signUpMode?"Registrarme":"Iniciar sesión";switchAuth.textContent=signUpMode?"Ya tengo una cuenta":"Crear cuenta";if(authMessage)authMessage.textContent=signUpMode?"Crea una cuenta para usar tu biblioteca.":"Accede a tu biblioteca de Mi Música.";};
if(authSubmit)authSubmit.onclick=async()=>{const email=$("email")?.value.trim(),password=$("password")?.value;if(!email||!password||password.length<6){alert("Escribe un correo y una contraseña de al menos 6 caracteres.");return;}const r=signUpMode?await supabaseClient.auth.signUp({email,password}):await supabaseClient.auth.signInWithPassword({email,password});if(r.error){alert(r.error.message);return;}if(signUpMode&&!r.data.session)alert("Cuenta creada. Revisa tu correo si Supabase solicita confirmación.");authPanel?.classList.add("hidden");await updateAccount();await loadSongs();};
async function updateAccount(){const s=await session();if(s){if(userEmail)userEmail.textContent=s.user.email||"Usuario";if(accountBtn)accountBtn.textContent="Cerrar sesión";uploadEnabled(true);}else{if(userEmail)userEmail.textContent="Invitado";if(accountBtn)accountBtn.textContent="Iniciar sesión";uploadEnabled(false);}}
supabaseClient.auth.onAuthStateChange(()=>{updateAccount();loadSongs();});
(async()=>{await updateAccount();await loadSongs();})();
