const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const dateTime = (value) => value ? new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(value)) : "Sin ejecuciones";
document.querySelector("#dashboard-version").textContent = "Panel v6.1 · fuentes e inteligencia";
const piresCompany = (value) => {
  const name = String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (/(^| )sga( |$)/.test(name)) return "SGA";
  if (/(^| )dls( |$)/.test(name)) return "DLS";
  if (/(^| )opsur( |$)/.test(name)) return "OPSUR";
  if (name.includes("vientos del sur")) return "Vientos del Sur";
  return "";
};

async function loadRealData() {
  const response = await fetch("/api/dashboard", { cache: "no-store" });
  if (!response.ok) throw new Error("No se pudieron cargar los datos del Radar");
  const data = await response.json();
  const contacts = data.contacts || [];
  const followups = data.followups || [];
  const contractBody = document.querySelector("#contract-body");
  const contracts = data.contracts || [];
  const shortDate = (value) => value ? new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${String(value).slice(0,10)}T12:00:00Z`)) : "Sin dato";
  contractBody.innerHTML = contracts.map((row) => { const value = row.finding || {}; const confidence = Number(row.confidence || 0); const base = row.expiry_label ? safe(row.expiry_label) : shortDate(row.base_end_date); return `<tr><td><div class="company">${safe(value.operator || "Operadora sin identificar")}</div><div class="location">${safe(value.provider || "Prestadora no publicada")}</div></td><td><div>${safe(value.service)}</div><div class="location">${safe(value.basin || value.province || "Argentina")}</div></td><td>${base}</td><td>${row.expiry_label ? "No publicada" : shortDate(row.option_end_date)}</td><td><span class="tag ${confidence >= 85 ? "high" : confidence >= 60 ? "contact" : "early"}">${confidence}%</span><div class="location">${confidence >= 85 ? "Alta" : confidence >= 60 ? "Media" : "Baja"}</div></td><td><button class="secondary" onclick="window.open('${safe(row.source_url)}','_blank','noopener')">Abrir</button></td></tr>`; }).join("");
  document.querySelector("#contract-count").textContent = `${contracts.length} contrato${contracts.length === 1 ? "" : "s"} identificado${contracts.length === 1 ? "" : "s"}`;
  document.querySelector("#contract-empty").hidden = contracts.length > 0;
  const relevant = data.opportunities.filter((row) => row.opportunity.relevante);
  const qualified = relevant.filter((row) => row.opportunity.score_radar >= 75);
  const piresOpportunities = relevant.filter((row) => piresCompany(row.opportunity.empresa));
  const prioritized = relevant.filter((row) => row.opportunity.score_radar >= 75 || piresCompany(row.opportunity.empresa));
  opportunities.splice(0, opportunities.length, ...prioritized.map((row, index) => {
    const value = row.opportunity;
    const followup = followups.find((item) => item.event_key === row.event_key);
    const displayedAction = followup?.status === "contacted" ? "CONTACTADO" : followup?.status === "replied" ? "RESPONDIÓ" : safe(value.tipo_accion);
    return {
      id: index + 1, eventKey: row.event_key,
      company: safe(value.empresa || "Empresa sin identificar"), project: safe(value.proyecto || row.title),
      signal: safe(value.tipo_senal), score: value.score_radar, priority: safe(value.prioridad), stage: safe(value.etapa_temporal),
      action: displayedAction, suggestedAction: safe(value.tipo_accion), location: safe(value.provincia || value.cuenca || "Argentina"),
      basin: safe(value.cuenca || "Sin determinar"), province: safe(value.provincia || "Sin determinar"),
      piress: safe(piresCompany(value.empresa)), summary: safe(value.analisis_ia || value.resumen_evidencia),
      evidence: safe((value.hechos_publicados || []).join(" · ") || value.resumen_evidencia),
      services: (value.servicios_vermaz || []).map((item) => safe(item.servicio)), next: safe(value.accion_sugerida),
      targetRole: safe(value.cargo_objetivo || value.area_objetivo),
      sourceUrl: row.source_url,
    };
  }));
  const fillFilter = (selector, values) => { const select = document.querySelector(selector); [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")).forEach((value) => select.add(new Option(value, value))); };
  fillFilter("#filter-company", opportunities.map((item) => item.company));
  fillFilter("#filter-basin", opportunities.map((item) => item.basin));
  fillFilter("#filter-province", opportunities.map((item) => item.province));
  fillFilter("#filter-service", opportunities.flatMap((item) => item.services));
  fillFilter("#filter-stage", opportunities.map((item) => item.stage));
  fillFilter("#filter-action", opportunities.map((item) => item.action));
  selected = opportunities[0];
  const metricValues = document.querySelectorAll(".metric-value");
  metricValues[0].textContent = String(contracts.length);
  metricValues[1].textContent = String(qualified.length);
  const activeFollowups = followups.filter((item) => ["contacted", "replied"].includes(item.status));
  metricValues[2].textContent = String(activeFollowups.length);
  metricValues[3].textContent = String(piresOpportunities.length);
  const lastRun = data.runs[0];
  document.querySelector(".section-lead p").textContent = `Última ejecución: ${dateTime(lastRun?.finished_at)} · ${lastRun?.summary?.sourcesSucceeded ?? 0} fuentes procesadas`;
  const badge = document.querySelector(".demo-badge");
  badge.textContent = data.dryRun ? "Simulación activa" : "Attio activo";
  const button = document.querySelector("#run-demo");
  button.textContent = data.running ? "Ejecutando…" : "Ejecutar Radar";
  button.disabled = data.running;
  button.onclick = async () => {
    button.disabled = true; button.textContent = "Iniciando…";
    const run = await fetch("/api/run", { method: "POST" });
    const result = await run.json(); showToast(result.message);
    setTimeout(() => location.reload(), 4000);
  };
  const contractsSummary = document.querySelector("#contracts-summary");
  const openContracts = () => document.querySelector('.nav button[data-view="contracts"]').click();
  contractsSummary.onclick = openContracts;
  contractsSummary.onkeydown = (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openContracts(); } };
  const followupsSummary = document.querySelector("#followups-summary");
  const openFollowups = () => document.querySelector('.nav button[data-view="followups"]').click();
  followupsSummary.onclick = openFollowups;
  followupsSummary.onkeydown = (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openFollowups(); } };
  document.querySelector("#contact-body").innerHTML = contacts.map((contact) => `<tr><td><div class="company">${safe(contact.name)}</div></td><td><div>${safe(contact.company)}</div><div class="location">${safe(contact.role)}</div></td><td>${contact.email ? `<a href="mailto:${safe(contact.email)}">${safe(contact.email)}</a>` : "—"}</td><td>${safe(contact.phone || "—")}</td><td>${contact.linkedin_url ? `<a href="${safe(contact.linkedin_url)}" target="_blank" rel="noopener">Abrir perfil</a>` : "—"}</td><td>${safe(contact.internal_owner || "—")}</td></tr>`).join("");
  document.querySelector("#contact-count").textContent = `${contacts.length} contacto${contacts.length === 1 ? "" : "s"}`;
  document.querySelector("#contact-empty").hidden = contacts.length > 0;
  const normalizeCompany = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\b(s a|srl|sociedad anonima|ltd|limited|energia|energy)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const followupLabel = (status) => ({ pending: "Pendiente", contacted: "Contactado", replied: "Respondió", discarded: "Descartado" })[status] || status;
  const renderFollowups = () => {
    const active = followups.filter((item) => ["contacted", "replied"].includes(item.status)).map((item) => ({ item, opportunity: opportunities.find((value) => value.eventKey === item.event_key) })).filter((entry) => entry.opportunity);
    document.querySelector("#followup-body").innerHTML = active.map(({ item, opportunity }) => `<tr><td><div class="company">${opportunity.company}</div><div class="location">${opportunity.project} · ${opportunity.location}</div></td><td class="signal">${opportunity.signal}</td><td><span class="tag ${item.status === "replied" ? "high" : "contact"}">${followupLabel(item.status)}</span></td><td>${dateTime(item.contacted_at || item.updated_at)}</td><td><div class="service-list">${item.status === "contacted" ? `<button class="primary" onclick="markReplied('${safe(opportunity.eventKey)}')">Marcar respondió</button>` : '<span class="tag high">Respuesta registrada</span>'}<button class="secondary" onclick="discardFollowup('${safe(opportunity.eventKey)}')">Descartar</button></div></td></tr>`).join("");
    document.querySelector("#followup-count").textContent = `${active.length} seguimiento${active.length === 1 ? "" : "s"}`;
    document.querySelector("#followup-empty").hidden = active.length > 0;
    metricValues[2].textContent = String(active.length);
  };
  renderFollowups();
  const originalRenderDetail = renderDetail;
  renderDetail = function () {
    originalRenderDetail();
    if (!selected) return;
    const company = normalizeCompany(selected.company);
    const sameCompany = contacts.filter((contact) => { const candidate = normalizeCompany(contact.company); return candidate && company && (candidate === company || candidate.includes(company) || company.includes(candidate)); });
    const roleWords = String(selected.targetRole || "").toLowerCase().split(/\s+/).filter((word) => word.length > 4);
    const exact = sameCompany.filter((contact) => roleWords.some((word) => String(contact.role || "").toLowerCase().includes(word)));
    const ordered = [...exact, ...sameCompany.filter((contact) => !exact.includes(contact))].slice(0, 5);
    const cards = ordered.map((contact) => `<div style="padding:9px 0;border-bottom:1px solid #edf1f3"><strong style="font-size:.76rem">${safe(contact.name)}</strong>${exact.includes(contact) ? '<span class="tag high" style="margin-left:6px">Coincidencia</span>' : ''}<div class="location">${safe(contact.role || "Sin cargo")} · ${safe(contact.company)}</div><div style="margin-top:5px">${contact.email ? `<a href="mailto:${safe(contact.email)}">${safe(contact.email)}</a>` : ""}${contact.linkedin_url ? ` · <a href="${safe(contact.linkedin_url)}" target="_blank" rel="noopener">LinkedIn</a>` : ""}</div></div>`).join("");
    const linkedinSearch = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${selected.targetRole || "Gerente de Operaciones"} ${selected.company}`)}`;
    const current = followups.find((item) => item.event_key === selected.eventKey);
    const stateButton = (status, label) => `<button class="${current?.status === status ? "primary" : "secondary"}" onclick="saveFollowup('${status}')">${label}</button>`;
    detail.querySelector(".detail-body").insertAdjacentHTML("beforeend", `<div class="detail-section"><h4>Contactos disponibles</h4>${cards || '<p>No tenés contactos conocidos en esta empresa.</p>'}<div class="detail-footer"><a class="secondary" href="${linkedinSearch}" target="_blank" rel="noopener">Buscar perfil en LinkedIn</a></div></div><div class="detail-section"><h4>Seguimiento comercial</h4><div class="service-list">${stateButton("pending", "Pendiente")}${stateButton("contacted", "Contactado")}${stateButton("replied", "Respondió")}${stateButton("discarded", "Descartado")}</div><p class="location" style="margin-top:8px">Estado actual: ${followupLabel(current?.status || "Sin registrar")}${current?.contacted_at ? ` · Último contacto: ${dateTime(current.contacted_at)}` : ""}</p></div>`);
  };
  const persistFollowup = async (eventKey, status) => { const result = await fetch("/api/followup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventKey, status }) }); if (!result.ok) throw new Error("No se pudo actualizar el seguimiento"); const existing = followups.find((item) => item.event_key === eventKey); const now = new Date().toISOString(); if (existing) { existing.status = status; existing.updated_at = now; if (status === "contacted") existing.contacted_at = now; } else followups.push({ event_key: eventKey, status, updated_at: now, contacted_at: status === "contacted" ? now : null }); const opportunity = opportunities.find((item) => item.eventKey === eventKey); if (opportunity) opportunity.action = status === "contacted" ? "CONTACTADO" : status === "replied" ? "RESPONDIÓ" : status === "discarded" ? "DESCARTADO" : opportunity.suggestedAction; };
  window.saveFollowup = async (status) => { if (!selected?.eventKey) return; try { await persistFollowup(selected.eventKey, status); renderTable(); renderDetail(); renderFollowups(); showToast("Seguimiento actualizado"); } catch (error) { showToast(error.message); } };
  window.markReplied = async (eventKey) => { try { await persistFollowup(eventKey, "replied"); renderTable(); renderDetail(); renderFollowups(); showToast("Respuesta registrada"); } catch (error) { showToast(error.message); } };
  window.discardFollowup = async (eventKey) => { try { await persistFollowup(eventKey, "discarded"); renderTable(); renderDetail(); renderFollowups(); showToast("Seguimiento descartado"); } catch (error) { showToast(error.message); } };
  const fileInput = document.querySelector("#contact-file");
  document.querySelector("#import-contacts").onclick = () => fileInput.click();
  fileInput.onchange = async () => { const file = fileInput.files?.[0]; if (!file) return; try { showToast("Importando contactos…"); const result = await fetch("/api/contacts/import", { method: "POST", headers: { "x-file-name": encodeURIComponent(file.name), "content-type": "text/csv; charset=utf-8" }, body: file }); const payload = await result.json(); if (!result.ok) return showToast(payload.error || "No se pudo importar"); showToast(`${payload.imported} importados · ${payload.skipped} omitidos`); setTimeout(() => location.reload(), 1200); } catch (error) { showToast(`No se pudo leer el archivo: ${error.message}`); } finally { fileInput.value = ""; } };
  if (opportunities.length) { renderTable(); renderDetail(); }
  else {
    document.querySelector("#opportunity-body").innerHTML = "";
    document.querySelector("#result-count").textContent = "0 resultados";
    document.querySelector("#empty").hidden = false;
    document.querySelector("#detail").innerHTML = '<div class="empty">Todavía no hay oportunidades con score 75 o superior.</div>';
  }
  document.querySelector("#source-grid").innerHTML = data.sources.filter((source) => source.id !== "private-vermaz").map((source) => `<article class="source-card"><div class="source-card-head"><strong>${safe(source.name)}</strong><span class="status-ok" style="background:${source.last_error_at && (!source.last_success_at || new Date(source.last_error_at)>new Date(source.last_success_at)) ? '#c65353' : '#35ad77'}"></span></div><p>${safe(source.region)} · Prioridad ${safe(source.priority)}${source.user_added ? ' · Agregada por Vermaz' : ''}</p><div class="source-card-foot"><span>${safe(source.type.toUpperCase())}</span><span>${source.last_success_at ? dateTime(source.last_success_at) : 'Pendiente'}</span></div></article>`).join("");
  const privateItems = data.privateIntelligence || [];
  document.querySelector("#private-intelligence-list").innerHTML = privateItems.map((item) => `<article class="private-card"><div><strong>${safe(item.company)}${item.contract_name ? ` · ${safe(item.contract_name)}` : ''}</strong><p>${safe(item.details)}</p><div class="private-meta">${item.informant ? `Informó ${safe(item.informant)} · ` : ''}${dateTime(item.created_at)}${item.opportunity ? ` · Analizada: score ${safe(item.opportunity.score_radar)}` : ' · Pendiente de análisis'}</div></div><span class="tag ${item.confidence >= 85 ? 'critical' : item.confidence >= 60 ? 'high' : 'early'}">${safe(item.confidence)}% certeza</span></article>`).join("");
  document.querySelector("#private-count").textContent = `${privateItems.length} señal${privateItems.length === 1 ? "" : "es"} interna${privateItems.length === 1 ? "" : "s"}`;
  document.querySelector("#private-empty").hidden = privateItems.length > 0;
  document.querySelector("#public-source-form").onsubmit = async (event) => { event.preventDefault(); const button = event.currentTarget.querySelector("button"); button.disabled = true; button.textContent = "Probando…"; try { const response = await fetch("/api/sources", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: document.querySelector("#source-url").value, name: document.querySelector("#source-name").value }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "No se pudo agregar la fuente"); showToast(`${result.source.name} agregada como ${result.source.type.toUpperCase()}`); setTimeout(() => location.reload(), 1000); } catch (error) { showToast(error.message); button.disabled = false; button.textContent = "Probar y agregar"; } };
  document.querySelector("#private-source-form").onsubmit = async (event) => { event.preventDefault(); const button = event.currentTarget.querySelector("button"); button.disabled = true; button.textContent = "Guardando…"; try { const response = await fetch("/api/private-intelligence", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ company: document.querySelector("#private-company").value, contractName: document.querySelector("#private-contract").value, informant: document.querySelector("#private-informant").value, confidence: Number(document.querySelector("#private-confidence").value), details: document.querySelector("#private-details").value }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "No se pudo guardar la información"); showToast(result.message); setTimeout(() => location.reload(), 1800); } catch (error) { showToast(error.message); button.disabled = false; button.textContent = "Guardar y analizar"; } };
  document.querySelector("#activity-list").innerHTML = data.runs.map((run) => `<article class="run"><div class="run-time"><strong>${dateTime(run.started_at)}</strong><span>${safe(run.status)}${run.dry_run ? ' · simulación' : ''}</span></div><div class="run-stats"><div><strong>${run.summary?.articlesFetched ?? 0}</strong><span>artículos</span></div><div><strong>${run.summary?.eventsAnalyzed ?? 0}</strong><span>analizados</span></div><div><strong>${run.summary?.opportunitiesQualified ?? 0}</strong><span>oportunidades</span></div></div><span class="tag ${run.status === 'completed' ? 'high' : 'critical'}">${run.summary?.errors ?? 0} errores</span></article>`).join("");
  const bars = document.querySelectorAll(".bar");
  const days = [...Array(7)].map((_, index) => { const day = new Date(); day.setDate(day.getDate() - (6 - index)); return day.toISOString().slice(0, 10); });
  const counts = days.map((day) => qualified.filter((row) => row.analyzed_at.slice(0, 10) === day).length);
  const max = Math.max(1, ...counts);
  bars.forEach((bar, index) => { bar.style.setProperty("--h", `${Math.max(5, counts[index] / max * 90)}%`); bar.dataset.value = String(counts[index]); });
  const health = document.querySelectorAll(".health-meta");
  health[0].textContent = `${lastRun?.summary?.sourcesSucceeded ?? 0} de ${lastRun?.summary?.sourcesAttempted ?? 20} respondieron`;
  health[1].textContent = `${lastRun?.summary?.articlesFetched ?? 0} artículos → ${lastRun?.summary?.eventsAnalyzed ?? 0} eventos analizados`;
  health[2].textContent = !data.attioStatus?.configured ? "Token pendiente" : !data.attioStatus.valid ? "Configuración pendiente de corregir" : data.dryRun ? "Conectado · modo simulación" : `${lastRun?.summary?.attioCreated ?? 0} creadas · ${lastRun?.summary?.attioUpdated ?? 0} actualizadas`;
}

loadRealData().catch((error) => {
  document.querySelector(".demo-badge").textContent = "Error de conexión";
  showToast(error.message);
});
