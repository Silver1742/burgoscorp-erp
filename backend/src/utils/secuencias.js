// Numeración correlativa por tipo de documento y año, al estilo SAP: OT-2026-0001.
// Se toma con SELECT ... FOR UPDATE dentro de la transacción del alta, así dos altas
// simultáneas nunca reciben el mismo número.
export async function siguienteNumero(conn, codigo, ahora = new Date()) {
  const anio = ahora.getUTCFullYear();
  await conn.execute('INSERT IGNORE INTO secuencias (codigo, anio, ultimo) VALUES (?, ?, 0)', [codigo, anio]);
  const [[fila]] = await conn.execute('SELECT ultimo FROM secuencias WHERE codigo = ? AND anio = ? FOR UPDATE', [codigo, anio]);
  const numero = fila.ultimo + 1;
  await conn.execute('UPDATE secuencias SET ultimo = ? WHERE codigo = ? AND anio = ?', [numero, codigo, anio]);
  return `${codigo}-${anio}-${String(numero).padStart(4, '0')}`;
}
