# Guía de instalación paso a paso

Guía para dejar Promoter funcionando en el teléfono (teleprompter) y en la tableta (mando).
Tiempo total: unos 15 minutos, una sola vez.

---

## Antes de empezar

**Lo que necesitas:**

| | |
| --- | --- |
| Cuenta de GitHub | Ya la tienes: el código está en `meetda85/promoter` |
| Cuenta en Render | Gratis, se crea con la de GitHub en 30 segundos |
| El teléfono | Será el teleprompter (va en el trípode) |
| La tableta u otro teléfono | Será el mando |
| Wifi | Los dos aparatos en la misma red, al menos para probar |

**Opcional, para más adelante:**

- Un mando Bluetooth (pedal, pasapáginas o disparador de fotos) para el play/pausa a distancia.
- Una cuenta de Google, sólo si quieres importar guiones desde Drive.

**No necesitas** instalar nada en el ordenador, ni pagar la tienda de apps, ni saber programar.

---

## Elige dónde alojarla

Promoter necesita una dirección propia en Internet para poder instalarse como app. Tres opciones,
con lo que cuesta cada una de verdad:

| Opción | Precio | Se duerme | Mando por servidor | Mando directo |
| --- | --- | --- | --- | --- |
| **Render** (plan gratuito) | 0 € | Sí, tras ~15 min sin uso | Sí | Sí |
| **Railway** | ~5 USD al mes | No | Sí | Sí |
| **Vercel** (plan gratuito) | 0 € | No | **No** | Sí |

«Se duerme» significa que, si no la has usado en un rato, la primera carga tarda unos 30-50
segundos. Después va normal.

**Recomendación: empieza por Render gratis.** No cuesta nada y lo prueba todo. Si esa espera
inicial te molesta en un rodaje, pasarte a Railway es cambiar de web, no de código: el mismo
repositorio ya trae la configuración de las tres.

---

## Paso 1 — Publicar la app (sólo una vez)

