// Después de `expo export -p web`: el hosting estático de Render no sirve el archivo
// `_expo/static/js/web/__expo-metro-runtime-<hash>.js` (responde 404 aunque está publicado),
// así que se le da un nombre neutro y se actualizan los HTML que lo cargan.
const fs = require('node:fs');
const path = require('node:path');

const dist = path.join(__dirname, '..', 'dist');
const carpetaJs = path.join(dist, '_expo', 'static', 'js', 'web');

const renombres = [];
for (const archivo of fs.readdirSync(carpetaJs)) {
  const m = /^__expo-metro-runtime-(\w+)\.js$/.exec(archivo);
  if (!m) continue;
  const nuevo = `runtime-${m[1]}.js`;
  fs.renameSync(path.join(carpetaJs, archivo), path.join(carpetaJs, nuevo));
  renombres.push([archivo, nuevo]);
}

function html(carpeta) {
  for (const e of fs.readdirSync(carpeta, { withFileTypes: true })) {
    const ruta = path.join(carpeta, e.name);
    if (e.isDirectory()) html(ruta);
    else if (e.name.endsWith('.html')) {
      let texto = fs.readFileSync(ruta, 'utf8');
      for (const [viejo, nuevo] of renombres) texto = texto.split(viejo).join(nuevo);
      fs.writeFileSync(ruta, texto);
    }
  }
}
html(dist);
console.log(renombres.length ? `Web ajustada: ${renombres.map((r) => r[1]).join(', ')}` : 'Web: nada para ajustar');
