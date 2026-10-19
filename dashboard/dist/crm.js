(() => {
  let detailedFollowups = [];
  const editor = document.querySelector('#followup-editor');
  const field = (name, label, control, wide = '') => `<div class="field ${wide}"><label>${label}</label>${control.replace('FIELD', name)}</div>`;
  window.openCrmFollowup = (eventKey, row) => {
    const opportunity = opportunities.find(item => item.eventKey === eventKey); if (!opportunity) return;
    const current = detailedFollowups.find(item => item.event_key === eventKey) || {};
    document.querySelectorAll('.followup-row').forEach(item => item.classList.toggle('selected', item === row));
    editor.hidden = false;
    editor.innerHTML = `<div class="panel-head"><div><h3>${safe(opportunity.company)} · ${safe(opportunity.project)}</h3><span>Editá el seguimiento y definí el próximo paso</span></div><button class="secondary" id="close-followup">Cerrar</button></div><div class="crm-followup"><form class="form-grid">${field('stage','Etapa comercial','<select name="FIELD"><option>Prospecto</option><option>Contactado</option><option>Reunión agendada</option><option>Necesidad relevada</option><option>Propuesta enviada</option><option>Negociación</option><option>Ganada</option><option>Perdida</option></select>')}${field('outcome','Resultado','<select name="FIELD"><option>Sin respuesta</option><option>Interesado</option><option>Requiere información</option><option>Reunión acordada</option><option>No es el momento</option><option>Sin encaje</option></select>')}${field('summary','Resumen de lo conversado','<textarea name="FIELD" required placeholder="Qué se habló, necesidades, objeciones y compromisos…"></textarea>','wide')}${field('owner','Responsable','<input name="FIELD" placeholder="Nombre del comercial">')}${field('probability','Probabilidad','<select name="FIELD"><option value="10">10%</option><option value="25">25%</option><option value="50">50%</option><option value="75">75%</option><option value="90">90%</option></select>')}${field('nextAction','Próxima acción','<input name="FIELD" placeholder="Ej. Enviar propuesta de alcance">','wide')}${field('nextContactAt','Próximo contacto','<input name="FIELD" type="datetime-local">')}<div class="field wide"><div class="crm-actions"><button class="primary" type="submit">Guardar cambios</button></div></div></form></div>`;
    const form = editor.querySelector('form');
    const values = { stage: current.stage, outcome: current.outcome, summary: current.summary || current.notes, owner: current.owner, probability: current.probability, nextAction: current.next_action };
    Object.entries(values).forEach(([name, value]) => { if (value !== undefined && value !== null) form.elements[name].value = value; });
    if (current.next_contact_at) form.elements.nextContactAt.value = String(current.next_contact_at).slice(0, 16);
    editor.querySelector('#close-followup').onclick = () => { editor.hidden = true; row.classList.remove('selected'); };
    form.onsubmit = async event => {
      event.preventDefault(); const data = Object.fromEntries(new FormData(form)); data.eventKey = eventKey;
      const outlookWindow = data.nextContactAt ? window.open('about:blank', 'radar-outlook') : null;
      const response = await fetch('/api/followup-detail', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
      const result = await response.json();
      if (!response.ok) { outlookWindow?.close(); return showToast(result.error || 'No se pudo guardar'); }
      if (outlookWindow && result.outlookUrl) outlookWindow.location = result.outlookUrl;
      showToast(outlookWindow ? 'Seguimiento guardado · completá el evento en Outlook' : 'Seguimiento actualizado');
      setTimeout(() => location.reload(), 700);
    };
    editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  window.startCrmFollowup = async () => {
    if (!selected?.eventKey) return;
    const response = await fetch('/api/followup-detail', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eventKey: selected.eventKey, stage: 'Prospecto', outcome: 'Sin respuesta', summary: 'Seguimiento iniciado. Completar el resumen después del primer contacto.', owner: '', probability: 10, nextAction: 'Realizar primer contacto', nextContactAt: '' }) });
    if (!response.ok) return showToast('No se pudo iniciar el seguimiento');
    sessionStorage.setItem('open-followups', '1'); location.reload();
  };
  fetch('/api/followups').then(response => response.json()).then(result => { detailedFollowups = result.data || []; if (sessionStorage.getItem('open-followups')) { sessionStorage.removeItem('open-followups'); document.querySelector('.nav button[data-view="followups"]').click(); } });
})();