1. Entra en **[render.com](https://render.com)** y pulsa *Get Started* → **Sign in with GitHub**.
2. Autoriza a Render el acceso al repositorio `meetda85/promoter`.
3. En el panel, pulsa **New +** → **Blueprint**.
4. Elige el repositorio **promoter**. Render lee solo el archivo `render.yaml`, así que no hay
   nada que rellenar.
5. Pulsa **Apply**.
6. Espera de 3 a 5 minutos mientras compila. Cuando el estado sea **Live**, arriba verás la
   dirección, del estilo:

   ```
   https://promoter-xxxx.onrender.com
   ```

7. **Cópiala**. Es la única cosa que tienes que guardar de todo este paso.

> **Sobre la rama:** Render despliega la rama principal del repositorio, que ahora mismo es
> `claude/teleprompter-remote-controls-c0vf3s`, la que tiene el código. No tienes que tocar nada.
> Si más adelante creas una rama `main`, acuérdate de apuntar Render a ella.

---

## Paso 2 — Instalar en el teléfono (el teleprompter)

1. Abre esa dirección en el navegador del teléfono.
2. Instálala:
   - **Android (Chrome):** menú de los tres puntos ⋮ → **Instalar aplicación**.
   - **iPhone (Safari, no Chrome):** botón **Compartir** ⬆️ → **Añadir a pantalla de inicio**.
3. Ciérralo todo y ábrela desde el icono nuevo. Debe verse a pantalla completa, sin barra del
   navegador. Si es así, está bien instalada.

---

## Paso 3 — Instalar en la tableta (el mando)

Exactamente lo mismo: abre la misma dirección en la tableta e instálala igual.

Es la misma app en los dos sitios. Lo que cambia es el papel que le das a cada uno, y eso se
decide en el paso siguiente.

---

## Paso 4 — Enlazar los dos

**En el teléfono** (el que llevará el texto):

1. Abre Promoter y pulsa el engranaje ⚙ arriba a la derecha.
2. Pestaña **Mando de red**. Verás un código QR y un código de seis letras.

**En la tableta:**

3. Pulsa ⚙ → **Usar este dispositivo como mando**.
4. Pulsa **Escanear el código del teleprompter** y apunta la cámara al QR del teléfono.

Listo. Arriba en la tableta debe poner **Conectado**, y ya controla el teléfono.

> Si prefieres no usar la cámara: en la tableta escribe a mano el código de seis letras en «O
> escribe el código de sala» y pulsa *Conectar*.

---

## Paso 5 — Tu primer guion

En el teléfono (o en la tableta, da igual):

1. **+ Añadir guion** → **Pegar texto**.
2. Pega el texto y pulsa *Crear*.
3. Se abre el editor: pon en color o resalta lo que quieras marcar. Las líneas en MAYÚSCULAS se
   convierten solas en marcadores de sección, para poder saltar entre partes.
4. Pulsa **Leer**.

Ahora, **desde la tableta**, prueba a:

- Darle a **Reproducir** y ajustar el ritmo con *Más lento / Más rápido*.
- Pestaña **Texto**: cambiar el tamaño de letra.
- Pestaña **Color**: cambiar el contraste y activar el **espejo** si usas cristal de teleprompter.
- Pestaña **Guiones**: elegir otro guion, o pulsar ✎ para corregir el texto sin tocar el teléfono.

---

## Paso 6 — Mando Bluetooth (opcional)

1. Empareja el mando con el **teléfono** desde los ajustes Bluetooth del sistema (se anuncia como
   teclado; no hace falta hacer nada en Promoter todavía).
2. En Promoter: ⚙ → pestaña **Bluetooth**.
3. Prueba a pulsar un botón del mando estando en el prompter. Si ya hace play/pausa, has terminado.
4. Si no, pulsa la acción que quieras («Play / Pausa») y después el botón físico del mando.
   Promoter lo aprende y lo guarda.

---

## Paso 7 — Google Drive (opcional)

Sólo si quieres importar guiones directamente desde tu Drive. Promoter usa **tu propio** permiso de
Google, así que ningún servidor intermedio ve tus documentos.

1. Entra en [Google Cloud Console](https://console.cloud.google.com/) y crea un proyecto.
2. Activa la **Google Drive API**.
3. Pantalla de consentimiento → tipo *Externo* → añade tu correo como usuario de prueba.
4. Credenciales → **Crear credenciales** → **ID de cliente de OAuth** → tipo **Aplicación web**.
5. En «Orígenes autorizados de JavaScript» pega tu dirección de Render
   (`https://promoter-xxxx.onrender.com`, sin barra al final).
6. Copia el ID que termina en `.apps.googleusercontent.com`.
7. En Promoter: ⚙ → **Datos** → pégalo en «ID de cliente OAuth».

Ya puedes usar **+ Añadir guion → Google Drive**.

---

## Si algo no va

| Lo que ves | Qué pasa |
| --- | --- |
| La app tarda mucho en abrir la primera vez | El servidor gratuito estaba dormido. Normal, espera 30-50 s. |
| En el teléfono pone «Sin enlace» | Igual: el servidor está despertando. Se conecta solo. |
| En Android no aparece «Instalar aplicación» | No estás en la dirección `https` de Render, sino en una `http`. |
| En iPhone no aparece «Añadir a pantalla de inicio» | Estás en Chrome. En iPhone tiene que ser **Safari**. |
| La cámara no se abre al escanear | Igual que arriba: hace falta `https`. Usa el código de seis letras. |
| La tableta no encuentra el teleprompter | Comprueba que las dos tienen el mismo código y que el teléfono tiene el enlace activo (⚙ → Mando de red). |
| Estáis en un sitio sin Internet | Usa el **enlace directo**: ⚙ → Mando de red → *Directo, sin internet*. Ver más abajo. |

---

## Rodar sin Internet

Si grabas en una localización sin cobertura, o la wifi no tiene salida a Internet:

1. Enciende el **punto de acceso** de uno de los dos aparatos y conecta el otro a él.
2. En el teléfono: ⚙ → Mando de red → pestaña **Directo, sin internet** → *Generar código de enlace*.
3. En la tableta: *Usar como mando* → **Escanear el código del teleprompter**. Te devuelve un
   segundo QR.
4. En el teléfono: **Escanear la respuesta del mando**.

Quedan conectados entre ellos, sin pasar por ningún servidor. Hay que repetirlo cada vez que se
cierra la app, así que hazlo **antes** de montar el teléfono en el trípode.

Los guiones ya están guardados dentro del teléfono, así que se leen igual sin conexión. El mando
Bluetooth también funciona siempre, incluso en modo avión.

---

## Alternativa: sin publicar nada

Si prefieres no crear ninguna cuenta y tienes un ordenador a mano en el mismo wifi:

```bash
npm install
npm start
```

El servidor imprime una dirección tipo `http://192.168.1.20:8080`. Ábrela en los dos aparatos. El
ordenador tiene que quedarse encendido, y la app no se instalará del todo (Android no ofrecerá
«Instalar» y en iPhone quedará como acceso directo sin modo sin conexión).
