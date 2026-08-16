# Promoter — Teleprompter con control remoto

App de teleprompter **instalable** (PWA) que funciona igual en Android y en iPhone/iPad, con:

- **Importación de guiones** desde Google Drive, desde archivos locales (`.txt`, `.md`, `.docx`,
  `.rtf`, `.html`) o pegando el texto.
- **Editor con formato real sobre el propio guion**: color de letra, resaltado, sombreado,
  subrayado, tamaño distinto para una sección concreta, encabezados que hacen de marcadores y
  «notas» que se ven al editar pero no al leer.
- **Diez presets de contraste** (no sólo blanco sobre negro) más color personalizado, atenuación del
  texto y oscurecido del fondo.
- **Espejo horizontal y vertical** para cristal de teleprompter.
- **Control remoto Bluetooth** (pedales, pasapáginas, mandos de teleprompter, disparadores de
  selfies) con mapeo configurable y modo «aprender botón».
- **Control remoto desde otro teléfono**: emparejamiento por QR, código de sala o dirección IP, con
  el menú completo replicado — velocidad, tamaño, colores, espejo, marcadores y cambio de guion sin
  tocar el teléfono que muestra el texto.

---

## Puesta en marcha

```bash
npm install
npm start          # compila la app y arranca el servidor en el puerto 8080
```

Al arrancar, el servidor imprime las direcciones por las que es accesible:

```
  Local:   http://localhost:8080
  Red:     http://192.168.1.20:8080
```

Abre la dirección **Red** en el teléfono que hará de teleprompter y también en el que hará de mando.
Los dos tienen que estar en la misma wifi.

Durante el desarrollo:

```bash
npm run dev         # Vite con recarga en caliente (puerto 5173)
npm run dev:server  # relay del control remoto en el 8080
```

---

## Instalar en el teléfono

Para que el teléfono la instale **como app de verdad** (icono propio, pantalla completa, funciona
sin conexión) el navegador exige **HTTPS**. Por eso hay dos caminos, según lo que necesites.

### Camino A — una URL propia en Internet (recomendado)

Es el que da la experiencia completa: se instala de verdad y el mando por red funciona desde
cualquier sitio, no sólo en la wifi de casa.

