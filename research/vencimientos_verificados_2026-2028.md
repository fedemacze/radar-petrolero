# Vencimientos verificados 2026-2028

Fecha de corte: 2026-09-23.

Este documento es la matriz de control previa a publicar una oportunidad en el Radar Petrolero. Un vencimiento nominal no se publica por sí solo: debe existir una ventana accionable y su estado debe verificarse contra una fuente primaria vigente.

## Regla de admisión

Una pieza sólo puede clasificarse como oportunidad cuando identifica, como mínimo:

1. un activo, contrato, permiso, licencia, concesión o proceso de compra concreto;
2. una contraparte o autoridad concedente identificable;
3. un evento accionable (licitación, concurso, renovación, reversión, cesión o vencimiento no resuelto);
4. una fecha o ventana temporal relevante; y
5. evidencia primaria de que la oportunidad sigue abierta o en preparación.

Quedan excluidos presupuestos generales, anuncios políticos, planes sectoriales sin contratación identificada, vencimientos ya prorrogados y fechas nominales que no alteran la continuidad operativa.

### Caso de regresión obligatorio

- URL: https://www.adnsur.com.ar/politica/presupuesto-2027--cuanto-recibiran-las-universidades-y-cuanto-se-destinara-a-defensa_a6aad5925f49d28bfbd12a03e
- Resultado esperado: `EXCLUIR_NO_ES_OPORTUNIDAD`.
- Motivo: describe partidas generales del Presupuesto 2027; no identifica contratación, licitación, concesión, renovación, contraparte compradora ni ventana comercial concreta del sector energético.

## Candidatos publicables o de seguimiento prioritario

