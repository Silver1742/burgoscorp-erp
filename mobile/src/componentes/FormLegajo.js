// Formulario de un legajo (lo usa RRHH): alta en "Nuevo legajo" y edición desde la ficha.
// El número de legajo lo asigna la API. La validación final también es de la API; acá se
// marcan antes los errores obvios para no hacer el viaje.
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Tarjeta, Campo, Opciones, Boton } from './ui';
import Selector from './Selector';
import { useToast } from '../contexto/toast';
import { espacio, useTema } from '../tema';

const ESTADOS = [
  { valor: 'activo', titulo: 'Activo' },
  { valor: 'licencia', titulo: 'De licencia' },
  { valor: 'baja', titulo: 'Baja' },
];
const esFecha = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const fecha = (v) => (v ? String(v).slice(0, 10) : '');

/** Valores del formulario a partir de un legajo (o vacíos para un alta). */
function desde(e) {
  return {
    nombre: e?.nombre ?? '', apellido: e?.apellido ?? '', dni: e?.dni ?? '', cuil: e?.cuil ?? '',
    fecha_nacimiento: fecha(e?.fecha_nacimiento), email_laboral: e?.email_laboral ?? '',
    telefono: e?.telefono ?? '', direccion: e?.direccion ?? '',
    area_id: e?.area_id ?? null, area_texto: e?.area_nombre ?? null,
    puesto_id: e?.puesto_id ?? null, puesto_texto: e?.puesto_nombre ?? null,
    fecha_ingreso: fecha(e?.fecha_ingreso) || new Date().toISOString().slice(0, 10),
    estado: e?.estado ?? 'activo', fecha_egreso: fecha(e?.fecha_egreso),
    costo_hora: e?.costo_hora != null ? String(e.costo_hora) : '',
  };
}

/**
 * @param {object}   [legajo]   el legajo a editar (sin él, es un alta)
 * @param {Function} alGuardar  async (cuerpo) => void; si la API rechaza, tira el error con porCampo
 */
