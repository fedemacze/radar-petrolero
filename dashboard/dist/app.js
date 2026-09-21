const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const dateTime = (value) => value ? new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(value)) : "Sin ejecuciones";
document.querySelector("#dashboard-version").textContent = "Panel v3 · contratos por vencer";
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
      id: index + 1,
      company: safe(value.empresa || "Empresa sin identificar"), project: safe(value.proyecto || row.title),
      signal: safe(value.tipo_senal), score: value.score_radar, priority: safe(value.prioridad), stage: safe(value.etapa_temporal),
      action: safe(value.tipo_accion), location: safe(value.provincia || value.cuenca || "Argentina"),
      piress: safe(piresCompany(value.empresa)), summary: safe(value.analisis_ia || value.resumen_evidencia),
      evidence: safe((value.hechos_publicados || []).join(" · ") || value.resumen_evidencia),
      services: (value.servicios_vermaz || []).map((item) => safe(item.servicio)), next: safe(value.accion_sugerida),
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