| Activo / proceso | Tipo | Fecha relevante | Estado al corte | Tratamiento en el radar | Fuente primaria |
|---|---|---:|---|---|---|
| Complejo Hidroeléctrico Futaleufú | Concesión / nueva contratación | continuidad hasta 2027-09-10 o hasta nueva contratación | La Resolución 1498/2026 extendió la continuidad y ordena avanzar con una nueva contratación | `OPORTUNIDAD_EN_PREPARACION`; alta prioridad, monitorear pliego/convocatoria | Ministerio de Economía, Resolución 1498/2026: https://www.argentina.gob.ar/normativa/nacional/norma-429905 |
| Angostura, Las Violetas y Río Cullen, Tierra del Fuego | Nueva concesión hidrocarburífera | concesión finalizada en agosto de 2026 | La UTE no solicitó prórroga; Roch opera transitoriamente por cuenta provincial hasta el ingreso del adjudicatario y la Provincia prepara una nueva licitación | `OPORTUNIDAD_EN_PREPARACION`; máxima prioridad por servicios de operación, logística, almacenes y transporte | Gobierno de Tierra del Fuego: https://www.tierradelfuego.gob.ar/blog/2026/08/24/tierra-del-fuego-garantiza-la-continuidad-de-la-produccion-y-avanza-hacia-una-nueva-licitacion-en-las-areas-angostura-las-violetas-y-rio-cullen/ |
| CNO-8 Puesto Guardián, Salta | Nueva concesión posterior a caducidad | operación de emergencia vigente desde abril de 2026 | REMSa quedó a cargo de la continuidad operativa, ambiental y de seguridad tras la caducidad; debe monitorearse el nuevo concurso | `OPORTUNIDAD_EN_PREPARACION`; no afirmar apertura hasta que exista convocatoria | Boletín Oficial de Salta, Resolución 51/2026: https://boletinoficialsalta.gob.ar/boletindigital/2026/22165.pdf |
| Puesto Flores–Estancia Vieja / Puesto Prado, Río Negro | Concurso público nacional e internacional 01/26 | ofertas cerraron 2026-09-04 | La Provincia publicó la convocatoria y el acta de apertura; la oportunidad para concursar cerró y corresponde seguir evaluación/adjudicación y futura transición operativa | `SEGUIMIENTO_DE_ADJUDICACION`; no mostrar como licitación abierta | Gobierno de Río Negro: https://ipross.rionegro.gov.ar/servicio/258/concurso-nacional-internacional-areas-hidrocarburos-rn |
| Terminal marítima Punta Loyola, Santa Cruz | Concesión de transporte | 2027-11-14 | El título provincial localizado mantiene esa fecha; no se halló en esta revisión un acto posterior de extensión | `VENCIMIENTO_A_VALIDAR`; seguimiento anticipado, sin afirmar licitación | Boletín Oficial de Santa Cruz: https://boletinoficial.santacruz.gob.ar/legislacion/decretos-completos/31060 |
| Acambuco, Salta | Concesión de explotación | 2026-10-25 | PAE solicitó renovación y presentó inversiones y un plan de abandono de entre ocho y diez pozos; la decisión provincial sigue siendo el evento a monitorear | `SEGUIMIENTO_REGULATORIO`; no es licitación abierta | Gobierno de Salta: https://www.salta.gob.ar/prensa/noticias/la-secretaria-de-mineria-realizo-un-recorrido-tecnico-por-la-cuenca-noroeste-107594 |
| Complejo Hidroeléctrico Río Hondo y Central Los Quiroga | Nueva concesión | transición hasta 2026-12-15 | El Estado declaró su intención de convocar una licitación pública nacional e internacional; el proceso requiere pliego e inversiones obligatorias | `OPORTUNIDAD_EN_PREPARACION`; monitorear convocatoria | Secretaría de Energía, Resolución 198/2026: https://www.argentina.gob.ar/normativa/nacional/norma-428745/texto |
| Sistema Hidroeléctrico Los Nihuiles | Licitación pública nacional e internacional | proceso convocado 2026-07-28 | Convocatoria formal para nueva concesión y venta del 100% de Hidroelectricidad Mendocina S.A. | `OPORTUNIDAD_ABIERTA_O_EN_CURSO`; mostrar sólo si el cronograma admite participación | DNU 667/2026 / comunicación oficial: https://www.argentina.gob.ar/node/508593 |
| Área costa afuera CAN_200 | Concurso público internacional | convocatoria instruida 2026-07-15 | Decreto 590/2026 instruye convocar concurso para permiso de exploración | `OPORTUNIDAD_EN_PREPARACION`; monitorear pliego y apertura | Boletín Oficial, Decreto 590/2026: https://www.boletinoficial.gob.ar/detalleAviso/primera/344334/20260715 |
| Entre Lomas, Neuquén | Concesión de explotación convencional | venció 2026-01-21 | La provincia concedió sólo una extensión transitoria de 60 días mientras evaluaba la prórroga solicitada; la fuente localizada no prueba resolución definitiva | `SEGUIMIENTO_REGULATORIO`; no afirmar que está abierta hasta verificar decisión posterior | Neuquén, Decreto 110/2026: https://boficial.neuquen.gov.ar/LeyesDecretosDetalle?Id=424708 |
| Los Bastos, Neuquén (Tecpetrol) | Concesión de explotación convencional | venció 2026-01-10; extensión hasta 2026-03-12 | Decreto 152/2026 otorgó extensión transitoria de 60 días y dejó sin resolver la prórroga decenal solicitada | `SEGUIMIENTO_REGULATORIO`; no afirmar licitación abierta | Neuquén, Decreto 152/2026: https://boletinoficial.neuquen.gov.ar/LeyesDecretosDetalle?Id=424751 |
| Loma La Lata - Sierra Barrosa, Neuquén | Concesión de explotación | 2027-11-14 | El título vigente vence en esa fecha; todavía debe verificarse si hubo subdivisión, conversión a CENCH o prórroga posterior que afecte toda o parte del área | `VENCIMIENTO_A_VALIDAR`; vigilar con 18/12 meses de anticipación | Decreto nacional 1252/2000: https://www.argentina.gob.ar/normativa/nacional/decreto-1252-2000-65589/texto |
| Litoral Gas | Licencia de distribución de gas | vencimiento original 2027-12-28 | Solicitó prórroga por 20 años; ENARGAS celebró la Audiencia Pública 107, pero la evidencia localizada no demuestra todavía decreto de prórroga | `SEGUIMIENTO_REGULATORIO`; la solicitud no equivale a oportunidad competitiva | ENARGAS, Resolución 236/2025: https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-236-2025-412088/texto |
| Metrogas | Licencia de distribución de gas | vencimiento original 2027-12-28 | Solicitó prórroga por 20 años; ENARGAS celebró la Audiencia Pública 107, pero la evidencia localizada no demuestra todavía decreto de prórroga | `SEGUIMIENTO_REGULATORIO`; no publicar como licitación | ENARGAS, Resolución 236/2025: https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-236-2025-412088/texto |
| Camuzzi Gas Pampeana | Licencia de distribución de gas | vencimiento original 2027-12-28 | Solicitó prórroga por 20 años; ENARGAS celebró la Audiencia Pública 107, pero la evidencia localizada no demuestra todavía decreto de prórroga | `SEGUIMIENTO_REGULATORIO`; no publicar como licitación | ENARGAS, Resolución 236/2025: https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-236-2025-412088/texto |
| Distribuidora de Gas Cuyana, Distribuidora de Gas del Centro y Naturgy BAN | Licencias de distribución de gas | vencimiento original 2027-12-28 | Las tres solicitaron prórrogas por 20 años y fueron tratadas en la Audiencia Pública 108; una solicitud de renovación no abre por sí misma una competencia | `SEGUIMIENTO_REGULATORIO`; agrupar y vigilar resoluciones definitivas | ENARGAS, Audiencia Pública 108: https://www.enargas.gob.ar/secciones/audiencias-publicas/108/normativa.php |
| Camuzzi Gas del Sur, Naturgy NOA y Gas NEA | Licencias de distribución de gas | vencimiento original 2027-12-28 | Solicitaron prórrogas por 20 años y fueron tratadas en la Audiencia Pública 109; no se localizó acto final de prórroga en esta revisión | `SEGUIMIENTO_REGULATORIO`; no publicar como licitación | ENARGAS, audiencias públicas: https://www.enargas.gob.ar/secciones/audiencias-publicas/audiencias-publicas.php |
| Transportadora de Gas del Norte (TGN) | Licencia de transporte de gas | vencimiento original 2027-12-28 | TGN solicitó una extensión por 20 años y el trámite fue sometido a audiencia; no se localizó el decreto final | `SEGUIMIENTO_REGULATORIO`; renovación pendiente, no competencia abierta | Solicitud publicada por ENARGAS: https://www.enargas.gob.ar/secciones/audiencias-publicas/105/archivos/IF-2024-34919431-APN-SD_ENARGAS.pdf |

