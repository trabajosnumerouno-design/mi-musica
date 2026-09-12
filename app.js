const SUPABASE_URL = "https://mqkoiyqaeyoiefeoxusy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Il7ZpPjVF9nRWc6Him0uFg_AN59J6li";
const BUCKET = "music";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const input=document.getElementById('fileInput');
const coverInput=document.getElementById('coverInput');
const chooseCover=document.getElementById('chooseCover');
const coverName=document.getElementById('coverName');
const uploadLabel=document.getElementById('uploadLabel');
const library=document.getElementById('library');
const audio=document.getElementById('audio');
const play=document.getElementById('play');
const search=document.getElementById('search');
const seek=document.getElementById('seek');
const current=document.getElementById('current');
const duration=document.getElementById('duration');
const nowTitle=document.getElementById('nowTitle');
const nowArtist=document.getElementById('nowArtist');
const nowCover=document.getElementById('cover');
const count=document.getElementById('count');
const statusBox=document.getElementById('status');
let songs=[], index=-1, currentObjectUrl=null, selectedCover=null;

const fmt=s=>{if(!isFinite(s))return"0:00";return Math.floor(s/60)+":"+String(Math.floor(s%60)).padStart(2,"0")};
function escapeHtml(x){return String(x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function showStatus(msg,error=false){statusBox.textContent=msg;statusBox.classList.remove('hidden');statusBox.classList.toggle('error',error);if(!error)setTimeout(()=>statusBox.classList.add('hidden'),3500)}
function setUploadEnabled(enabled){uploadLabel.style.opacity=enabled?'1':'.55';uploadLabel.style.pointerEvents=enabled?'auto':'none';chooseCover.disabled=!enabled;chooseCover.style.opacity=enabled?'1':'.55'}

async function getSession(){return (await supabaseClient.auth.getSession()).data.session}

chooseCover.onclick=()=>coverInput.click();
coverInput.onchange=()=>{selectedCover=coverInput.files?.[0]||null;coverName.textContent=selectedCover?selectedCover.name:'Portada opcional'};

async function loadSongs(){
  const session=await getSession();
  if(!session){songs=[];render([]);setUploadEnabled(false);return}
  setUploadEnabled(true);
  const {data,error}=await supabaseClient.from('songs').select('*').order('created_at',{ascending:false});
  if(error){showStatus('No se pudo cargar la biblioteca: '+error.message,true);return}
  songs=data||[];render(songs);
}

input.onchange=async e=>{
  const session=await getSession();
  if(!session){alert('Primero inicia sesión.');input.value='';return}
  const files=[...e.target.files];
  if(!files.length)return;
  for(const file of files){
    if(!file.type.startsWith('audio/'))continue;
    try{
      showStatus('Subiendo '+file.name+'...');
      const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      const path=`${session.user.id}/${crypto.randomUUID()}-${safeName}`;
      const upload=await supabaseClient.storage.from(BUCKET).upload(path,file,{contentType:file.type||'audio/mpeg',upsert:false});
      if(upload.error)throw upload.error;

      let coverPath=null, coverMime=null;
      if(selectedCover){
        if(!selectedCover.type.startsWith('image/'))throw new Error('La portada debe ser una imagen.');
        const safeCover=selectedCover.name.replace(/[^a-zA-Z0-9._-]/g,'_');
        coverPath=`${session.user.id}/covers/${crypto.randomUUID()}-${safeCover}`;
        const coverUpload=await supabaseClient.storage.from(BUCKET).upload(coverPath,selectedCover,{contentType:selectedCover.type,upsert:false});
        if(coverUpload.error)throw coverUpload.error;
        coverMime=selectedCover.type;
      }

      const insert=await supabaseClient.from('songs').insert({
        user_id:session.user.id,
        title:file.name.replace(/\.[^/.]+$/,''),
        artist:'Mi biblioteca',
        storage_path:path,
        file_name:file.name,
        mime_type:file.type||'audio/mpeg',
        cover_path:coverPath,
        cover_mime_type:coverMime
      }).select().single();

      if(insert.error){
        await supabaseClient.storage.from(BUCKET).remove([path]);
        if(coverPath)await supabaseClient.storage.from(BUCKET).remove([coverPath]);
        throw insert.error;
      }
    }catch(err){showStatus('No se pudo subir '+file.name+': '+err.message,true)}
  }
  input.value='';
  selectedCover=null;
  coverInput.value='';
  coverName.textContent='Portada opcional';
  await loadSongs();
};

async function getCoverUrl(song){
  if(!song.cover_path)return null;
  const {data,error}=await supabaseClient.storage.from(BUCKET).createSignedUrl(song.cover_path,3600);
  return error?null:data?.signedUrl||null;
}

async function render(list=songs){
  count.textContent=`${list.length} ${list.length===1?'canción':'canciones'}`;
  if(!list.length){library.innerHTML='<div class="empty">Todavía no hay canciones en tu cuenta. Usa “Subir música” para agregar una.</div>';return}
  library.innerHTML=list.map(s=>`
    <div class="song">
      <div class="thumb" id="thumb-${s.id}">🎵</div>
      <div><div class="song-title">${escapeHtml(s.title)}</div><div class="song-meta">${escapeHtml(s.artist||'Mi biblioteca')}</div></div>
      <button onclick="playSongById('${s.id}')">▶</button>
      <button class="download" onclick="downloadSongById('${s.id}')">⬇</button>
    </div>`).join('');

  await Promise.all(list.map(async s=>{
    const url=await getCoverUrl(s);
    if(url){
      const el=document.getElementById('thumb-'+s.id);
      if(el)el.innerHTML=`<img src="${url}" alt="Portada de ${escapeHtml(s.title)}">`;
    }
  }));
}

async function playSongById(id){
  const i=songs.findIndex(s=>s.id===id); if(i<0)return;
  index=i;
  const song=songs[i];
  const {data,error}=await supabaseClient.storage.from(BUCKET).createSignedUrl(song.storage_path,3600);
  if(error){showStatus('No se pudo reproducir la canción: '+error.message,true);return}
  if(currentObjectUrl){URL.revokeObjectURL(currentObjectUrl);currentObjectUrl=null}
  audio.src=data.signedUrl;
  audio.play();
  nowTitle.textContent=song.title;
  nowArtist.textContent=song.artist||'Mi biblioteca';
  const coverUrl=await getCoverUrl(song);
  nowCover.innerHTML=coverUrl?`<img src="${coverUrl}" alt="Portada">`:'🎵';
  play.textContent='⏸';
}
window.playSongById=playSongById;

async function downloadSongById(id){
  const song=songs.find(s=>s.id===id);if(!song)return;
  const {data,error}=await supabaseClient.storage.from(BUCKET).createSignedUrl(song.storage_path,300);
  if(error){showStatus('No se pudo preparar la descarga: '+error.message,true);return}
  const a=document.createElement('a');a.href=data.signedUrl;a.download=song.file_name||song.title;a.target='_blank';document.body.appendChild(a);a.click();a.remove();
}
window.downloadSongById=downloadSongById;

play.onclick=()=>{if(index<0&&songs.length)playSongById(songs[0].id);else if(audio.paused){audio.play();play.textContent='⏸'}else{audio.pause();play.textContent='▶'}};
document.getElementById('prev').onclick=()=>{if(songs.length)playSongById(songs[(index-1+songs.length)%songs.length].id)};
document.getElementById('next').onclick=()=>{if(songs.length)playSongById(songs[(index+1)%songs.length].id)};
audio.ontimeupdate=()=>{seek.value=audio.duration?(audio.currentTime/audio.duration)*100:0;current.textContent=fmt(audio.currentTime);duration.textContent=fmt(audio.duration)};
seek.oninput=()=>{if(audio.duration)audio.currentTime=(seek.value/100)*audio.duration};
audio.onended=()=>document.getElementById('next').click();
search.oninput=()=>{const q=search.value.toLowerCase();render(songs.filter(s=>(s.title||'').toLowerCase().includes(q)||(s.artist||'').toLowerCase().includes(q)))};

const authPanel=document.getElementById('authPanel');
const accountBtn=document.getElementById('accountBtn');
const closeAuth=document.getElementById('closeAuth');
const authSubmit=document.getElementById('authSubmit');
const switchAuth=document.getElementById('switchAuth');
const authTitle=document.getElementById('authTitle');
const authMessage=document.getElementById('authMessage');
const userEmail=document.getElementById('userEmail');
let signUpMode=false;

accountBtn.onclick=async()=>{
  const session=await getSession();
  if(session){await supabaseClient.auth.signOut();updateAccount();loadSongs()}
  else authPanel.classList.remove('hidden');
};
closeAuth.onclick=()=>authPanel.classList.add('hidden');
switchAuth.onclick=()=>{
  signUpMode=!signUpMode;
  authTitle.textContent=signUpMode?'Crear cuenta':'Iniciar sesión';
  authSubmit.textContent=signUpMode?'Registrarme':'Iniciar sesión';
  switchAuth.textContent=signUpMode?'Ya tengo una cuenta':'Crear cuenta';
  authMessage.textContent=signUpMode?'Crea una cuenta para usar tu biblioteca.':'Accede a tu biblioteca de Mi Música.';
};

authSubmit.onclick=async()=>{
  const email=document.getElementById('email').value.trim();
  const password=document.getElementById('password').value;
  if(!email||password.length<6){alert('Escribe un correo y una contraseña de al menos 6 caracteres.');return}
  let result=signUpMode?await supabaseClient.auth.signUp({email,password}):await supabaseClient.auth.signInWithPassword({email,password});
  if(result.error){alert(result.error.message);return}
  if(signUpMode&&!result.data.session){alert('Cuenta creada. Revisa tu correo si Supabase solicita confirmación.');}
  authPanel.classList.add('hidden');
  await updateAccount();
  await loadSongs();
};

async function updateAccount(){
  const session=await getSession();
  if(session){userEmail.textContent=session.user.email||'Usuario';accountBtn.textContent='Cerrar sesión';setUploadEnabled(true)}
  else{userEmail.textContent='Invitado';accountBtn.textContent='Iniciar sesión';setUploadEnabled(false)}
}
supabaseClient.auth.onAuthStateChange(()=>{updateAccount();loadSongs()});
(async()=>{await updateAccount();await loadSongs()})();
