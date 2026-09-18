import type { SourceDefinition } from "../domain/types.js";

export const PREFILTER = {
  maxAgeDays: 21,
  minimumScore: 25,
  piresCompanies: ["sga", "sga servicios", "dls", "dls archer", "opsur", "vientos del sur"],
  targetCompanies: [
    "ypf", "pan american energy", "pae", "vista energy", "vista", "cgc",
    "compañía general de combustibles", "tecpetrol", "pluspetrol", "pampa energía",
    "shell", "chevron", "totalenergies", "crown point", "capsa", "capex", "pcr",
    "petroquímica comodoro rivadavia", "phoenix global resources", "phoenix", "pecom",
  ],
  criticalSignals: [
    "licitación", "adjudicación", "contratación", "concurso de precios", "compulsa", "rfp", "rfq",
    "tender", "contrato", "renovación de contrato", "vencimiento de contrato", "prórroga",
    "nuevo proveedor", "proveedores", "contratista", "subcontratista",
  ],
  projectSignals: [
    "inversión", "plan de inversión", "proyecto", "reactivación", "puesta en marcha", "ampliación",
    "obra", "infraestructura", "desarrollo", "inicio de operaciones", "reinicio de operaciones",
    "incremento de producción", "aumento de producción", "nuevos pozos", "campaña de perforación",
    "perforación", "workover", "pulling",
  ],
  serviceSignals: [
    "mantenimiento", "batería", "planta", "colector", "manifold", "tanque", "separador", "piping",
    "bomba", "válvula", "cabeza de pozo", "instalaciones de superficie", "oleoducto", "gasoducto",
    "acueducto", "pipeline", "flowline", "ducto", "cañería", "integridad", "corrosión",
    "protección catódica", "reparación", "reemplazo", "producción", "operaciones",
    "recuperación secundaria", "recuperación terciaria", "inyección", "pozo productor", "pozo inyector",
    "almacén", "depósito", "pañol", "inventario", "stock", "materiales", "repuestos", "logística",
    "transporte", "cargas líquidas", "cargas sólidas", "crudo", "agua de producción", "residuos",
    "cisterna", "camiones", "transporte de personal", "traslado de personal", "minibús", "combis", "cuadrillas",
  ],
  earlySignals: [
    "impacto ambiental", "evaluación de impacto ambiental", "estudio de impacto ambiental", "permiso ambiental",
    "licencia ambiental", "audiencia pública", "consulta pública", "aprobación ambiental",
    "ministerio de ambiente", "secretaría de ambiente",
  ],
  noise: [
    "fútbol", "rugby", "espectáculo", "recital", "festival", "turismo", "gastronomía",
    "pronóstico", "clima", "policial", "accidente de tránsito",
  ],
} as const;

export const VERMAZ_SERVICES = [
  "Mantenimiento de instalaciones de superficie",
  "Mantenimiento de líneas soterradas",
  "Administración y logística de almacenes",
  "Tareas de apoyo a la producción",
  "Transporte de cargas líquidas y sólidas",
  "Transporte de personal",
] as const;

