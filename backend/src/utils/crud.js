// Motor CRUD común a todos los módulos.
//
// A partir de una configuración arma un Router con:
//   GET    /       listado paginado, con búsqueda, filtros y orden (permiso "ver")
//   GET    /:id    detalle                                          (permiso "ver")
//   POST   /       alta                                             (permiso "crear")
//   PUT    /:id    modificación parcial                             (permiso "editar")
//   DELETE /:id    baja (lógica si la tabla tiene `activo`)         (permiso "borrar")
//
// Seguridad: los nombres de tablas y columnas salen de la configuración (código),
// nunca de lo que manda el cliente; los valores van siempre como parámetros `?`.
// Cada consulta se filtra según el alcance del permiso (todo / área / propio).
import { Router } from 'express';
import { pool, query, queryOne } from '../config/db.js';
import { autenticar } from '../middlewares/auth.js';
import { requierePermiso } from '../middlewares/permisos.js';
import { validar } from '../middlewares/validar.js';
import { filtroAlcance } from '../services/permisos.js';
import { auditar } from '../services/auditoria.js';
import { paramsId, consultaListado } from '../validators/comunes.js';
import { errores } from './errores.js';

/**
 * @param {object} cfg
 * @param {string} cfg.modulo        código de módulo (permisos)
 * @param {string} cfg.tabla         tabla principal (se usa con alias `t`)
 * @param {string} cfg.entidad       nombre para auditoría
 * @param {string} [cfg.select]      columnas del SELECT (por defecto `t.*`)
 * @param {string} [cfg.joins]       JOINs adicionales para el listado/detalle
 * @param {string[]} [cfg.busqueda]  columnas donde busca `q`
 * @param {object} [cfg.filtros]     { nombreParam: { col, esquema } }
 * @param {object} [cfg.ordenables]  { nombreParam: columna }
 * @param {string} cfg.ordenDefecto  columna de orden por defecto
 * @param {import('zod').ZodObject} cfg.esquemaCrear
 * @param {import('zod').ZodObject} [cfg.esquemaEditar]  por defecto esquemaCrear.partial()
 * @param {boolean} [cfg.bajaLogica] DELETE pone activo = 0
 * @param {object} [cfg.alcance]     { areaCol, areaCampo, propioCol, propioDe }; sin esto es catálogo compartido
 * @param {string[]} [cfg.ocultar]   columnas que nunca se devuelven
 * @param {Function} [cfg.antesDeGuardar] async (datos, { req, id }) => datos  reglas de negocio
 */
