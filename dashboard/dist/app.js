const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const dateTime = (value) => value ? new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(value)) : "Sin ejecuciones";
document.querySelector("#dashboard-version").textContent = "Panel v4 · agenda compartida";
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
    return {
      id: index + 1, eventKey: row.event_key,
      company: safe(value.empresa || "Empresa sin identificar"), project: safe(value.proyecto || row.title),
      signal: safe(value.tipo_senal), score: value.score_radar, priority: safe(value.prioridad), stage: safe(value.etapa_temporal),
      action: safe(value.tipo_accion), location: safe(value.provincia || value.cuenca || "Argentina"),
      piress: safe(piresCompany(value.empresa)), summary: safe(value.analisis_ia || value.resumen_evidencia),
      evidence: safe((value.hechos_publicados || []).join(" · ") || value.resumen_evidencia),
      services: (value.servicios_vermaz || []).map((item) => safe(item.servicio)), next: safe(value.accion_sugerida),
      targetRole: safe(value.cargo_objetivo || value.area_objetivo),
      sourceUrl: row.source_url,
    };
  }));
  selected = opportunities[0];
  const metricValues = document.querySelectorAll(".metric-value");
  metricValues[0].textContent = String(contracts.length);
  metricValues[1].textContent = String(qualified.length);
  metricValues[2].textContent = String(data.opportunities.length);
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
  document.querySelector("#contact-body").innerHTML = contacts.map((contact) => `<tr><td><div class="company">${safe(contact.name)}</div></td><td><div>${safe(contact.company)}</div><div class="location">${safe(contact.role)}</div></td><td>${contact.email ? `<a href="mailto:${safe(contact.email)}">${safe(contact.email)}</a>` : "—"}</td><td>${safe(contact.phone || "—")}</td><td>${contact.linkedin_url ? `<a href="${safe(contact.linkedin_url)}" target="_blank" rel="noopener">Abrir perfil</a>` : "—"}</td><td>${safe(contact.internal_owner || "—")}</td></tr>`).join("");
  document.querySelector("#contact-count").textContent = `${contacts.length} contacto${contacts.length === 1 ? "" : "s"}`;
  document.querySelector("#contact-empty").hidden = contacts.length > 0;
  const normalizeCompany = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\b(s a|srl|sociedad anonima|ltd|limited|energia|energy)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
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
    detail.querySelector(".detail-body").insertAdjacentHTML("beforeend", `<div class="detail-section"><h4>Contactos disponibles</h4>${cards || '<p>No tenés contactos conocidos en esta empresa.</p>'}<div class="detail-footer"><a class="secondary" href="${linkedinSearch}" target="_blank" rel="noopener">Buscar perfil en LinkedIn</a></div></div><div class="detail-section"><h4>Seguimiento comercial</h4><div class="service-list"><button class="secondary" onclick="saveFollowup('pending')">Pendiente</button><button class="secondary" onclick="saveFollowup('contacted')">Contactado</button><button class="secondary" onclick="saveFollowup('replied')">Respondió</button><button class="secondary" onclick="saveFollowup('discarded')">Descartado</button></div><p class="location" style="margin-top:8px">Estado actual: ${safe(current?.status || "Sin registrar")}</p></div>`);
  };
  window.saveFollowup = async (status) => { if (!selected?.eventKey) return; await fetch("/api/followup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventKey: selected.eventKey, status }) }); showToast("Seguimiento actualizado"); setTimeout(() => location.reload(), 600); };
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
  document.querySelector("#source-grid").innerHTML = data.sources.map((source) => `<article class="source-card"><div class="source-card-head"><strong>${safe(source.name)}</strong><span class="status-ok" style="background:${source.last_error_at && (!source.last_success_at || new Date(source.last_error_at)>new Date(source.last_success_at)) ? '#c65353' : '#35ad77'}"></span></div><p>${safe(source.region)} · Prioridad ${safe(source.priority)}</p><div class="source-card-foot"><span>${safe(source.type.toUpperCase())}</span><span>${source.last_success_at ? dateTime(source.last_success_at) : 'Pendiente'}</span></div></article>`).join("");
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
