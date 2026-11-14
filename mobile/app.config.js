// Configuración de Expo: todo lo de app.json, más el archivo de Firebase (google-services.json) que
// Android necesita para recibir notificaciones push. Ese archivo no se sube a git: en EAS llega como
// variable de entorno de tipo archivo (GOOGLE_SERVICES_JSON) y en la compu se busca al lado de este.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const local = path.join(__dirname, 'google-services.json');
  const archivo = process.env.GOOGLE_SERVICES_JSON || (fs.existsSync(local) ? './google-services.json' : undefined);
  return {
    ...config,
    android: { ...config.android, ...(archivo ? { googleServicesFile: archivo } : {}) },
  };
};
