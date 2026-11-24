// JARVIS: серверний AI, контекст діалогу, голосовий ввід/вивід і дії в навігаторі.
(function(){'use strict';
  function init(ctx){
    const {$,setView}=ctx,log=$('chatLog'),form=$('chatForm'),input=$('chatInput');
    if(!log||!form||!input)return;
    const state=$('jarvisState'),note=$('jarvisNote'),orb=$('jarvisOrb');
    let history=[],busy=false,voiceOn=true,recognition=null;
    const add=(text,who)=>{const el=document.createElement('div');el.className='chat-msg '+who;el.textContent=text;log.appendChild(el);log.scrollTop=log.scrollHeight;return el;};
    const setStatus=(label,mode='')=>{state.className='jarvis-state '+mode;state.querySelector('span').textContent=label;};
    const speak=text=>{if(!voiceOn||!('speechSynthesis'in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='uk-UA';u.rate=1;u.pitch=0.96;speechSynthesis.speak(u);};
    const catalog=()=>{const M=window.LN&&window.LN.M;return M&&Array.isArray(M.ents)?M.ents.map(e=>({name:e.value,id:e.id,floor:window.LN.floorName(window.LN.M.nodes[e.id].f)})):[];};
    function runAction(action){if(!action)return;
      if(action.type==='open_view'){setView(action.view);return;}
      if(action.type==='search_room'){setView('info');const f=$('flt');f.value=action.query;f.dispatchEvent(new Event('input'));return;}
      if(action.type==='route_to'){
        const match=catalog().find(x=>x.name.toLocaleLowerCase('uk-UA')===String(action.destination).toLocaleLowerCase('uk-UA'));
        if(!match){add('Я не можу виконати команду: такого приміщення немає в каталозі навігатора.','bot');return;}
        setView('nav');$('qb').value=match.name;
        if($('qa').value.trim())$('go').click();
        else add('Кінцеву точку встановлено: '+match.name+'. Тепер обери початкове місце у полі «Звідки?» та натисни «Побудувати маршрут».','bot');
      }
    }
    async function send(q){q=String(q||'').trim();if(!q||busy)return;add(q,'user');input.value='';busy=true;setStatus('ОБРОБКА ЗАПИТУ','working');orb.classList.add('thinking');const wait=add('JARVIS аналізує запит…','bot');
      try{
        const res=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:q,history,catalog:catalog()})});
        const data=await res.json();if(!res.ok)throw new Error(data.error||'Сервер повернув помилку.');
        const answer=data.reply||'Не отримав відповіді.';wait.textContent=answer;history.push({role:'user',content:q},{role:'assistant',content:answer});history=history.slice(-16);runAction(data.action);speak(answer);setStatus('СИСТЕМА АКТИВНА','ready');
      }catch(e){wait.textContent='Не вдалося отримати відповідь від JARVIS: '+e.message;setStatus('ПОМИЛКА ПІДКЛЮЧЕННЯ','error');}
      finally{busy=false;orb.classList.remove('thinking');log.scrollTop=log.scrollHeight;}
    }
    form.addEventListener('submit',e=>{e.preventDefault();send(input.value)});
    document.querySelectorAll('[data-prompt]').forEach(b=>b.addEventListener('click',()=>send(b.dataset.prompt)));
    $('jarvisVoice').addEventListener('click',()=>{voiceOn=!voiceOn;$('jarvisVoice').classList.toggle('on',voiceOn);$('jarvisVoice').textContent=voiceOn?'🔊 ОЗВУЧЕННЯ УВІМКНЕНО':'🔇 ОЗВУЧЕННЯ ВИМКНЕНО';if(!voiceOn&&'speechSynthesis'in window)speechSynthesis.cancel();});
    $('jarvisClear').addEventListener('click',()=>{history=[];log.innerHTML='';add('Історію поточного діалогу очищено. Чим можу допомогти?','bot');});
    const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    $('jarvisMic').addEventListener('click',()=>{
      if(!SpeechRecognition){note.textContent='Цей браузер не підтримує голосове розпізнавання. Спробуй Chrome або Edge.';return;}
      if(recognition){recognition.stop();recognition=null;return;}
      recognition=new SpeechRecognition();recognition.lang='uk-UA';recognition.interimResults=false;recognition.maxAlternatives=1;
      recognition.onstart=()=>{setStatus('СЛУХАЮ','working');orb.classList.add('listening');note.textContent='JARVIS слухає… Говори українською.';};
      recognition.onresult=e=>{const heard=e.results[0][0].transcript;input.value=heard;send(heard);};
      recognition.onerror=e=>{note.textContent='Помилка голосового вводу: '+e.error;setStatus('СИСТЕМА АКТИВНА','ready');};
      recognition.onend=()=>{recognition=null;orb.classList.remove('listening');if(!busy)setStatus('СИСТЕМА АКТИВНА','ready');};
      try{recognition.start();}catch(e){note.textContent='Не вдалося запустити мікрофон. Перевір дозвіл браузера та HTTPS.';recognition=null;}
    });
    fetch('/api/health').then(r=>r.json()).then(d=>{if(d.configured){setStatus('СИСТЕМА АКТИВНА','ready');note.textContent='JARVIS підключений до серверної ШІ-моделі. Голосові функції залежать від підтримки браузера.';}else{setStatus('ПОТРІБЕН API-КЛЮЧ','error');note.textContent='Сервер запущено, але не задано OPENAI_API_KEY. Дивись .env.example та README.md.';}}).catch(()=>{setStatus('СЕРВЕР НЕ ЗАПУЩЕНО','error');note.textContent='Відкрий застосунок через start-jarvis.bat або запусти python server.py. Не відкривай index.html напряму.';});
  }
  window.LNAssistant={init};
})();
