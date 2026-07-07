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

FILES=(index.html engine/*.mjs workers/*.mjs)
for f in "${FILES[@]}"; do
  [ -f "$f" ] || continue
  sed -i '' "s/?v=${OLD}/?v=${NEW}/g" "$f"
done

# APP_VERSION embebido en index.html (usado en el bloque de diagnóstico copiable)
sed -i '' "s/APP_VERSION = \"${OLD}\"/APP_VERSION = \"${NEW}\"/" index.html

node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '${NEW}';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

echo "Cache-busting actualizado: ${OLD} → ${NEW}"
echo "Revisa el diff (git diff) y commitea junto con el resto del release."
