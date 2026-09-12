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