export default function FormLegajo({ legajo, alGuardar, alCancelar }) {
  const t = useTema();
  const toast = useToast();
  const [f, setF] = useState(() => desde(legajo));
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const edicion = Boolean(legajo);
  const cambiar = (c) => (v) => setF((x) => ({ ...x, [c]: v }));

  function revisar() {
    const e = {};
    if (!f.nombre.trim()) e.nombre = 'Escribí el nombre';
    if (!f.apellido.trim()) e.apellido = 'Escribí el apellido';
    if (f.dni && !/^\d{7,8}$/.test(f.dni.trim())) e.dni = 'DNI de 7 u 8 dígitos, sin puntos';
    if (!f.area_id) e.area_id = 'Elegí el área';
    if (!esFecha(f.fecha_ingreso)) e.fecha_ingreso = 'Formato AAAA-MM-DD';
    if (f.fecha_nacimiento && !esFecha(f.fecha_nacimiento)) e.fecha_nacimiento = 'Formato AAAA-MM-DD';
    if (f.estado === 'baja' && !esFecha(f.fecha_egreso)) e.fecha_egreso = 'Con la baja va la fecha de egreso (AAAA-MM-DD)';
    if (f.costo_hora && !/^\d+([.,]\d{1,2})?$/.test(f.costo_hora)) e.costo_hora = 'Importe en pesos (ej. 12500,50)';
    return e;
  }

  async function guardar() {
    const e = revisar();
    setErrores(e);
    if (Object.keys(e).length) {
      toast.error('Revisá los campos marcados.');
      return;
    }
    const texto = (v) => v.trim() || null;
    const cuerpo = {
      nombre: f.nombre.trim(), apellido: f.apellido.trim(), dni: texto(f.dni), cuil: texto(f.cuil),
      fecha_nacimiento: f.fecha_nacimiento || null, email_laboral: texto(f.email_laboral),
      telefono: texto(f.telefono), direccion: texto(f.direccion),
      area_id: f.area_id, puesto_id: f.puesto_id ?? null, fecha_ingreso: f.fecha_ingreso,
      ...(f.costo_hora ? { costo_hora: Number(f.costo_hora.replace(',', '.')) } : {}),
      ...(edicion ? { estado: f.estado, fecha_egreso: f.estado === 'baja' ? f.fecha_egreso : null } : {}),
    };
    setGuardando(true);
    try {
      await alGuardar(cuerpo);
    } catch (err) {
      setErrores(err.porCampo ?? {});
      toast.error(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <View>
      <Tarjeta titulo="Persona" icono="person-outline">
        <Campo etiqueta="Nombre" value={f.nombre} onChangeText={cambiar('nombre')} error={errores.nombre} maxLength={60} />
        <Campo etiqueta="Apellido" value={f.apellido} onChangeText={cambiar('apellido')} error={errores.apellido} maxLength={60} />
        <Campo etiqueta="DNI (opcional)" value={f.dni} onChangeText={cambiar('dni')} error={errores.dni} keyboardType="number-pad" maxLength={8} placeholder="Sin puntos" />
        <Campo etiqueta="CUIL (opcional)" value={f.cuil} onChangeText={cambiar('cuil')} error={errores.cuil} keyboardType="number-pad" maxLength={13} placeholder="20-12345678-3" />
        <Campo etiqueta="Fecha de nacimiento (opcional)" value={f.fecha_nacimiento} onChangeText={cambiar('fecha_nacimiento')} error={errores.fecha_nacimiento} placeholder="AAAA-MM-DD" maxLength={10} />
      </Tarjeta>

      <Tarjeta titulo="Contacto" icono="call-outline">
        <Campo etiqueta="Email laboral (opcional)" value={f.email_laboral} onChangeText={cambiar('email_laboral')} error={errores.email_laboral} keyboardType="email-address" autoCapitalize="none" maxLength={254} />
        <Campo etiqueta="Teléfono (opcional)" value={f.telefono} onChangeText={cambiar('telefono')} error={errores.telefono} keyboardType="phone-pad" maxLength={30} />
        <Campo etiqueta="Dirección (opcional)" value={f.direccion} onChangeText={cambiar('direccion')} error={errores.direccion} maxLength={150} />
      </Tarjeta>

      <Tarjeta titulo="Trabajo" icono="briefcase-outline">
        <Selector etiqueta="Área" ruta="/areas" consulta={{ activo: 'true' }} valor={f.area_id} textoValor={f.area_texto}
          error={errores.area_id} mapear={(a) => ({ titulo: a.nombre })}
          alCambiar={(id, a) => setF((x) => ({ ...x, area_id: id, area_texto: a?.nombre ?? null, puesto_id: null, puesto_texto: null }))} />
        <Selector etiqueta="Puesto (opcional)" ruta="/puestos" consulta={{ activo: 'true', area_id: f.area_id ?? undefined }}
          valor={f.puesto_id} textoValor={f.puesto_texto} opcional deshabilitado={!f.area_id} error={errores.puesto_id}
          ayuda={f.area_id ? undefined : 'Primero elegí el área.'} mapear={(p) => ({ titulo: p.nombre })}
          alCambiar={(id, p) => setF((x) => ({ ...x, puesto_id: id, puesto_texto: p?.nombre ?? null }))} />
        <Campo etiqueta="Fecha de ingreso" value={f.fecha_ingreso} onChangeText={cambiar('fecha_ingreso')} error={errores.fecha_ingreso} placeholder="AAAA-MM-DD" maxLength={10} />
        <Campo etiqueta="Costo por hora (opcional)" value={f.costo_hora} onChangeText={cambiar('costo_hora')} error={errores.costo_hora}
          keyboardType="decimal-pad" maxLength={15} ayuda="Se usa para calcular el costo de las tareas y la liquidación." />
        {edicion ? (
          <>
            <Text style={{ color: t.texto, marginBottom: 6 }}>Estado</Text>
            <Opciones opciones={ESTADOS} valor={f.estado} alCambiar={cambiar('estado')} />
            {f.estado === 'baja' ? (
              <Campo etiqueta="Fecha de egreso" value={f.fecha_egreso} onChangeText={cambiar('fecha_egreso')} error={errores.fecha_egreso} placeholder="AAAA-MM-DD" maxLength={10} />
            ) : null}
          </>
        ) : null}
      </Tarjeta>

      <View style={{ flexDirection: 'row', gap: espacio.s, flexWrap: 'wrap' }}>
        {alCancelar ? <Boton titulo="Cancelar" variante="secundario" onPress={alCancelar} estilo={{ flex: 1 }} /> : null}
        <Boton titulo={edicion ? 'Guardar cambios' : 'Dar de alta'} icono={edicion ? 'save-outline' : 'person-add'} onPress={guardar}
          cargando={guardando} textoCargando="Guardando…" estilo={{ flex: 1 }} />
      </View>
    </View>
  );
}
