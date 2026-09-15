const SUPABASE_URL="https://mqkoiyqaeyoiefeoxusy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_Il7ZpPjVF9nRWc6Him0uFg_AN59J6li";
const BUCKET="music";
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id);
const input=$("fileInput"),uploadAudio=$("uploadAudio"),uploadCover=$("uploadCover"),uploadTitle=$("uploadTitle"),uploadArtist=$("uploadArtist"),coverPreview=$("coverPreview"),library=$("library"),audio=$("audio"),play=$("play"),search=$("search"),seek=$("seek"),current=$("current"),duration=$("duration"),nowTitle=$("nowTitle"),nowArtist=$("nowArtist"),nowCover=$("cover"),count=$("count"),statusBox=$("status");
let songs=[],index=-1,favorites=new Set(),playlists=[],currentView="home",shuffleMode=false,repeatMode=false,selectedEditId=null,selectedPlaylistSongId=null;
let recentIds=[];
let audioCtx=null,analyser=null,audioSource=null,visualizerFrame=null;
const fmt=s=>!isFinite(s)?"0:00":Math.floor(s/60)+":"+String(Math.floor(s%60)).padStart(2,"0");
function esc(x){return String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function status(msg,error=false){if(!statusBox)return;statusBox.textContent=msg;statusBox.classList.remove("hidden");statusBox.classList.toggle("error",error);if(!error)setTimeout(()=>statusBox.classList.add("hidden"),3200)}
async function session(){return (await supabaseClient.auth.getSession()).data.session}
function requireLogin(){if(!session()){alert("Primero inicia sesión para usar esta función.");return false}return true}
function uploadEnabled(ok){const x=$("uploadLabel");if(x){x.style.opacity=ok?"1":".55";x.style.pointerEvents=ok?"auto":"none"}}
async function loadSongs(){const s=await session();if(!s){songs=[];favorites.clear();playlists=[];recentIds=[];renderCurrent();updateStats();uploadEnabled(false);return}uploadEnabled(true);const r=await supabaseClient.from("songs").select("*").order("created_at",{ascending:false});if(r.error){status("No se pudo cargar la biblioteca: "+r.error.message,true);return}songs=r.data||[];await Promise.all([loadFavorites(),loadPlaylists(),loadRecentIds()]);renderCurrent();updateStats();if(currentView==="home")renderHomeSections()}
async function loadFavorites(){const s=await session();if(!s)return;const r=await supabaseClient.from("favorites").select("song_id");favorites=new Set((r.data||[]).map(x=>x.song_id))}
async function loadPlaylists(){const s=await session();if(!s)return;const r=await supabaseClient.from("playlists").select("*").order("created_at",{ascending:false});if(!r.error)playlists=r.data||[]}
async function coverUrl(song){if(!song?.cover_path)return null;const r=await supabaseClient.storage.from(BUCKET).createSignedUrl(song.cover_path,3600);return r.error?null:r.data?.signedUrl||null}

async function loadRecentIds(){const s=await session();if(!s){recentIds=[];return}try{recentIds=JSON.parse(localStorage.getItem(`mi-musica-recent-${s.user.id}`)||"[]");if(!Array.isArray(recentIds))recentIds=[]}catch{recentIds=[]}}
async function saveRecentSong(id){const s=await session();if(!s)return;recentIds=[id,...recentIds.filter(x=>x!==id)].slice(0,8);localStorage.setItem(`mi-musica-recent-${s.user.id}`,JSON.stringify(recentIds));renderHomeSections()}
function miniSongMarkup(s){return `<div class="song home-song"><div class="thumb" id="home-thumb-${s.id}">🎵</div><div class="song-info"><div class="song-title">${esc(s.title)}</div><div class="song-meta">${esc(s.artist||"Mi biblioteca")}</div></div><div class="song-actions"><button class="quick-play" title="Reproducir ahora" onclick="playSongById('${s.id}')">▶</button><button title="Favorito" onclick="toggleFavorite('${s.id}')">${favorites.has(s.id)?"❤️":"🤍"}</button></div></div>`}
async function renderHomeList(elId,list){const el=$(elId);if(!el)return;if(!list.length){el.innerHTML='<div class="home-empty">Todavía no hay canciones para mostrar aquí.</div>';return}el.innerHTML=list.map(miniSongMarkup).join("");await Promise.all(list.map(async s=>{const u=await coverUrl(s);if(u){const e=$("home-thumb-"+s.id);if(e)e.innerHTML=`<img src="${u}" alt="Portada">`}}))}
async function renderHomeSections(){await loadRecentIds();const recent=recentIds.map(id=>songs.find(s=>s.id===id)).filter(Boolean).slice(0,5);const newest=songs.slice(0,5);await Promise.all([renderHomeList("recentLibrary",recent),renderHomeList("newLibrary",newest)]);const rs=$("recentSection"),ns=$("newSection");if(rs)rs.classList.toggle("hidden",songs.length===0);if(ns)ns.classList.toggle("hidden",songs.length===0)}
function filterSongs(v){const q=String(v||"").trim().toLowerCase();return q?songs.filter(s=>(s.title||"").toLowerCase().includes(q)||(s.artist||"").toLowerCase().includes(q)):songs}
async function renderSongs(list,title="Biblioteca",subtitle="Tus canciones guardadas"){count.textContent=`${list.length} ${list.length===1?"canción":"canciones"}`;$("viewTitle").textContent=title;$("viewSubtitle").textContent=subtitle;$("newPlaylistBtn").classList.add("hidden");if(!list.length){library.innerHTML=`<div class="empty">${title==="Resultados de búsqueda"?"No encontramos canciones con esa búsqueda.":"No hay canciones para mostrar."}</div>`;return}library.innerHTML=list.map(s=>`<div class="song"><div class="thumb" id="thumb-${s.id}">🎵</div><div class="song-info"><div class="song-title">${esc(s.title)}</div><div class="song-meta">${esc(s.artist||"Mi biblioteca")}</div></div><div class="song-actions"><button title="Reproducir" onclick="playSongById('${s.id}')">▶</button><button title="Favorito" onclick="toggleFavorite('${s.id}')">${favorites.has(s.id)?"❤️":"🤍"}</button><button title="Editar" onclick="editSong('${s.id}')">✏️</button><button title="Añadir a playlist" onclick="addSongToPlaylist('${s.id}')">📋</button><button title="Descargar" onclick="downloadSongById('${s.id}')">⬇</button><button title="Eliminar" onclick="deleteSong('${s.id}')">🗑️</button></div></div>`).join("");await Promise.all(list.map(async s=>{const u=await coverUrl(s);if(u){const e=$("thumb-"+s.id);if(e)e.innerHTML=`<img src="${u}" alt="Portada">`}}))}
async function renderFavorites(){await loadFavorites();const list=songs.filter(s=>favorites.has(s.id));await renderSongs(list,"Favoritos","Tus canciones marcadas con ❤️")}
async function renderPlaylists(){$("viewTitle").textContent="Mis playlists";$("viewSubtitle").textContent="Organiza tus canciones como quieras";$("newPlaylistBtn").classList.remove("hidden");count.textContent=`${playlists.length} ${playlists.length===1?"playlist":"playlists"}`;if(!playlists.length){library.innerHTML='<div class="empty">Aún no tienes playlists.<br><br><button class="primary" style="border:0;border-radius:8px;padding:10px 15px;cursor:pointer" onclick="openPlaylistModal()">＋ Crear mi primera playlist</button></div>';return}library.innerHTML=playlists.map(p=>`<div class="playlist-row"><div class="playlist-icon">📚</div><div><strong>${esc(p.name)}</strong><div class="song-meta">Playlist personal</div></div><button onclick="openPlaylist('${p.id}')">Abrir</button><button onclick="deletePlaylist('${p.id}')">🗑️</button></div>`).join("")}
async function openPlaylist(id){const p=playlists.find(x=>x.id===id);if(!p)return;const r=await supabaseClient.from("playlist_songs").select("song_id").eq("playlist_id",id);const ids=(r.data||[]).map(x=>x.song_id);const list=ids.map(x=>songs.find(s=>s.id===x)).filter(Boolean);$("viewTitle").textContent=p.name;$("viewSubtitle").textContent="Canciones de esta playlist";$("newPlaylistBtn").classList.remove("hidden");count.textContent=`${list.length} ${list.length===1?"canción":"canciones"}`;if(!list.length){library.innerHTML='<div class="empty">Esta playlist todavía está vacía.</div>';return}library.innerHTML=list.map(s=>`<div class="song"><div class="thumb">🎵</div><div class="song-info"><div class="song-title">${esc(s.title)}</div><div class="song-meta">${esc(s.artist||"Mi biblioteca")}</div></div><div class="song-actions"><button onclick="playSongById('${s.id}')">▶</button><button onclick="toggleFavorite('${s.id}')">${favorites.has(s.id)?"❤️":"🤍"}</button><button onclick="removeFromPlaylist('${id}','${s.id}')">✖</button></div></div>`).join("")}
function renderCurrent(){if(currentView==="favorites")renderFavorites();else if(currentView==="playlists")renderPlaylists();else if(currentView==="search")renderSongs(filterSongs(search.value),"Resultados de búsqueda","Busca por título o artista");else renderSongs(songs,"Biblioteca","Tus canciones guardadas")}

function startMusicVisualizer(){
  document.body.classList.add("audio-playing");
  try{
    if(!audioCtx){
      audioCtx=new (window.AudioContext||window.webkitAudioContext)();
      analyser=audioCtx.createAnalyser();
      analyser.fftSize=64;
      analyser.smoothingTimeConstant=.78;
      audioSource=audioCtx.createMediaElementSource(audio);
      audioSource.connect(analyser);
      analyser.connect(audioCtx.destination);
    }
    if(audioCtx.state==="suspended") audioCtx.resume();
  }catch(e){ analyser=null; }
  if(visualizerFrame) cancelAnimationFrame(visualizerFrame);
  const data=analyser?new Uint8Array(analyser.frequencyBinCount):null;
  const tick=()=>{
    if(audio.paused){document.body.classList.remove("audio-playing");document.body.style.setProperty("--music-level","0");return;}
    let level=.25;
    if(analyser&&data){
      analyser.getByteFrequencyData(data);
      let sum=0; for(let i=0;i<data.length;i++) sum+=data[i];
      level=Math.min(1,sum/(data.length*255)*2.4);
    }else{ level=.25+.2*(.5+.5*Math.sin(audio.currentTime*7)); }
    document.body.style.setProperty("--music-level",level.toFixed(3));
    visualizerFrame=requestAnimationFrame(tick);
  };
  tick();
}
async function playSongById(id){const i=songs.findIndex(s=>s.id===id);if(i<0)return;index=i;const song=songs[i];saveRecentSong(id);const r=await supabaseClient.storage.from(BUCKET).createSignedUrl(song.storage_path,3600);if(r.error){status("No se pudo reproducir: "+r.error.message,true);return}audio.crossOrigin="anonymous";audio.src=r.data.signedUrl;nowTitle.textContent=song.title;nowArtist.textContent=song.artist||"Mi biblioteca";const u=await coverUrl(song);nowCover.innerHTML=u?`<img src="${u}" alt="Portada">`:"🎵";try{await audio.play()}catch(e){status("Pulsa ▶ para iniciar la reproducción.")}if(play)play.textContent="⏸"}
window.playSongById=playSongById;
async function downloadSongById(id){if(!requireLogin())return;const s=songs.find(x=>x.id===id);if(!s)return;const r=await supabaseClient.storage.from(BUCKET).createSignedUrl(s.storage_path,300,{download:s.file_name||true});if(r.error){status("No se pudo preparar la descarga: "+r.error.message,true);return}const a=document.createElement("a");a.href=r.data.signedUrl;a.download=s.file_name||s.title;a.target="_blank";document.body.appendChild(a);a.click();a.remove()}
window.downloadSongById=downloadSongById;
async function toggleFavorite(id){if(!requireLogin())return;const s=await session();if(favorites.has(id)){await supabaseClient.from("favorites").delete().eq("user_id",s.user.id).eq("song_id",id);favorites.delete(id);status("Quitada de favoritos.")}else{const r=await supabaseClient.from("favorites").insert({user_id:s.user.id,song_id:id});if(r.error){status(r.error.message,true);return}favorites.add(id);status("Añadida a favoritos ❤️")}renderCurrent();updateStats()}
window.toggleFavorite=toggleFavorite;
async function editSong(id){if(!requireLogin())return;const s=songs.find(x=>x.id===id);if(!s)return;selectedEditId=id;$("editTitle").value=s.title||"";$("editArtist").value=s.artist||"";$("editModal").classList.remove("hidden")}
window.editSong=editSong;
async function deleteSong(id){if(!requireLogin())return;const s=songs.find(x=>x.id===id);if(!s)return;if(!confirm(`¿Eliminar “${s.title}” de tu biblioteca?`))return;const r=await supabaseClient.from("songs").delete().eq("id",id);if(r.error){status("No se pudo eliminar: "+r.error.message,true);return}await supabaseClient.storage.from(BUCKET).remove([s.storage_path,...(s.cover_path?[s.cover_path]:[])]);status("Canción eliminada.");await loadSongs()}
window.deleteSong=deleteSong;
function openPlaylistModal(){if(!requireLogin())return;$("playlistName").value="";$("playlistModal").classList.remove("hidden");setTimeout(()=>$('playlistName').focus(),50)}
window.openPlaylistModal=openPlaylistModal;
async function addSongToPlaylist(songId){if(!requireLogin())return;if(!playlists.length){if(confirm("No tienes playlists. ¿Quieres crear una?")){openPlaylistModal()}return}selectedPlaylistSongId=songId;const names=playlists.map((p,i)=>`${i+1}. ${p.name}`).join("\n");const ans=prompt("Escribe el número de la playlist:\n\n"+names);const n=Number(ans);if(!Number.isInteger(n)||n<1||n>playlists.length)return;const p=playlists[n-1];const r=await supabaseClient.from("playlist_songs").insert({playlist_id:p.id,song_id:songId});if(r.error){status(r.error.code==="23505"?"Esa canción ya está en la playlist.":r.error.message,r.error.code!=="23505");return}status(`Añadida a “${p.name}”.`)}
window.addSongToPlaylist=addSongToPlaylist;
async function removeFromPlaylist(pid,sid){const r=await supabaseClient.from("playlist_songs").delete().eq("playlist_id",pid).eq("song_id",sid);if(r.error){status(r.error.message,true);return}openPlaylist(pid)}
window.removeFromPlaylist=removeFromPlaylist;
async function deletePlaylist(id){if(!confirm("¿Eliminar esta playlist? Las canciones no se borrarán de tu biblioteca."))return;const r=await supabaseClient.from("playlists").delete().eq("id",id);if(r.error){status(r.error.message,true);return}await loadPlaylists();renderPlaylists()}
window.deletePlaylist=deletePlaylist;
$("createPlaylist").onclick=async()=>{if(!requireLogin())return;const name=$("playlistName").value.trim();if(!name)return alert("Escribe un nombre.");const s=await session();const r=await supabaseClient.from("playlists").insert({user_id:s.user.id,name}).select().single();if(r.error){alert(r.error.message);return}$("playlistModal").classList.add("hidden");await loadPlaylists();currentView="playlists";renderPlaylists();status("Playlist creada.")};
$("saveEdit").onclick=async()=>{if(!selectedEditId)return;const title=$("editTitle").value.trim(),artist=$("editArtist").value.trim();if(!title)return alert("Escribe un título.");const r=await supabaseClient.from("songs").update({title,artist:artist||"Mi biblioteca"}).eq("id",selectedEditId);if(r.error){alert(r.error.message);return}$("editModal").classList.add("hidden");await loadSongs();status("Canción actualizada.")};
$("closeEdit").onclick=()=>$("editModal").classList.add("hidden");$("closePlaylist").onclick=()=>$("playlistModal").classList.add("hidden");
$("newPlaylistBtn").onclick=openPlaylistModal;
function resetUploadForm(){
  if(uploadAudio)uploadAudio.value="";
  if(uploadCover)uploadCover.value="";
  if(uploadTitle)uploadTitle.value="";
  if(uploadArtist)uploadArtist.value="";
  if(coverPreview){coverPreview.innerHTML="";coverPreview.classList.add("hidden");}
  const p=$("uploadProgress");if(p){p.textContent="";p.classList.add("hidden");p.classList.remove("error");}
}
function openUploadModal(){if(!requireLogin())return;resetUploadForm();$("uploadModal").classList.remove("hidden");}
function closeUploadModal(){$("uploadModal").classList.add("hidden");resetUploadForm();}
window.openUploadModal=openUploadModal;
$("heroUpload").onclick=openUploadModal;
$("uploadLabel").onclick=e=>{e.preventDefault();openUploadModal()};
$("closeUpload").onclick=closeUploadModal;
$("cancelUpload").onclick=closeUploadModal;
if(uploadCover)uploadCover.onchange=()=>{const file=uploadCover.files?.[0];if(!file){coverPreview.innerHTML="";coverPreview.classList.add("hidden");return}const url=URL.createObjectURL(file);coverPreview.innerHTML=`<img src="${url}" alt="Vista previa de portada"><span>Portada seleccionada</span>`;coverPreview.classList.remove("hidden")};
if(uploadAudio)uploadAudio.onchange=()=>{const file=uploadAudio.files?.[0];if(file&&!uploadTitle.value)uploadTitle.value=file.name.replace(/\.[^/.]+$/,'')};
$("confirmUpload").onclick=async()=>{
  const s=await session();if(!s){alert("Primero inicia sesión.");return}
  const audioFile=uploadAudio?.files?.[0],coverFile=uploadCover?.files?.[0];
  if(!audioFile){alert("Selecciona un archivo de música.");return}
  if(!audioFile.type.startsWith("audio/")){alert("El archivo de música no es válido.");return}
  const title=(uploadTitle.value||audioFile.name.replace(/\.[^/.]+$/,'')).trim()||"Sin título";
  const artist=(uploadArtist.value||"Mi biblioteca").trim()||"Mi biblioteca";
  const progress=$("uploadProgress"),btn=$("confirmUpload");btn.disabled=true;progress.textContent="Subiendo música...";progress.classList.remove("hidden","error");
  try{
    const safe=audioFile.name.replace(/[^a-zA-Z0-9._-]/g,"_"),base=`${s.user.id}/${crypto.randomUUID()}`,path=`${base}-${safe}`;
    let r=await supabaseClient.storage.from(BUCKET).upload(path,audioFile,{contentType:audioFile.type||"audio/mpeg",upsert:false});if(r.error)throw r.error;
    let coverPath=null,coverMime=null;
    if(coverFile){if(!coverFile.type.startsWith("image/"))throw new Error("La portada debe ser una imagen.");const coverSafe=coverFile.name.replace(/[^a-zA-Z0-9._-]/g,"_");coverPath=`${s.user.id}/covers/${crypto.randomUUID()}-${coverSafe}`;r=await supabaseClient.storage.from(BUCKET).upload(coverPath,coverFile,{contentType:coverFile.type,upsert:false});if(r.error){await supabaseClient.storage.from(BUCKET).remove([path]);throw r.error}coverMime=coverFile.type}
    r=await supabaseClient.from("songs").insert({user_id:s.user.id,title,artist,storage_path:path,file_name:audioFile.name,mime_type:audioFile.type||"audio/mpeg",cover_path:coverPath,cover_mime_type:coverMime});
    if(r.error){await supabaseClient.storage.from(BUCKET).remove([path,...(coverPath?[coverPath]:[])]);throw r.error}
    progress.textContent=coverPath?"¡Canción y portada subidas!":"¡Canción subida!";setTimeout(closeUploadModal,700);await loadSongs();
  }catch(err){progress.textContent="No se pudo subir: "+err.message;progress.classList.add("error")}finally{btn.disabled=false}
};

function setNav(view){document.querySelectorAll(".nav").forEach(b=>b.classList.toggle("active",b.dataset.view===view))}
document.querySelectorAll(".nav").forEach(b=>b.onclick=async()=>{const v=b.dataset.view;currentView=v;setNav(v);$("homeView").classList.toggle("hidden",v!=="home");$("contentView").classList.toggle("hidden",v==="profile");$("profileView").classList.toggle("hidden",v!=="profile");if(v==="home")renderCurrent();else if(v==="search"){search.focus();renderSongs(filterSongs(search.value),"Resultados de búsqueda","Busca por título o artista")}else if(v==="favorites")await renderFavorites();else if(v==="playlists")await renderPlaylists();else if(v==="profile")updateProfile()});
async function updateStats(){$("statSongs").textContent=songs.length;$("statFavs").textContent=favorites.size;$("statPlaylists").textContent=playlists.length}
async function updateProfile(){const s=await session();$("profileEmail").textContent=s?.user?.email||"Invitado";$("profileState").textContent=s?"Cuenta activa. Tu biblioteca es privada.":"Inicia sesión para usar tu biblioteca.";$("profileLogin").classList.toggle("hidden",!!s);$("profileLogout").classList.toggle("hidden",!s);updateStats()}
async function updateAccount(){const s=await session();$("userEmail").textContent=s?.user?.email||"Invitado";$("accountBtn").textContent=s?"Cerrar sesión":"Iniciar sesión";$("sideAccount").textContent=s?"Cerrar sesión":"Iniciar sesión";$("profileEmail").textContent=s?.user?.email||"Invitado";uploadEnabled(!!s);updateProfile()}
function openAuth(){$("authPanel").classList.remove("hidden")}
$("accountBtn").onclick=async()=>{const s=await session();if(s){await supabaseClient.auth.signOut()}else openAuth()};$("sideAccount").onclick=async()=>{const s=await session();if(s)await supabaseClient.auth.signOut();else openAuth()};$("profileLogin").onclick=openAuth;$("profileLogout").onclick=()=>supabaseClient.auth.signOut();$("closeAuth").onclick=()=>$("authPanel").classList.add("hidden");
let signUpMode=false;$("switchAuth").onclick=()=>{signUpMode=!signUpMode;$("authTitle").textContent=signUpMode?"Crear cuenta":"Iniciar sesión";$("authSubmit").textContent=signUpMode?"Registrarme":"Iniciar sesión";$("switchAuth").textContent=signUpMode?"Ya tengo una cuenta":"Crear cuenta";$("authMessage").textContent=signUpMode?"Crea una cuenta para usar tu biblioteca.":"Accede a tu biblioteca de Mi Música."};
$("authSubmit").onclick=async()=>{const email=$("email").value.trim(),password=$("password").value;if(!email||!password||password.length<6){alert("Escribe un correo y una contraseña de al menos 6 caracteres.");return}const r=signUpMode?await supabaseClient.auth.signUp({email,password}):await supabaseClient.auth.signInWithPassword({email,password});if(r.error){alert(r.error.message);return}if(signUpMode&&!r.data.session)alert("Cuenta creada. Revisa tu correo si Supabase solicita confirmación.");$("authPanel").classList.add("hidden");await updateAccount();await loadSongs()};
supabaseClient.auth.onAuthStateChange(()=>{setTimeout(async()=>{await updateAccount();await loadSongs()},0)});
play.onclick=async()=>{if(index<0&&songs.length)await playSongById(songs[0].id);else if(audio.paused)await audio.play();else audio.pause()};$("prev").onclick=async()=>{if(!songs.length)return;await playSongById(songs[(index-1+songs.length)%songs.length].id)};$("next").onclick=async()=>{if(!songs.length)return;if(shuffleMode&&songs.length>1){let n=index;while(n===index)n=Math.floor(Math.random()*songs.length);await playSongById(songs[n].id)}else await playSongById(songs[(index+1)%songs.length].id)};
audio.ontimeupdate=()=>{seek.value=audio.duration?(audio.currentTime/audio.duration)*100:0;current.textContent=fmt(audio.currentTime);duration.textContent=fmt(audio.duration)};audio.onplay=()=>{play.textContent="⏸";startMusicVisualizer()};audio.onpause=()=>{play.textContent="▶";document.body.classList.remove("audio-playing");document.body.style.setProperty("--music-level","0")};audio.onended=()=>{if(!repeatMode)$("next").click()};seek.oninput=()=>{if(audio.duration)audio.currentTime=seek.value/100*audio.duration};
$("shuffle").onclick=()=>{shuffleMode=!shuffleMode;$("shuffle").classList.toggle("active",shuffleMode);status(shuffleMode?"Aleatorio activado.":"Aleatorio desactivado.")};$("repeat").onclick=()=>{repeatMode=!repeatMode;audio.loop=repeatMode;$("repeat").classList.toggle("active",repeatMode);status(repeatMode?"Repetición activada.":"Repetición desactivada.")};$("mute").onclick=()=>{audio.muted=!audio.muted;$("mute").textContent=audio.muted?"🔇":"🔊"};$("volume").oninput=e=>{audio.volume=Number(e.target.value);audio.muted=audio.volume===0;$("mute").textContent=audio.muted?"🔇":"🔊"};audio.volume=1;
(async()=>{await updateAccount();await loadSongs()})();
