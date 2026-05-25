# Reto Pretemporada — Sistema completo

Plataforma de seguimiento de hábitos de 16 semanas compuesta por tres partes que comparten una sola fuente de verdad: **Google Sheets**.

```
Discord bot  ──┐
               ├──► Google Sheets ◄──► Flask API ──► React Dashboard
Keep-alive  ──┘
```

---

## Tabla de contenidos

1. [Arquitectura general](#1-arquitectura-general)
2. [Estructura de Google Sheets](#2-estructura-de-google-sheets)
3. [Configuración inicial](#3-configuración-inicial)
4. [Levantar el sistema](#4-levantar-el-sistema)
5. [Dashboard — pantallas y herramientas](#5-dashboard--pantallas-y-herramientas)
6. [Bot de Discord — modos de uso](#6-bot-de-discord--modos-de-uso)
7. [Cómo añadir cosas nuevas](#7-cómo-añadir-cosas-nuevas)
8. [Subir fotos (Cloudinary)](#8-subir-fotos-cloudinary)
9. [Solución de problemas comunes](#9-solución-de-problemas-comunes)

---

## 1. Arquitectura general

| Componente | Tecnología | Rol |
|---|---|---|
| **Bot** | Python · discord.py | Registro de hábitos por chat, retos, ranking, recordatorios automáticos |
| **API** | Python · Flask (`keep_alive.py`) | Sirve el dashboard React y expone endpoints JSON |
| **Dashboard** | React · Vite · SWR | UI de visualización y registro web |
| **Base de datos** | Google Sheets | Fuente única de verdad para todos los datos |
| **Imágenes** | Cloudinary | Almacenamiento de fotos de progreso y vision board |

### Flujo de datos

```
Usuario escribe en Discord
       │
       ▼
  bot.py / habitos.py
       │  valida meta, calcula puntos
       ▼
  Google Sheets › Datos
       │
       ▼
  Flask /api/* (con caché en memoria)
       │
       ▼
  React Dashboard (SWR + revalidación)
```

### Archivos principales

```
keep_alive.py   — Flask app: todos los endpoints /api/*
bot.py          — Cliente Discord, comandos !
habitos.py      — Lógica de registro de hábitos (Discord)
retos.py        — Publicación y validación de retos
leaderboard.py  — Ranking semanal/total
tasks.py        — Tareas automáticas (recordatorios, resúmenes, etc.)
config.py       — Credenciales y constantes
sheets.py       — Helper get_sheet()

frontend/src/
  screens/      — Inicio, Registro, Vision, Plan, Insights, Mas
  components/   — UI reutilizable (Card, Icon, ProgressBar, PhotoUpload…)
  hooks/        — useApi.js (SWR hooks por endpoint)
  lib/          — constants.js, cloudinary.js, api.js
```

---

## 2. Estructura de Google Sheets

El spreadsheet se llama **"Reto Fitness"** (configurable en `.env` → `SHEET_NAME`).

### Pestaña `Datos` — registro diario de hábitos

| Columna | Tipo | Descripción |
|---|---|---|
| `Usuario` | texto | ID del usuario (ej. `joa_b29`) |
| `Fecha` | `YYYY-MM-DD` | Fecha del registro |
| `Hábito` | texto | Nombre del hábito en capitalize (ej. `Agua`) |
| `Valor (L)` | número | Valor registrado (litros, pasos, minutos, 0/1…) |
| `Cumplido` | 0 / 1 | 1 si el hábito se cumplió |
| `Puntos` | número | Puntos asignados (puede ser negativo) |

> Los datos llegan aquí desde el bot (Discord) y desde el dashboard web (tab Registro).

### Pestaña `Metas` — configuración por usuario

| Columna | Descripción |
|---|---|
| `Usuario` | ID del usuario |
| `Hábito` | Nombre del hábito (debe coincidir con `Datos.Hábito`) |
| `Meta` | Valor objetivo (ej. `2` para 2 litros de agua) |
| `Tipo` | `+` si meta es ≥ valor, `-` si meta es ≤ valor |
| `Unidad` | Unidad de medida (ej. `L`, `pasos`, `hs`) |
| `Puntos` | Puntos base si se cumple la meta |
| `Antimeta` | Valor mínimo/máximo antes de penalizar (opcional) |
| `PenaltyUnit` | Unidad de penalización por incremento (opcional) |
| `PenaltyPerUnit` | Puntos a descontar por cada unidad de déficit (opcional) |
| `Carril` | `fisico`, `nutricion`, `habitos` o `descanso` |

### Pestaña `Logros` — catálogo de logros

| Columna | Descripción |
|---|---|
| `ID` | Identificador único (ej. `L001`) |
| `Nombre` | Nombre del logro |
| `Categoría` | Agrupación libre (ej. `Hábitos`, `General`) |
| `Tipo` | `Racha`, `Día completo`, `Semana completa`, `Suma semanal`, `Acumulado`, `Valor diario`, `Porcentaje semanal` |
| `Criterio` | Nombre del hábito al que aplica, `todos` o `cualquiera` |
| `Valor requerido` | Número objetivo (días de racha, XP, etc.) |
| `Puntos extra` | Puntos de bonificación al obtenerlo |
| `Ícono` | Nombre de ícono Lucide (ej. `award`, `flame`, `zap`) |
| `Color` | Color hex (ej. `#d4ff3a`) |

**Tipos de logro explicados:**

| Tipo | Qué detecta | Ejemplo |
|---|---|---|
| `Racha` | Días consecutivos con el hábito cumplido | 10 días seguidos de Agua |
| `Día completo` | Un día donde TODOS los hábitos están cumplidos | Círculo perfecto |
| `Semana completa` | N días consecutivos con todos los hábitos | Iron Will (7 días) |
| `Suma semanal` | Suma de valor del hábito en una semana ≥ objetivo | Duolingo ≥ 500 XP/semana |
| `Acumulado` | Total acumulado en todo el reto | — |
| `Valor diario` | Un día donde el valor del hábito ≥ objetivo | — |
| `Porcentaje semanal` | % de hábitos cumplidos en una semana ≥ objetivo | — |

### Pestaña `LogrosUsuario` — completions

| Columna | Descripción |
|---|---|
| `Usuario` | ID del usuario |
| `LogroID` | ID del logro (referencia a `Logros.ID`) |
| `Fecha` | Fecha en que se detectó el logro (`YYYY-MM-DD`) |

> Esta hoja la llena el sistema automáticamente. No editar a mano.

### Pestaña `RetosHistóricos` — retos publicados

Llenada automáticamente por el bot al publicar retos. Columnas importantes:

| Columna | Descripción |
|---|---|
| `ID` | Auto-generado (`RH###`) |
| `Fecha publicación` | Fecha/hora del lanzamiento |
| `Tipo de reto` | `Semanal`, `Mini`, `Bingo` |
| `ID reto` | Referencia a `Retos.ID` |
| `Descripción` | Texto del reto |
| `Clave bingo` | Clave para reclamar bingo (ej. `BNG1234`) |
| `Fecha fin válida` | Fecha de expiración (`YYYY-MM-DD HH:MM:SS`) |
| `Puntos asignables` | Puntos que vale completarlo |

### Pestaña `Retos` — catálogo de retos

| Columna | Descripción |
|---|---|
| `ID` | Identificador (ej. `R001`, `M001`) |
| `Nombre` | Nombre corto del reto |
| `Tipo` | `semanal` o `mini` |
| `Descripción` | Texto del reto |
| `Puntos` | Puntos que vale |
| `Emoji` | Emoji representativo |

### Pestaña `Checkpoints` — timeline del reto

| Columna | Descripción |
|---|---|
| `Usuario` | ID del usuario (dejar vacío para que sea compartido) |
| `Semana` | Número de semana del reto (1–16) |
| `Fecha` | Fecha aproximada (`YYYY-MM-DD`) |
| `Título` | Título largo del checkpoint |
| `Corto` | Texto corto (aparece en el timeline del dashboard) |
| `Ícono` | Nombre de ícono Lucide |

### Pestaña `Plan` — plan de entrenamiento

| Columna | Descripción |
|---|---|
| `Usuario` | ID del usuario (dejar vacío para compartido) |
| `Fase` | Número de fase (1, 2, 3…) |
| `TituloFase` | Nombre de la fase (ej. `Base aeróbica`) |
| `Semana` | Semana dentro de la fase |
| `Dia` | Letra del día (`L`, `M`, `X`, `J`, `V`, `S`, `D`) |
| `Titulo` | Nombre de la sesión |
| `Tipo` | `fuerza`, `cardio`, `hiit`, `campo`, `movilidad`, `descanso` |
| `Duracion` | Duración (ej. `45 min`) |
| `Tags` | Etiquetas separadas por coma |
| `Descripcion` | Descripción detallada |

### Pestaña `Visión` — vision board

| Columna | Descripción |
|---|---|
| `Usuario` | ID del usuario |
| `Tipo` | `imagen`, `cita` o `meta` |
| `Título` | Título del tile |
| `Texto` | Texto o cita |
| `Autor` | Autor de la cita (si aplica) |
| `Color` | Color hex del tile |
| `URL` | URL de imagen (para tipo `imagen`) |

### Pestaña `Fotos` — fotos de progreso

| Columna | Descripción |
|---|---|
| `Usuario` | ID del usuario |
| `Fecha` | Fecha de la foto (`YYYY-MM-DD`) |
| `Semana` | Semana del reto en ese momento |
| `URL` | URL de Cloudinary |
| `Nota` | Nota opcional |
| `Tipo` | `progreso` o `vision` |

### Pestaña `Leaderboard` — ranking semanal

Dos columnas: `Usuario`, `Puntos`. El bot la lee con `!ranking` y el dashboard la muestra en Inicio.

### Pestaña `LeaderboardTotal` — ranking acumulado

Igual que `Leaderboard` pero con puntos totales del reto.

---

## 3. Configuración inicial

### Variables de entorno (`.env` en la raíz)

```env
# Discord
TOKEN=tu_token_de_discord

# Google Sheets
SHEET_NAME=Reto Fitness

# Credenciales Google (elige uno de los dos métodos)
GOOGLE_APPLICATION_CREDENTIALS=ruta/a/credenciales.json
# O en Render/producción:
# GOOGLE_CREDENTIALS={"type":"service_account", ...}  (JSON completo como string)
```

### Variables de entorno del frontend (`frontend/.env.local`)

```env
VITE_CLOUDINARY_CLOUD=tu_cloud_name
VITE_CLOUDINARY_PRESET=fitquest_unsigned
```

### Permisos de Google Sheets

El service account de Google necesita acceso de **Editor** al spreadsheet. Comparte la hoja con el email del service account (`...@....gserviceaccount.com`).

---

## 4. Levantar el sistema

### Desarrollo local

```bash
# 1. Instalar dependencias Python
pip install -r requirements.txt

# 2. Levantar Flask + bot
python bot.py
# o solo el dashboard sin bot:
python keep_alive.py

# 3. En otra terminal — frontend en modo watch (opcional, solo para dev)
cd frontend
npm install
npm run dev        # dev server en puerto 5173
# o para producción (sirve desde Flask):
npm run build
```

El dashboard queda disponible en `http://localhost:8080`.

### Rebuild obligatorio tras cambios en el frontend

```bash
cd frontend && npm run build
```

El build genera archivos en `static/dist/`. Flask los sirve directamente.

---

## 5. Dashboard — pantallas y herramientas

### Topbar — presente en todas las pantallas

- **Selector de usuario** (Joa / Diana): cambia el usuario activo globalmente.
- **Botón Sync**: limpia el caché del servidor y fuerza recarga desde Google Sheets. Usar cuando se editan o borran datos en la hoja y el dashboard sigue mostrando los datos viejos.

### Inicio

Vista general del reto actual.

- **Timeline del reto**: barra de progreso de 16 semanas con marcadores de checkpoints. Los checkpoints se leen de la pestaña `Checkpoints`, filtrados por usuario.
- **KPIs**: Peso actual (último registro), Puntos de la semana, Racha de hábitos (días consecutivos), Pasos de hoy.
- **Alertas del coach**: avisos automáticos basados en los datos (pasos bajos, hidratación, etc.).
- **Resumen de carriles**: puntos semanales desglosados por fisico / nutrición / hábitos / descanso.
- **Leaderboard**: ranking de la semana leído de la hoja `Leaderboard`. Filtros: Todos / Top 5 / Cerca de mí.
- **Semana en un vistazo**: grid semanal lunes–domingo con carriles coloreados.
- **Retos activos**: retos con fecha de expiración vigente.

### Registro

Formulario web para registrar hábitos sin Discord.

- Seleccionar fecha y hábito → ingresar valor → Guardar.
- Al guardar se invalida el caché del usuario y se lanza automáticamente la detección de logros en segundo plano.
- Los hábitos disponibles se leen de la pestaña `Metas` del usuario activo.

### Visión

Vision board del usuario.

- Tiles de tipo `imagen`, `cita` y `meta` leídos de la pestaña `Visión`.
- Filtros por tipo.
- **Botón "Añadir imagen"**: sube una foto a Cloudinary y la guarda en la pestaña `Visión` como tile de tipo `imagen`. Requiere Cloudinary configurado.

### Plan

Plan de entrenamiento y nutrición.

- Leído de la pestaña `Plan`, filtrado por usuario (incluye filas sin usuario).
- Navegación por fases → semanas → días.
- Tabs: Entrenamiento / Nutrición.

### Insights

Análisis y reportes.

- **Filtros de periodo**: Últimos 7 días / 30 días / Todo.
- **Historia**: gráfica de línea de peso o pasos a lo largo del tiempo.
- **Comparativa**: barras de puntos por hábito en el periodo.
- **Distribución**: dona de puntos por carril.
- **Heatmap**: grid de cumplimiento hábito × día.
- **Exportar**: descarga un `.txt` con el resumen del periodo.

### Más

Tabs adicionales:

#### Retos
Retos activos (con fecha de expiración ≥ hoy), leídos de `RetosHistóricos`. Ordenados por urgencia.

#### Logros
Catálogo completo de logros con estado de completado por usuario.
- Sección **Obtenidos**: logros ya ganados, con fecha.
- Sección **Por obtener**: logros pendientes con condición visible.
- **Botón Sincronizar**: lanza la detección de logros manualmente. Útil la primera vez o si se agregan logros nuevos al catálogo. Espera ~3 segundos y recarga.

#### Fotos
Galería de fotos de progreso.
- Campo de nota + dropzone para subir foto.
- La foto se sube a Cloudinary y se guarda en la pestaña `Fotos`.

#### Metas
Progreso actual de cada hábito configurado en `Metas`, con barra de progreso calculada en base al último valor registrado.

#### Timeline
Timeline de checkpoints del reto, filtrado por usuario.

---

## 6. Bot de Discord — modos de uso

### Modo actual: bot completo

El bot hace todo: registro, retos, estadísticas, recordatorios, ranking, logros.

**Canales de Discord esperados:**
- `registro-diario` — recordatorios diarios
- `retos` — publicación de mini-retos, retos semanales, bingos
- `estadisticas` — resúmenes semanales y estadísticas diarias
- `sistema-bot` — mensajes de completar registros faltantes

**Tareas automáticas (Mexico City timezone):**

| Tarea | Cuándo |
|---|---|
| Recordatorio diario | 23:00 todos los días |
| Completar registros faltantes | 07:00 todos los días (rellena día anterior con 0) |
| Mini-reto diario | 05:00 todos los días |
| Reto semanal | 05:00 los lunes |
| Bingo | 05:00 los miércoles |
| Fin de semana (ganadora/castigo) | 06:00 los lunes |
| Resumen semanal | 23:59 los domingos |
| Estadística aleatoria | 23:30 todos los días |
| Revisión de logros | 23:00 los domingos |

**Comandos manuales:**

| Comando | Descripción |
|---|---|
| `agua: 2.5` | Registra 2.5L de agua (y similares para cada hábito) |
| `peso: 72.3` | Registra medición de peso (sin puntos) |
| `cintura: 78` | Registra medición de cintura |
| `!ranking` | Ranking semanal |
| `!total_ranking` | Ranking acumulado |
| `!finsemana` | Resultado de semana (ganadora + castigo) |
| `!reto_semanal` | Publica reto semanal manualmente |
| `!mini_reto` | Publica mini-reto manualmente |
| `!bingo` | Publica bingo |
| `!sugerencias` | Sugerencias de ajuste de metas |
| `!subirmeta [habito]` | Sube la meta de un hábito |
| `!stats` | Estadística aleatoria |
| `!resumen` | Resumen semanal personal |
| `!logros` | Ver logros obtenidos |
| `Reto semanal completado, R001` | Reclamar reto semanal |
| `Mini-reto completado, M001` | Reclamar mini-reto |
| `BINGO BNG1234` | Reclamar bingo |

**Formato de registro de hábitos (Discord):**

```
agua: 2.5
pasos: 9500
ejercicio: 45
calorias: 1800
sueño: 7.5
duolingo: 1
lectura: 30
celular: 1
dientes: 1
ducha: 1
```

Escribe varios en el mismo mensaje (una línea cada uno). Los hábitos toggle (duolingo, celular, dientes, ducha) se registran con `1` para "cumplido".

---

### Modo vocero (recomendado si se usa el dashboard como principal)

Si el dashboard web ya maneja el registro diario, el bot puede simplificarse para actuar solo como **vocero de Discord**: manda mensajes y notificaciones, pero no recibe registros.

**Ventajas:**
- Sin riesgo de registros duplicados (bot + web).
- Menos llamadas a la API de Sheets.
- El bot sigue siendo útil para notificaciones push en el canal.

**Qué conservar del bot en modo vocero:**

| Tarea | ¿Conservar? | Motivo |
|---|---|---|
| Recordatorio diario | ✅ | Notificación push en Discord |
| Completar registros faltantes | ✅ | Integridad de datos |
| Mini-reto / Reto semanal | ✅ | Gamificación |
| Bingo | ✅ | Gamificación |
| Fin de semana | ✅ | Momento social |
| Resumen semanal | ✅ | Motivación |
| Estadística aleatoria | ✅ | Engagement |
| Registro por chat (`agua:`, `pasos:`…) | ❌ | Usar el dashboard web |
| `!ranking` | ✅ | Quick lookup en Discord |
| `!logros` | ❌ | Usar el dashboard |
| `!stats`, `!resumen` | ✅ | Cómodo desde Discord |

**Para implementar modo vocero** — en `bot.py`, comenta o elimina el bloque `on_message` que procesa `agua:`, `pasos:`, etc. El resto de tareas automáticas y comandos `!` pueden quedar.

---

## 7. Cómo añadir cosas nuevas

### Añadir un nuevo hábito

1. En la hoja `Metas`, añadir una fila por usuario con el nuevo hábito y su configuración.
2. Si el hábito es de tipo toggle (sí/no), el valor se registra como `1`. Agregar el nombre a la lista en `habitos.py` y `keep_alive.py` si es necesario:
   ```python
   # keep_alive.py ~línea 651
   if habito_raw in ('duolingo', 'celular', 'dientes', 'ducha', 'nuevo_habito') and valor == 1:
   ```
3. Si debe aparecer en un carril del dashboard, añadirlo a `HABIT_LANE` en `frontend/src/lib/constants.js`:
   ```js
   nuevo_habito: 'habitos',  // o 'fisico', 'nutricion', 'descanso'
   ```
4. Rebuild: `cd frontend && npm run build`.

### Añadir un nuevo usuario

1. En la hoja `Metas`, añadir filas con el nuevo usuario para cada hábito.
2. En `tasks.py`, añadir el ID del usuario a `TARGET_USERS`:
   ```python
   TARGET_USERS = ["joa_b29", "d1aniss", "nuevo_usuario"]
   ```
3. En `frontend/src/lib/constants.js`, añadir el usuario a `USERS`:
   ```js
   { id: 'nuevo_usuario', label: 'Nombre', initials: 'NM' },
   ```
4. Rebuild.

### Añadir un nuevo logro al catálogo

1. En la hoja `Logros`, añadir una fila con ID único (ej. `L010`), tipo y criterio.
2. El sistema lo detectará automáticamente en el próximo check (al registrar hábitos o con el botón Sincronizar del dashboard).

No requiere cambios en el código.

### Añadir un nuevo reto al catálogo

1. En la hoja `Retos`, añadir una fila con ID único, tipo (`semanal` o `mini`) y descripción.
2. El bot lo incluirá en la próxima publicación aleatoria.

No requiere cambios en el código.

### Añadir un checkpoint al timeline

1. En la hoja `Checkpoints`, añadir una fila con número de semana, fecha y textos.
2. Si el checkpoint es específico de un usuario, llenar la columna `Usuario`. Si es compartido, dejarlo vacío.
3. Aparecerá automáticamente en el timeline de Inicio y en el tab Timeline de Más.

### Añadir un tile al vision board

**Por hoja de cálculo:**
1. En la hoja `Visión`, añadir una fila con `Tipo = imagen/cita/meta` y los campos correspondientes.

**Por el dashboard:**
1. Ir a la pantalla Visión → botón "Añadir imagen" → escribir título (opcional) → subir imagen.
2. La imagen se sube a Cloudinary y la URL se guarda automáticamente en la hoja.

---

## 8. Subir fotos (Cloudinary)

### Configurar Cloudinary (una sola vez)

1. Crear cuenta gratuita en [cloudinary.com](https://cloudinary.com).
2. Anotar el **Cloud name** del dashboard.
3. Ir a **Settings → Upload → Upload presets → Add upload preset**:
   - Nombre: `fitquest_unsigned`
   - Signing mode: **Unsigned**
   - Guardar.
4. Editar `frontend/.env.local`:
   ```env
   VITE_CLOUDINARY_CLOUD=tu_cloud_name
   VITE_CLOUDINARY_PRESET=fitquest_unsigned
   ```
5. Rebuild: `cd frontend && npm run build`.

### Límites del plan gratuito de Cloudinary

- 25 GB de almacenamiento
- 25 GB de ancho de banda mensual

Para un reto de 16 semanas con fotos de progreso semanales de 2 personas, el plan gratuito es más que suficiente.

---

## 9. Solución de problemas comunes

### El dashboard muestra datos viejos tras editar la hoja

El servidor guarda los datos en caché (en memoria) para reducir llamadas a la API de Google. Soluciones:

1. **Botón Sync** en el topbar del dashboard → limpia el caché y recarga todos los datos.
2. Alternativa manual: `GET http://localhost:8080/api/clear-cache`.
3. Reiniciar Flask (`Ctrl+C` → `python keep_alive.py`).

### Error 429 — Quota exceeded (Google Sheets)

Demasiadas llamadas simultáneas a la API de Google. Causas comunes:
- Múltiples usuarios con el dashboard abierto.
- TTL de caché muy bajo.

Solución: el caché está configurado con TTLs razonables (60–300 s). Si persiste, esperar 1 minuto y recargar.

### Los logros no aparecen como completados

1. Verificar que la hoja `LogrosUsuario` existe con columnas `Usuario`, `LogroID`, `Fecha`.
2. Usar el botón **Sincronizar** en el tab Logros del dashboard.
3. Verificar en los logs de Flask que `_run_check_logros_bg` no lanzó excepciones.

### Los retos activos no aparecen

La columna `Fecha fin válida` en `RetosHistóricos` debe tener formato `YYYY-MM-DD HH:MM:SS`. Si la celda tiene un apóstrofo al inicio (formato texto en Sheets), el sistema lo limpia automáticamente. Si el reto no aparece, verificar que la fecha sea ≥ hoy.

### El bot no registra hábitos

- Verificar que el usuario de Discord (`message.author.name`) coincide exactamente con el `Usuario` en la hoja `Metas`.
- El nombre es case-sensitive.

### Rebuild no se refleja en el browser

El navegador puede cachear el HTML. Solución:
- Recargar con `Ctrl+Shift+R` (hard refresh).
- Si el servidor está en red local, usar el botón Sync primero (invalida el `Cache-Control` del servidor).
- Verificar que el hash del bundle cambió: el nombre del archivo JS en `static/dist/assets/` debe ser diferente.