El repositorio ya trae la configuración: `render.yaml` para [Render](https://render.com) y un
`Dockerfile` para cualquier otro proveedor (Railway, Fly.io, un VPS, un NAS).

En Render: *New* → *Blueprint* → elige este repositorio → *Apply*. Sale una dirección tipo
`https://promoter-xxxx.onrender.com`. Ábrela en el teléfono y:

- **Android / Chrome**: menú ⋮ → «Instalar aplicación».
- **iPhone / iPad**: ábrela en **Safari** → botón Compartir → «Añadir a pantalla de inicio».

> En el plan gratuito de Render el servidor se duerme tras un rato sin uso; la primera carga puede
> tardar unos 30 segundos. Después va normal. Si lo vas a usar en rodajes, el plan más barato lo
> mantiene despierto.

### Camino B — desde tu propio ordenador, por wifi

Sin cuentas ni despliegues, pero sólo dentro de tu red y con la instalación limitada (en Android no
aparecerá «Instalar», y en iPhone quedará como acceso directo sin modo offline).

```bash
npm install
npm start
```

Abre en el teléfono la dirección **Red** que imprime el servidor (`http://192.168.1.x:8080`). El
ordenador tiene que quedarse encendido y en la misma wifi.

Si quieres HTTPS sin desplegar nada, levanta un túnel sobre el servidor local y usa la dirección
que te dé (ya es instalable):

```bash
npx cloudflared tunnel --url http://localhost:8080
```

### Una vez instalada

Los guiones se guardan en el propio teléfono (IndexedDB) y la app abre sin conexión. Sólo hacen
falta red y servidor para el **mando por red** y para **Google Drive**; el mando **Bluetooth**
funciona siempre, incluso en modo avión.

Instala la app en los **dos** teléfonos: el que muestra el texto y el que hace de mando. Son la
misma app; el segundo entra en modo mando al escanear el QR.

---

## Los dos mandos a distancia

### 1. Mando Bluetooth

Casi todos los mandos de teleprompter, pedales y clickers se emparejan con el teléfono como si
fueran un **teclado**. Empareja el mando desde los ajustes Bluetooth del sistema y abre Promoter →
⚙ → **Bluetooth**.

Vienen cuatro perfiles listos: *Universal*, *Pedal de 2 botones*, *Disparador de selfies* y *Puntero
de presentaciones*. Si tu mando manda otras teclas, pulsa la acción que quieras («Play / Pausa»,
«Reiniciar»…) y después el botón físico: Promoter lo aprende y crea una copia editable del perfil.

Perfil universal por defecto:

| Tecla | Acción |
| --- | --- |
| Espacio / Intro | Play / Pausa |
| ↑ / ↓ | Más rápido / más lento |
| ← / → · Re Pág / Av Pág | Retroceder / avanzar una pantalla |
| R | Volver al principio |
| M | Espejo |
| C | Siguiente contraste |
| + / − | Tamaño de letra |
| [ / ] | Marcador anterior / siguiente |
| H | Mostrar u ocultar controles |
| Esc | Volver a la biblioteca |

Algunos mandos envían teclas multimedia en lugar de teclas normales. Para esos, activa «Capturar
botones de volumen y multimedia» en el mismo panel.

### 2. Otro teléfono como mando

En el teléfono que hace de teleprompter: ⚙ → **Mando de red**. Ahí están el código de sala y un QR.

En el segundo teléfono, cualquiera de estas tres vías:

1. **Escanear el QR** con la cámara — abre el mando ya conectado.
2. Abrir la misma dirección y pulsar **«Usar este dispositivo como mando»**, escribiendo el código.
3. Escribir a mano la **dirección IP** del servidor en el campo «Servidor» (`192.168.1.20:8080`) y
   el código de sala. Útil si cada teléfono llegó a la app por un camino distinto.

Desde el mando se controla **todo**: play/pausa, cuenta atrás, velocidad (manual o en palabras por
minuto), tamaño y tipografía, interlineado, ancho y alineación, los diez contrastes, espejo,
posición de la guía de lectura, salto a marcadores, barra de posición y **cambio de guion** — sin
tocar el teléfono que está en el trípode.

El enlace reconecta solo si la wifi se cae, y admite varios mandos a la vez (por ejemplo, dirección
y realización).

### Usarlo fuera de la red local

El mismo servidor (`server/`) desplegado en cualquier host público hace de relay por Internet: pon
su dirección en el campo «Servidor» de los dos dispositivos y usa el mismo código de sala. El relay
sólo reenvía mensajes de control; **los guiones nunca salen del teléfono**.

---

## Google Drive

Promoter se conecta a Drive con **tu propio ID de cliente de OAuth**, así que ningún servidor
intermedio ve tus documentos.

1. En [Google Cloud Console](https://console.cloud.google.com/) crea un proyecto y activa la
   **Google Drive API**.
2. Pantalla de consentimiento → tipo *Externo* → añade tu cuenta como usuario de prueba.
3. Credenciales → **ID de cliente de OAuth** → tipo **Aplicación web**.
4. En «Orígenes autorizados de JavaScript» añade la dirección desde la que abres Promoter
   (por ejemplo `http://192.168.1.20:8080`, y también `http://localhost:5173` si desarrollas).
5. Copia el ID (`…apps.googleusercontent.com`) en Promoter → ⚙ → Datos → «ID de cliente OAuth».

Se importan Documentos de Google (conservando negritas, colores y encabezados), `.docx`, `.txt`,
`.md` y `.rtf`. El permiso pedido es de **sólo lectura** y el token vive únicamente en memoria.

---

## Gestos y atajos en la pantalla del prompter

| Gesto | Acción |
| --- | --- |
| Toque | Play / pausa |
| Arrastrar | Mover el texto a mano |
| Pellizcar | Tamaño de letra |
| ⚙ (arriba a la derecha) | Panel de controles completo |
| ☰ (arriba a la izquierda) | Volver a la biblioteca |

Los controles se ocultan solos al reproducir y vuelven con un toque.

---

## Estructura del proyecto

```
web/                      PWA (React + TypeScript + Vite)
  src/components/         Biblioteca, Editor, Prompter, Mando, paneles
  src/state/              Estado global, enlace remoto, mando Bluetooth
  src/lib/                Modelo, almacenamiento, importadores, protocolo
server/                   Sirve la PWA y hace de relay de emparejamiento
scripts/make-icons.mjs    Genera los iconos de la PWA
```

Piezas que conviene conocer:

- `web/src/components/ControlPanel.tsx` — **una sola** superficie de control que usan tanto el panel
  del propio teleprompter como el teléfono-mando. Añadir un ajuste ahí lo añade en los dos sitios.
- `web/src/state/bus.ts` — canal imperativo hacia el motor de scroll: la posición no pasa por React,
  que a 60 fps sería un derroche.
- `web/src/lib/remote/protocol.ts` — mensajes del enlace y normalización de la dirección del
  servidor.
- `server/src/index.js` — relay por salas: un teleprompter y N mandos, sin interpretar el contenido.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm start` | Compila y sirve la app en el 8080 |
| `npm run dev` | Vite en modo desarrollo |
| `npm run dev:server` | Sólo el relay |
| `npm run build` | Build de producción en `web/dist` |
| `npm run typecheck` | Comprobación de tipos |

Variables de entorno del servidor: `PORT` (8080), `HOST` (0.0.0.0), `PROMOTER_DIST` (ruta al build).

Despliegue: `render.yaml` (Blueprint de Render) y `Dockerfile` para cualquier otro proveedor de
contenedores.