export function crearRecursoCrud(cfg) {
  const router = Router();
  const select = cfg.select ?? 't.*';
  const joins = cfg.joins ?? '';
  const esquemaEditar = (cfg.esquemaEditar ?? cfg.esquemaCrear.partial())
    .refine((d) => Object.keys(d).length > 0, 'No se envió ningún campo para modificar');
  const filtros = cfg.filtros ?? {};
  const ordenables = cfg.ordenables ?? {};

  const limpiar = (fila) => {
    if (!fila || !cfg.ocultar) return fila;
    const copia = { ...fila };
    for (const c of cfg.ocultar) delete copia[c];
    return copia;
  };

  // Sin `cfg.alcance` el recurso es un catálogo compartido: quien tiene permiso lo ve completo.
  const condicionAlcance = (req) => (cfg.alcance
    ? filtroAlcance(req.usuario, req.permiso.alcance, cfg.alcance)
    : { sql: '1=1', params: [] });

  async function obtener(req, id) {
    const alc = condicionAlcance(req);
    return queryOne(
      `SELECT ${select} FROM ${cfg.tabla} t ${joins} WHERE t.id = ? AND (${alc.sql})`,
      [id, ...alc.params],
    );
  }

  // Con alcance de área, solo se puede crear o mover registros dentro del área propia.
  function controlarArea(req, datos) {
    const campo = cfg.alcance?.areaCampo;
    if (!campo || req.permiso.alcance === 'todo' || datos[campo] === undefined) return;
    if (datos[campo] !== req.usuario.area_id) {
      throw errores.prohibido('Solo podés operar sobre registros de tu área');
    }
  }

  // ------------------------------------------------------------ listado
  router.get('/', autenticar, requierePermiso(cfg.modulo, 'ver'), validar({ query: consultaListado }), async (req, res) => {
    const { pagina, limite, q, orden, dir, ...resto } = req.validado.query;
    const alc = condicionAlcance(req);
    const where = [`(${alc.sql})`];
    const params = [...alc.params];

    if (q && cfg.busqueda?.length) {
      where.push(`(${cfg.busqueda.map((c) => `${c} LIKE ?`).join(' OR ')})`);
      const patron = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
      params.push(...cfg.busqueda.map(() => patron));
    }

    for (const [nombre, valorCrudo] of Object.entries(resto)) {
      const filtro = filtros[nombre];
      if (!filtro) throw errores.validacion([{ campo: `query.${nombre}`, mensaje: 'Filtro desconocido' }]);
      const r = filtro.esquema.safeParse(valorCrudo);
      if (!r.success) throw errores.validacion([{ campo: `query.${nombre}`, mensaje: 'Valor de filtro inválido' }]);
      where.push(`${filtro.col} = ?`);
      params.push(r.data);
    }

    if (orden && !ordenables[orden]) {
      throw errores.validacion([{ campo: 'query.orden', mensaje: `Se puede ordenar por: ${Object.keys(ordenables).join(', ')}` }]);
    }
    const columnaOrden = orden ? ordenables[orden] : cfg.ordenDefecto;
    const direccion = dir === 'desc' ? 'DESC' : 'ASC';
    const offset = (pagina - 1) * limite;
    const condicion = where.join(' AND ');

    // pagina/limite ya son enteros validados; LIMIT con parámetros da problemas en algunas versiones de MySQL.
    const [filas] = await pool.query(
      `SELECT ${select} FROM ${cfg.tabla} t ${joins} WHERE ${condicion}
       ORDER BY ${columnaOrden} ${direccion}, t.id ${direccion} LIMIT ${Number(limite)} OFFSET ${Number(offset)}`,
      params,
    );
    const [{ total }] = await query(`SELECT COUNT(*) AS total FROM ${cfg.tabla} t ${joins} WHERE ${condicion}`, params);

    res.json({ ok: true, data: filas.map(limpiar), meta: { pagina, limite, total } });
  });

  // ------------------------------------------------------------ detalle
  router.get('/:id', autenticar, requierePermiso(cfg.modulo, 'ver'), validar({ params: paramsId }), async (req, res) => {
    const fila = await obtener(req, req.validado.params.id);
    if (!fila) throw errores.noEncontrado();
    res.json({ ok: true, data: limpiar(fila) });
  });

  // ------------------------------------------------------------ alta
  router.post('/', autenticar, requierePermiso(cfg.modulo, 'crear'), validar({ body: cfg.esquemaCrear }), async (req, res) => {
    let datos = req.validado.body;
    controlarArea(req, datos);
    if (cfg.antesDeGuardar) datos = await cfg.antesDeGuardar(datos, { req });

    const columnas = Object.keys(datos);
    const [resultado] = await pool.execute(
      `INSERT INTO ${cfg.tabla} (${columnas.map((c) => `\`${c}\``).join(', ')}) VALUES (${columnas.map(() => '?').join(', ')})`,
      columnas.map((c) => datos[c]),
    );
    await auditar(req, { accion: 'crear', entidad: cfg.entidad, entidadId: resultado.insertId });

    const creado = await queryOne(`SELECT ${select} FROM ${cfg.tabla} t ${joins} WHERE t.id = ?`, [resultado.insertId]);
    res.status(201).json({ ok: true, data: limpiar(creado) });
  });

  // ------------------------------------------------------------ modificación
  router.put('/:id', autenticar, requierePermiso(cfg.modulo, 'editar'), validar({ params: paramsId, body: esquemaEditar }), async (req, res) => {
    const { id } = req.validado.params;
    if (!(await obtener(req, id))) throw errores.noEncontrado();

    let datos = req.validado.body;
    controlarArea(req, datos);
    if (cfg.antesDeGuardar) datos = await cfg.antesDeGuardar(datos, { req, id });

    const columnas = Object.keys(datos);
    if (columnas.length) {
      await pool.execute(
        `UPDATE ${cfg.tabla} SET ${columnas.map((c) => `\`${c}\` = ?`).join(', ')} WHERE id = ?`,
        [...columnas.map((c) => datos[c]), id],
      );
    }
    await auditar(req, { accion: 'editar', entidad: cfg.entidad, entidadId: id, detalle: { campos: columnas } });
    res.json({ ok: true, data: limpiar(await obtener(req, id)) });
  });

  // ------------------------------------------------------------ baja
  router.delete('/:id', autenticar, requierePermiso(cfg.modulo, 'borrar'), validar({ params: paramsId }), async (req, res) => {
    const { id } = req.validado.params;
    if (!(await obtener(req, id))) throw errores.noEncontrado();

    if (cfg.bajaLogica) await query(`UPDATE ${cfg.tabla} SET activo = 0 WHERE id = ?`, [id]);
    else await query(`DELETE FROM ${cfg.tabla} WHERE id = ?`, [id]);

    await auditar(req, { accion: 'borrar', entidad: cfg.entidad, entidadId: id });
    res.status(204).end();
  });

  return router;
}