## Casos que deben excluirse como oportunidades de vencimiento

| Activo / noticia | Fecha nominal | Motivo de exclusión | Fuente |
|---|---:|---|---|
| Presupuesto nacional 2027 (nota ADNSUR) | 2027 | Es una asignación presupuestaria general, no una contratación identificada | URL del caso de regresión indicada arriba |
| Barrancas, Vizcacheras, La Ventana y Río Tunuyán, Mendoza | 2026/2027 | Mendoza ya aprobó prórrogas por 10 años; el vencimiento nominal dejó de ser una oportunidad abierta | Gobierno de Mendoza: https://www.mendoza.gov.ar/prensa/mendoza-aprueba-la-prorroga-de-las-areas-del-cluster-norte-con-una-inversion-comprometida-de-600-millones-de-dolares/ |
| Cerro Dragón | 2026/2027 | Aunque las concesiones tienen esas fechas, PAE informa continuidad mediante contratos operativos provinciales hasta 2046/2047, sujeta a condiciones que declara cumplidas; no tratar como licitación próxima sin acto oficial contrario | Prospecto PAE 2025: https://www.pan-energy.com/Obligaciones%20Negociables/PAE%20-%20Prospecto%20EF%202025%20%28Firmado%29.pdf |
| Oleoductos y poliductos de YPF enumerados en Decreto 698/2025 | 2027-11-06 | La prórroga por 10 años ya fue otorgada | Decreto 698/2025: https://www.argentina.gob.ar/normativa/nacional/norma-418095/texto |
| Oleoducto Cuenca Neuquina-frontera con Chile (YPF) | 2027-12-29 | La prórroga por 10 años ya fue otorgada | Decreto 1106/2024: https://www.argentina.gob.ar/normativa/nacional/norma-407405 |
| Licencia de Transporte de Gas del Sur (TGS) | 2027-12-28 | Decreto 495/2025 ya la prorrogó por 20 años | Decreto 495/2025: https://www.argentina.gob.ar/normativa/nacional/decreto-495-2025-415478 |
| Alicurá, Piedra del Águila, Cerros Colorados y El Chocón | vencimientos originales ya procesados | El concurso fue adjudicado y los nuevos contratos tienen 30 años; no presentarlo como oportunidad abierta | Resolución 19/2026: https://www.argentina.gob.ar/normativa/nacional/norma-422665 |
| Altiplanicie del Payún, Cañadón Amarillo y El Portón, Mendoza | 2026/2027 | Mendoza ya otorgó prórrogas por 10 años; excluir los vencimientos nominales anteriores | Gobierno de Mendoza: https://www.mendoza.gov.ar/prensa/mendoza-prorroga-concesiones-en-malargue-y-se-potencia-la-exploracion-no-convencional-en-vaca-muerta/ |
| Cerro Mollar, La Brea y Puesto Rojas, Mendoza | 2026/2027 | Las concesiones fueron prorrogadas por 10 años; no existe ventana competitiva por el solo vencimiento original | Gobierno de Mendoza: https://www.mendoza.gov.ar/prensa/mendoza-prorroga-concesiones-en-malargue-y-se-potencia-la-exploracion-no-convencional-en-vaca-muerta/ |
| Cerro Dragón, Chulengo y Cerro Tortuga–Las Flores, Chubut | fechas convencionales históricas | Fueron reconvertidas a concesiones no convencionales con plazos de 35 años más eventual prórroga; excluir las fechas nominales previas | Actos provinciales de reconversión vigentes desde 2025 |
| Escalante–El Trébol, Campamento Central–Cañadón Perdido y Pampa del Castillo–La Guitarra, Chubut | 2026/2027 | Tienen extensiones o períodos subsiguientes ya aprobados; no deben generar alertas de vencimiento abiertas | Digesto Jurídico de Chubut: https://sistemas.chubut.gov.ar/digesto/sistema/consulta.php?idile1=89258 |

