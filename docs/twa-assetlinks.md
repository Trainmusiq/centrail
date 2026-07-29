# Verificación de dominio para el TWA (`assetlinks.json`) — pendiente del fundador

**Qué es:** el archivo que le demuestra a Android que la app de Play y el sitio web son del mismo dueño. Sin él, el TWA abre igual pero **con la barra de navegador visible**, que es exactamente lo que se quiere evitar (y lo que hace que parezca un webview envuelto).

**Por qué no se hizo en esta sesión:** el archivo tiene que vivir en la **raíz del dominio**, no dentro de `/centrail/`:

```
https://trainmusiq.github.io/.well-known/assetlinks.json
```

Esa raíz hoy devuelve **404**: no existe el repo de la página raíz de la organización. Crear ese repo queda fuera del alcance de esta sesión.

---

## 1. Crear el repo de la raíz

Debe llamarse **exactamente** `trainmusiq.github.io` (nombre-de-la-org + `.github.io`). Es la única forma de que GitHub Pages lo sirva en la raíz del dominio. Cualquier otro nombre queda en un subdirectorio y no sirve.

Estructura mínima:

```
trainmusiq.github.io/
├── .nojekyll          ← imprescindible, ver punto 2
├── .well-known/
│   └── assetlinks.json
└── index.html         ← opcional, pero conviene (hoy la raíz da 404)
```

## 2. El `.nojekyll` no es opcional

GitHub Pages procesa los sitios con Jekyll por defecto, y **Jekyll ignora todo directorio que empiece con punto** — incluido `.well-known/`. Sin un archivo vacío llamado `.nojekyll` en la raíz del repo, `assetlinks.json` nunca se publica y la verificación falla sin decir por qué.

```bash
touch .nojekyll
```

## 3. Contenido de `.well-known/assetlinks.json`

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "RELLENAR",
      "sha256_cert_fingerprints": ["RELLENAR"]
    }
  }
]
```

### `package_name`
El identificador de la app Android, el que se elige al generar el proyecto con Bubblewrap y que ya no se puede cambiar una vez publicado en Play. Sugerencia coherente con el dominio: `io.github.trainmusiq.centrail`.

### `sha256_cert_fingerprints`
La huella SHA-256 del certificado con el que se **firma** el APK/AAB. Formato: 32 pares hexadecimales separados por dos puntos (`AB:CD:EF:...`).

De dónde sale, según cómo se firme:

- **Con Play App Signing** (lo normal, y lo que Bubblewrap asume por defecto): la huella que vale es la de Google, no la del keystore local. Está en **Play Console → tu app → Configuración → Integridad de la aplicación → Firma de apps**, bajo "Certificado de la clave de firma de apps". Ojo: ahí aparecen dos certificados (el de firma y el de carga); el que va en `assetlinks.json` es el **de firma de apps**.
- **Desde el keystore local**, si se firma manualmente:
  ```bash
  keytool -list -v -keystore ruta/al/keystore.jks -alias TU_ALIAS
  ```
  y se copia la línea `SHA256:`.
- Bubblewrap también la imprime al correr `bubblewrap build`.

**Consecuencia práctica:** la huella definitiva recién se conoce **después** de subir el primer AAB a Play Console. Lo habitual es publicar el `assetlinks.json` en ese momento, no antes.

## 4. Un solo archivo sirve para todo el ecosistema

`assetlinks.json` es un **array**: admite varias apps sobre el mismo dominio. Cuando lleguen trackjunction y chordwagon, se agregan objetos al mismo archivo, cada uno con su `package_name` y su huella. No hace falta un archivo por app ni un dominio por app.

```json
[
  { "relation": ["delegate_permission/common.handle_all_urls"],
    "target": { "namespace": "android_app", "package_name": "io.github.trainmusiq.centrail", "sha256_cert_fingerprints": ["..."] } },
  { "relation": ["delegate_permission/common.handle_all_urls"],
    "target": { "namespace": "android_app", "package_name": "io.github.trainmusiq.trackjunction", "sha256_cert_fingerprints": ["..."] } }
]
```

## 5. Comprobar que quedó bien

```bash
curl -s https://trainmusiq.github.io/.well-known/assetlinks.json
```

Debe devolver el JSON con `Content-Type: application/json`. Si devuelve 404, casi siempre es el `.nojekyll` que falta.

Verificador oficial de Google (reemplazando el package name):

```
https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://trainmusiq.github.io&relation=delegate_permission/common.handle_all_urls
```

Y en el dispositivo, con la app instalada: si la barra de navegador **no** aparece al abrir, la verificación pasó.

---

## Nota sobre el scope

El TWA apunta a `https://trainmusiq.github.io/centrail/`, pero la verificación es **por dominio**, no por ruta. Por eso el archivo va en la raíz aunque la app viva en un subdirectorio — y por eso el mismo archivo cubre a todas las herramientas del ecosistema.
