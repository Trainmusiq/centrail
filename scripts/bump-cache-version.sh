#!/usr/bin/env bash
# Cache-busting para módulos ES en producción (hallazgo de sesión: el navegador
# puede quedarse con versiones viejas de un .mjs/.wasm/.json indefinidamente,
# incluso entre reloads — ver docs/especificacion.md §11). Sin build step, la
# app versiona sus propios imports/fetch con "?v=X"; este script bumpea ese
# string en todos los archivos a la vez, para no tener que hacerlo a mano en
# cada release.
#
# Uso: scripts/bump-cache-version.sh <version-nueva>
# Ejemplo: scripts/bump-cache-version.sh 1.1.0
set -euo pipefail
cd "$(dirname "$0")/.."

NEW="${1:?Uso: scripts/bump-cache-version.sh <version-nueva>}"
OLD=$(node -e "console.log(JSON.parse(require('fs').readFileSync('package.json','utf8')).version)")

if [ "$OLD" = "$NEW" ]; then
  echo "La versión ya es ${NEW}, nada que hacer."
  exit 0
fi

# privacidad.html y sw.js entran desde v1.4.0 (PWA). El service worker es crítico:
# su CACHE_VERSION DEBE quedar sincronizada con el cache-busting, o el caché del SW
# serviría una versión distinta de la que declaran los imports (ver comentario en sw.js).
FILES=(index.html privacidad.html sw.js engine/*.mjs workers/*.mjs)
for f in "${FILES[@]}"; do
  [ -f "$f" ] || continue
  # Reemplaza CUALQUIER "?v=<semver>", no solo la versión inmediatamente anterior.
  # Antes solo sustituía "?v=${OLD}", así que un archivo que se hubiera quedado atrás
  # en una versión vieja jamás se ponía al día: engine/i18n.mjs arrastró "?v=1.2.1"
  # durante tres releases y sirvió los diccionarios con cache-busting obsoleto
  # (detectado el 28 jul 2026 por el grep de huérfanos del cierre de v1.3.3).
  sed -i '' -E "s/\?v=[0-9]+\.[0-9]+\.[0-9]+/?v=${NEW}/g" "$f"
done

# APP_VERSION embebido en index.html (usado en el bloque de diagnóstico copiable)
sed -i '' -E "s/APP_VERSION = \"[0-9]+\.[0-9]+\.[0-9]+\"/APP_VERSION = \"${NEW}\"/" index.html

# CACHE_VERSION del service worker: es la MISMA versión, nunca una aparte (v1.4.0)
sed -i '' -E "s/CACHE_VERSION = \"[0-9]+\.[0-9]+\.[0-9]+\"/CACHE_VERSION = \"${NEW}\"/" sw.js

node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '${NEW}';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Verificación de huérfanos: ningún "?v=", APP_VERSION ni CACHE_VERSION puede quedar
# en otra versión. Incluye sw.js y privacidad.html desde v1.4.0.
# Solo referencias REALES: "?v=" seguido de un dígito. Así no matchea la prosa de los
# comentarios (el guardián se disparaba con un comentario de sw.js que menciona "?v=").
ORPHANS=$(grep -rnE "\?v=[0-9]" index.html privacidad.html sw.js engine/*.mjs workers/*.mjs 2>/dev/null \
  | grep -v "?v=${NEW}" || true)
ORPHANS="$ORPHANS$(grep -n "CACHE_VERSION = " sw.js | grep -v "\"${NEW}\"" || true)"
if [ -n "$ORPHANS" ]; then
  echo "ERROR: quedaron referencias en otra versión:" >&2
  echo "$ORPHANS" >&2
  exit 1
fi

echo "Cache-busting actualizado: ${OLD} → ${NEW} (sin huérfanos)"
echo "Revisa el diff (git diff) y commitea junto con el resto del release."