## Reglas de estado

- `OPORTUNIDAD_ABIERTA_O_EN_CURSO`: existe convocatoria vigente y el cronograma todavía permite actuar.
- `OPORTUNIDAD_EN_PREPARACION`: una fuente primaria ordena o anuncia formalmente el procedimiento, pero aún falta convocatoria o pliego accionable.
- `SEGUIMIENTO_DE_ADJUDICACION`: la recepción de ofertas cerró; interesa identificar adjudicatario y transición, pero no invitar a participar.
- `SEGUIMIENTO_REGULATORIO`: existe vencimiento, solicitud de renovación o extensión transitoria, pero no hay evidencia suficiente de apertura competitiva.
- `VENCIMIENTO_A_VALIDAR`: la fecha proviene de un título válido, pero deben descartarse modificaciones posteriores.
- `EXCLUIR_PRORROGADO`: la continuidad ya fue resuelta por acto administrativo o contrato posterior.
- `EXCLUIR_NO_ES_OPORTUNIDAD`: la pieza no describe un evento comercial concreto.

## Pendientes de verificación antes de incorporar al producto

1. Decisión definitiva posterior a las extensiones transitorias de Entre Lomas y Los Bastos.
2. Estado procesal y fechas de participación de Los Nihuiles, Río Hondo/Los Quiroga, Futaleufú y CAN_200.
3. Superficie efectivamente remanente de Loma La Lata - Sierra Barrosa luego de escisiones y conversiones a concesiones no convencionales.
4. Estado actualizado de licencias de distribución de gas con vencimiento original en diciembre de 2027 (incluida Metrogas), evitando publicar las ya prorrogadas.
5. Completar la revisión de Jujuy, Formosa y La Pampa, donde todavía no apareció evidencia primaria suficiente de procesos accionables 2026-2028.
6. Confirmar el resultado del Concurso 01/26 de Río Negro y el estado de la licitación de Sur Río Deseado Este, evitando tratarlas como convocatorias abiertas después del cierre de ofertas.