// Las fuentes RSS se prefieren porque son más estables y respetuosas. Las fuentes web
// se procesan mediante enlaces y metadatos públicos; una falla queda aislada por fuente.
export const SOURCES: SourceDefinition[] = [
  { id: "el-comodorense-petroleo", name: "El Comodorense - Petróleo", type: "rss", url: "https://www.elcomodorense.net/noticias/petroleo/feed", region: "Patagonia", priority: "alta", enabled: true },
  { id: "mejor-energia-oil-gas", name: "Mejor Energía - Oil&Gas", type: "rss", url: "https://www.mejorenergia.com.ar/rss/oil-gas/", region: "Argentina", priority: "alta", enabled: true },
  { id: "mejor-energia-empresas", name: "Mejor Energía - Empresas", type: "rss", url: "https://www.mejorenergia.com.ar/rss/empresas/", region: "Argentina", priority: "media", enabled: true },
  { id: "econojournal-energia", name: "EconoJournal - Energía", type: "web", url: "https://econojournal.com.ar/seccion/energia/", region: "Argentina", priority: "alta", enabled: true },
  { id: "mas-energia-petroleo", name: "Más Energía - Petróleo", type: "rss", url: "https://mase.lmneuquen.com/rss/petroleo.xml", region: "Neuquén", priority: "alta", enabled: true },
  { id: "mas-energia-produccion", name: "Más Energía - Producción", type: "rss", url: "https://mase.lmneuquen.com/rss/produccion.xml", region: "Neuquén", priority: "alta", enabled: true },
  { id: "mas-energia-servicios", name: "Más Energía - Servicios", type: "rss", url: "https://mase.lmneuquen.com/rss/servicios.xml", region: "Neuquén", priority: "alta", enabled: true },
  { id: "energia-online", name: "Energía Online", type: "rss", url: "https://energiaonline.com.ar/feed/", region: "Argentina", priority: "alta", enabled: true },
  { id: "desarrollo-energetico", name: "Desarrollo Energético", type: "rss", url: "https://desarrolloenergetico.com.ar/feed/", region: "Argentina", priority: "alta", enabled: true },
  { id: "en-vaca-muerta", name: "En Vaca Muerta", type: "rss", url: "https://envacamuerta.com/feed/", region: "Neuquén", priority: "alta", enabled: true },
  { id: "revista-petroquimica", name: "Revista Petroquímica", type: "rss", url: "https://www.revistapetroquimica.com/feed/", region: "Argentina", priority: "alta", enabled: true },
  { id: "diario-rio-negro-energia", name: "Diario Río Negro - Energía", type: "web", url: "https://www.rionegro.com.ar/energia/", region: "Patagonia", priority: "alta", enabled: true },
  { id: "adnsur", name: "ADNSUR", type: "rss", url: "https://www.adnsur.com.ar/rss/", region: "Chubut", priority: "alta", enabled: true },
  { id: "op-sur", name: "Observatorio Petrolero Sur", type: "rss", url: "https://opsur.org.ar/feed/", region: "Argentina", priority: "media", enabled: true },
  { id: "argentina-energia", name: "Secretaría de Energía", type: "web", url: "https://www.argentina.gob.ar/economia/energia/noticias", region: "Argentina", priority: "alta", enabled: true, articleLinkPattern: "/economia/energia/" },
  { id: "chubut-hidrocarburos", name: "Ministerio de Hidrocarburos del Chubut", type: "web", url: "https://www.hidrocarburos.chubut.gov.ar/", region: "Chubut", priority: "critica", enabled: true },
  { id: "santa-cruz-energia", name: "Gobierno de Santa Cruz", type: "web", url: "https://noticias.santacruz.gob.ar/gestion/produccion", region: "Santa Cruz", priority: "alta", enabled: true },
  { id: "neuquen-energia", name: "Gobierno del Neuquén - Energía", type: "web", url: "https://www.neuqueninforma.gob.ar/", region: "Neuquén", priority: "media", enabled: true },
  { id: "ypf-noticias", name: "YPF - Noticias", type: "web", url: "https://www.ypf.com/YPFHoy/YPFSalaPrensa/Paginas/Noticias.aspx", region: "Argentina", priority: "alta", enabled: true },
  { id: "pae-noticias", name: "Pan American Energy - Noticias", type: "web", url: "https://www.pan-energy.com/novedades", region: "Argentina", priority: "alta", enabled: true, articleLinkPattern: "/novedades/" },
];

export const ATTIO = {
  minimumScore: 75,
  object: "deals",
  serviceOptions: {
    "mantenimiento de instalaciones de superficie": "Mantenimiento instalaciones de superficie",
    "mantenimiento de líneas soterradas": "Mantenimiento líneas soterradas",
    "administración y logística de almacenes": "Administración y logística de almacenes",
    "tareas de apoyo a la producción": "Apoyo a producción",
    "transporte de cargas líquidas y sólidas": "Transporte cargas líquidas/sólidas",
    "transporte de personal": "Transporte de personal",
  } as Record<string, string>,
};
