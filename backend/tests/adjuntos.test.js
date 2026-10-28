// Tests de fotos y archivos adjuntos: tipos permitidos por firma, limpieza de EXIF,
// nombres seguros y acceso según quién ve la tarea o la licencia.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { pool, query } from '../src/config/db.js';
import { hoy, sumarDias } from '../src/utils/fechas.js';

const app = crearApp();
const api = () => request(app);
const PASSWORD = process.env.SEED_PASSWORD || 'BurgosCorp2026';
const EMAILS = {
  marcelo: 'marcelo.ibanez@burgoscorp.test',  // jefe de Soldadura
  claudio: 'claudio.ortiz@burgoscorp.test',   // soldador
  nestor: 'nestor.romero@burgoscorp.test',    // herrero de la misma área, no asignado
  diego: 'diego.acosta@burgoscorp.test',      // jefe Comercial (otra área)
  jorge: 'jorge.dominguez@burgoscorp.test',   // jefe de Mecanizado
  matias: 'matias.peralta@burgoscorp.test',   // operador CNC (Mecanizado)
  carolina: 'carolina.mendez@burgoscorp.test', // jefa de RRHH
};
const s = {};
const como = (q) => ({ Authorization: `Bearer ${s[q].accessToken}` });

// JPEG mínimo con un bloque EXIF que simula traer la ubicación GPS.
const seg = (marcador, contenido) => {
  const largo = Buffer.alloc(2);
  largo.writeUInt16BE(contenido.length + 2);
  return Buffer.concat([Buffer.from([0xff, marcador]), largo, contenido]);
};
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8]),
  seg(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1')),
  seg(0xe1, Buffer.from('Exif\0\0GPS-LAT-34.6037-LON-58.3816', 'latin1')),
  Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x12, 0x34, 0x56, 0xff, 0xd9]),
]);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'latin1');

let tareaId;
let fotoId;

function subir(quien, consulta, cuerpo, tipo = 'image/jpeg') {
  return api().post('/api/v1/adjuntos').query(consulta).set(como(quien)).set('Content-Type', tipo).send(cuerpo);
}

before(async () => {
  for (const [q, email] of Object.entries(EMAILS)) {
    const r = await api().post('/api/v1/auth/login').send({ email, password: PASSWORD });
    assert.equal(r.status, 200, `login ${email}`);
    s[q] = r.body.data;
  }
  await query(`DELETE l FROM solicitudes_licencia l JOIN usuarios u ON u.empleado_id = l.empleado_id WHERE u.email = ?`, [EMAILS.matias]);
  const t = await api().post('/api/v1/tareas').set(como('marcelo')).send({ titulo: 'Soldar brida de la reducción' });
  assert.equal(t.status, 201, JSON.stringify(t.body));
  tareaId = t.body.data.id;
  const a = await api().post(`/api/v1/tareas/${tareaId}/asignaciones`).set(como('marcelo')).send({ empleado_id: s.claudio.usuario.empleadoId });
  assert.equal(a.status, 201, JSON.stringify(a.body));
});
after(() => pool.end());

