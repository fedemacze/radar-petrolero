# Radar Petrolero

MVP autónomo para detectar oportunidades comerciales petroleras para Vermaz. Reemplaza n8n con un proceso diario que consulta fuentes públicas, filtra y agrupa eventos, usa OpenAI con salida estructurada y crea o actualiza oportunidades en Attio.

## Arquitectura

```text
15–20 fuentes públicas
        ↓
normalización y persistencia PostgreSQL
        ↓
prefiltro comercial Vermaz/Pires
        ↓
deduplicación de artículos y eventos
        ↓
OpenAI Responses API (JSON Schema estricto)
        ↓
score >= 75 y relevante=true
        ↓
crear/actualizar oportunidad en Attio por id_radar
```

## Puesta en marcha local

Requisitos: Node.js 22+, pnpm y PostgreSQL 16+.

1. Copiar `.env.example` como `.env` y completar secretos.
2. Iniciar PostgreSQL con `docker compose up -d postgres` o usar una instancia existente.
3. Instalar dependencias: `pnpm install`.
4. Aplicar migraciones: `pnpm migrate`.
5. Verificar fuentes: `pnpm check-sources`.
6. Ejecutar sin escribir en Attio: `pnpm dry-run`.
7. Cuando la muestra esté aprobada, definir `DRY_RUN=false` y ejecutar `pnpm start`.

La aplicación no carga `.env` por sí sola en producción: Railway inyecta las variables. Para desarrollo puede usarse `node --env-file=.env` o exportarlas en la terminal.

## Variables

- `DATABASE_URL`: conexión PostgreSQL.
- `OPENAI_API_KEY`: clave de OpenAI.
- `OPENAI_MODEL`: por defecto `gpt-4o-mini`.
- `ATTIO_API_KEY`: token con lectura de configuración y lectura/escritura de registros.
- `ATTIO_OBJECT`: por defecto `deals`.
- `ATTIO_STAGE_ATTRIBUTE_ID` y `ATTIO_DETECTED_STAGE_ID`: IDs recuperados del workflow original.
- `DRY_RUN`: `true` impide toda escritura en Attio.
- `SOURCE_TIMEOUT_MS` y `MAX_ARTICLES_PER_SOURCE`: límites de ingesta.

## Despliegue en Railway

1. Crear un proyecto desde este repositorio y añadir PostgreSQL.
2. Vincular `DATABASE_URL` al servicio PostgreSQL.
3. Cargar las claves como variables secretas; nunca en Git.
4. Configurar el servicio como Cron Job con `0 11 * * *` (11:00 UTC = 08:00 Buenos Aires).
5. Desplegar inicialmente con `DRY_RUN=true`.
6. Revisar `runs`, `sources`, `events` y `opportunities` en PostgreSQL.
7. Tras validar la muestra, cambiar a `DRY_RUN=false`.

El proceso obtiene un bloqueo de PostgreSQL antes de comenzar. Si otra ejecución sigue activa, la nueva termina sin duplicar trabajo.

## Seguridad e idempotencia

- No se guardan secretos en código ni logs.
- URL y hash de contenido evitan reprocesar artículos.
- `event_key` genera el `id_radar` estable.
- La integración consulta Attio antes de crear y actualiza cuando el registro ya existe.
- Los fallos de una fuente no detienen el resto.
- OpenAI usa salida estructurada validada nuevamente con Zod.

## Comandos de control

```text
pnpm test
pnpm typecheck
pnpm build
pnpm check-sources
pnpm dry-run
```

La ampliación futura con panel y CRM propio queda fuera del MVP; Attio es su interfaz comercial.
