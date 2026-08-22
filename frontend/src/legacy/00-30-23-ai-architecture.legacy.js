/* =========================================================================
   23 AI Architecture
   ========================================================================= */
const AI = {
  normalizeApiRoot(baseUrl){
    let base = (baseUrl||'').trim().replace(/\/+$/,'');
    base = base.replace(/\/(?:v1\/)?(?:chat\/completions|responses|completions|models)$/i, '');
    base = base.replace(/\/v1$/i, '');
    return base.replace(/\/+$/,'');
  },
  normalizeEndpoint(baseUrl, mode){
    const root = AI.normalizeApiRoot(baseUrl);
    return root + (mode==='responses' ? '/v1/responses' : '/v1/chat/completions');
  },
  normalizeModelsEndpoint(baseUrl){
    return AI.normalizeApiRoot(baseUrl) + '/v1/models';
  },
  prepareMessages(messages){
    const source = Array.isArray(messages) ? messages : [];
    const systemParts = [];
    const rest = [];
    source.forEach(m=>{
      if(!m) return;
      const role = m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user';
      const content = m.content == null ? '' : String(m.content);
      if(role === 'system'){
        if(content.trim()) systemParts.push(content);
      }else if(content.trim() || role === 'assistant'){
        rest.push({role, content});
      }
    });
    return systemParts.length ? [{role:'system', content:systemParts.join('\n\n')}].concat(rest) : rest;
  },
  responseText(data){
    if(!data) return '';
    return data.output_text
      || (data.output && data.output[0] && data.output[0].content && data.output[0].content[0] && (data.output[0].content[0].text || data.output[0].content[0].output_text))
      || (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content)
      || '';
  },
  async httpError(res){
    const text = await res.text().catch(()=> '');
    let detail = text;
    try{
      const parsed = JSON.parse(text);
      detail = (parsed && parsed.error && (parsed.error.message || parsed.error.detail))
        || parsed.detail || parsed.message || text;
    }catch(e){}
    detail = String(detail || '').replace(/\s+/g,' ').trim();
    return new Error('HTTP ' + res.status + (detail ? ' · ' + detail.slice(0,500) : ''));
  }
};
const AICommands = {
  async chat(settings, messages){
    if(!settings.endpoint || !settings.model){
      throw new Error('설정에서 AI 엔드포인트와 모델을 먼저 구성하세요.');
    }
    const endpoint = AI.normalizeEndpoint(settings.endpoint, settings.apiMode);
    const headers = Object.assign({'Content-Type':'application/json'}, settings.apiKey ? {'Authorization':'Bearer '+settings.apiKey} : {});
    const preparedMessages = AI.prepareMessages(messages);
    let body, res, data;
    if(settings.apiMode === 'responses'){
      const inputText = preparedMessages.map(m => (m.role==='system'?'[System]\n':m.role==='assistant'?'[Assistant]\n':'[User]\n') + m.content).join('\n\n');
      body = {model: settings.model, input: inputText};
      res = await fetch(endpoint, {method:'POST', headers, body: JSON.stringify(body)});
      if(!res.ok) throw await AI.httpError(res);
      data = await res.json();
      return AI.responseText(data) || JSON.stringify(data);
    } else {
      body = {model: settings.model, messages: preparedMessages};
      res = await fetch(endpoint, {method:'POST', headers, body: JSON.stringify(body)});
      if(!res.ok) throw await AI.httpError(res);
      data = await res.json();
      return AI.responseText(data) || JSON.stringify(data);
    }
  },
  async chatStream(settings, messages, onDelta){
    if(!settings.endpoint || !settings.model){
      throw new Error('설정에서 AI 엔드포인트와 모델을 먼저 구성하세요.');
    }
    const endpoint = AI.normalizeEndpoint(settings.endpoint, settings.apiMode);
    const headers = Object.assign({'Content-Type':'application/json'}, settings.apiKey ? {'Authorization':'Bearer '+settings.apiKey} : {});
    const preparedMessages = AI.prepareMessages(messages);
    let body;
    if(settings.apiMode === 'responses'){
      const inputText = preparedMessages.map(m => (m.role==='system'?'[System]\n':m.role==='assistant'?'[Assistant]\n':'[User]\n') + m.content).join('\n\n');
      body = {model: settings.model, input: inputText, stream: true};
    } else {
      body = {model: settings.model, messages: preparedMessages, stream: true};
    }
    const res = await fetch(endpoint, {method:'POST', headers, body: JSON.stringify(body)});
    if(!res.ok){
      const streamFallbackStatuses = new Set([400,404,405,415,422,501]);
      if(!streamFallbackStatuses.has(Number(res.status))) throw await AI.httpError(res);
      const full = await AICommands.chat(settings, preparedMessages);
      if(onDelta) onDelta(full, full);
      return full;
    }
    const contentType = (res.headers && res.headers.get && res.headers.get('content-type')) || '';
    if(!res.body || typeof res.body.getReader !== 'function' || contentType.indexOf('text/event-stream') === -1){
      let full = '';
      try{
        const data = await res.json();
        full = AI.responseText(data);
      }catch(e){ full = ''; }
      if(!full){
        full = await AICommands.chat(settings, preparedMessages);
      }
      if(onDelta) onDelta(full, full);
      return full;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let full = '';
    try{
      while(true){
        const {done, value} = await reader.read();
        if(done) break;
        buffer += decoder.decode(value, {stream:true});
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for(const line of lines){
          const trimmed = line.trim();
          if(!trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.slice(5).trim();
          if(!dataStr || dataStr === '[DONE]') continue;
          let parsed;
          try{ parsed = JSON.parse(dataStr); }catch(e){ continue; }
          const delta = (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content)
            || (typeof parsed.delta === 'string' ? parsed.delta : '')
            || (parsed.type === 'response.output_text.delta' && typeof parsed.delta === 'string' ? parsed.delta : '')
            || '';
          if(delta){ full += delta; if(onDelta) onDelta(delta, full); }
        }
      }
    }catch(e){
      if(full) return full;
      const fallback = await AICommands.chat(settings, preparedMessages);
      if(onDelta) onDelta(fallback, fallback);
      return fallback;
    }
    if(!full){
      full = await AICommands.chat(settings, preparedMessages);
      if(onDelta) onDelta(full, full);
    }
    return full;
  },
  async request(settings, prompt){
    return AICommands.chat(settings, [{role:'user', content: prompt}]);
  }
};