describe('fotos en una tarea', () => {
  test('el operario asignado sube una foto y se le quitan los datos de ubicación', async () => {
    const r = await subir('claudio', { entidad: 'tarea', entidad_id: tareaId, nombre: '../../etc/foto brida.jpeg' }, JPEG);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.data.mime, 'image/jpeg');
    assert.equal(r.body.data.nombre_original, 'foto brida.jpg', 'sin rutas y con la extensión real');
    fotoId = r.body.data.id;

    const archivo = await api().get(`/api/v1/adjuntos/${fotoId}`).set(como('claudio')).buffer(true).parse((res, cb) => {
      const partes = [];
      res.on('data', (c) => partes.push(c));
      res.on('end', () => cb(null, Buffer.concat(partes)));
    });
    assert.equal(archivo.status, 200);
    assert.equal(archivo.headers['content-type'], 'image/jpeg');
    assert.equal(archivo.headers['x-content-type-options'], 'nosniff');
    assert.ok(!archivo.body.includes(Buffer.from('GPS')), 'el EXIF no se guarda');
    assert.ok(archivo.body.includes(Buffer.from([0xff, 0xda])), 'la imagen sigue entera');
  });

  test('solo se aceptan imágenes y PDF reconocidos por su contenido', async () => {
    const disfrazado = await subir('claudio', { entidad: 'tarea', entidad_id: tareaId }, Buffer.from('<script>alert(1)</script>'));
    assert.equal(disfrazado.status, 400, 'un texto con Content-Type de imagen se rechaza');
    const html = await subir('claudio', { entidad: 'tarea', entidad_id: tareaId }, '<html></html>', 'text/html');
    assert.equal(html.status, 415);
    const roto = await subir('claudio', { entidad: 'tarea', entidad_id: tareaId }, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]));
    assert.equal(roto.status, 400, 'JPEG con la estructura dañada');
    const entidad = await subir('claudio', { entidad: 'usuarios', entidad_id: 1 }, JPEG);
    assert.equal(entidad.status, 400);
    const sinSesion = await api().post('/api/v1/adjuntos').query({ entidad: 'tarea', entidad_id: tareaId }).set('Content-Type', 'image/jpeg').send(JPEG);
    assert.equal(sinSesion.status, 401);
  });

  test('solo ve las fotos quien ve la tarea', async () => {
    const jefe = await api().get('/api/v1/adjuntos').query({ entidad: 'tarea', entidad_id: tareaId }).set(como('marcelo'));
    assert.equal(jefe.status, 200);
    assert.equal(jefe.body.data.length, 1);
    assert.equal(jefe.body.meta.puede_agregar, true);
    assert.equal((await api().get('/api/v1/adjuntos').query({ entidad: 'tarea', entidad_id: tareaId }).set(como('nestor'))).status, 404);
    assert.equal((await api().get(`/api/v1/adjuntos/${fotoId}`).set(como('diego'))).status, 404);
    assert.equal((await subir('nestor', { entidad: 'tarea', entidad_id: tareaId }, JPEG)).status, 404);
  });

  test('borra la foto quien la subió o el jefe; no se toca una tarea cerrada', async () => {
    assert.equal((await api().delete(`/api/v1/adjuntos/${fotoId}`).set(como('nestor'))).status, 404);
    assert.equal((await api().delete(`/api/v1/adjuntos/${fotoId}`).set(como('claudio'))).status, 204);
    assert.equal((await api().get(`/api/v1/adjuntos/${fotoId}`).set(como('claudio'))).status, 404);

    await api().post(`/api/v1/tareas/${tareaId}/cancelar`).set(como('marcelo')).send({});
    assert.equal((await subir('claudio', { entidad: 'tarea', entidad_id: tareaId }, JPEG)).status, 403);
  });
});

describe('certificado en una licencia', () => {
  test('el empleado adjunta el certificado médico y lo ve RRHH, no su jefe ni otra área', async () => {
    let f = sumarDias(hoy(), 1);
    while ([0, 6].includes(new Date(`${f}T00:00:00Z`).getUTCDay())) f = sumarDias(f, 1);
    const l = await api().post('/api/v1/licencias').set(como('matias')).send({ tipo: 'enfermedad', fecha_desde: f, fecha_hasta: f });
    assert.equal(l.status, 201, JSON.stringify(l.body));

    const r = await subir('matias', { entidad: 'licencia', entidad_id: l.body.data.id, nombre: 'certificado.pdf' }, PDF, 'application/pdf');
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.data.mime, 'application/pdf');

    // Es un dato de salud: el jefe aprueba la licencia sin ver el certificado.
    assert.equal((await api().get('/api/v1/adjuntos').query({ entidad: 'licencia', entidad_id: l.body.data.id }).set(como('jorge'))).status, 404);
    const rrhh = await api().get('/api/v1/adjuntos').query({ entidad: 'licencia', entidad_id: l.body.data.id }).set(como('carolina'));
    assert.equal(rrhh.status, 200);
    assert.equal(rrhh.body.data.length, 1);
    assert.equal(rrhh.body.meta.puede_agregar, false, 'RRHH ve, no agrega');
    assert.equal((await api().get('/api/v1/adjuntos').query({ entidad: 'licencia', entidad_id: l.body.data.id }).set(como('claudio'))).status, 404);
  });
});
