// Descarga de archivos que arma la app (por ahora, planillas CSV para Excel).
//  - Web: se descarga directo desde el navegador.
//  - Teléfono: se guarda en la caché de la app y se abre el menú de compartir (Drive, WhatsApp,
//    email, "Guardar en Descargas"…).
// El CSV usa ";" y coma decimal (Excel en español lo abre en columnas) y BOM para que se vean las tildes.
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Una celda de texto: entre comillas y, si empieza con = + - @ (Excel la tomaría como fórmula), con un
 * apóstrofo adelante. Evita la "inyección de fórmulas" con datos que vienen de la base (OWASP).
 */
function celda(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? v.toLocaleString('es-AR', { useGrouping: false, maximumFractionDigits: 2 }) : '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function armarCsv(encabezados, filas) {
  return `﻿${[encabezados, ...filas].map((f) => f.map(celda).join(';')).join('\r\n')}\r\n`;
}

/** Nombre de archivo seguro (sin barras ni caracteres raros). */
const nombreSeguro = (n) => n.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80);

export async function descargarCsv(nombre, encabezados, filas) {
  const texto = armarCsv(encabezados, filas);
  const archivo = nombreSeguro(nombre.endsWith('.csv') ? nombre : `${nombre}.csv`);
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = archivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const f = new File(Paths.cache, archivo);
  if (f.exists) f.delete();
  f.create();
  await f.write(texto);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Este teléfono no permite compartir archivos.');
  await Sharing.shareAsync(f.uri, { mimeType: 'text/csv', dialogTitle: 'Guardar o enviar la planilla', UTI: 'public.comma-separated-values-text' });
}
