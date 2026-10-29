// Alta de un usuario por el administrador. La cuenta queda habilitada y sin contraseña: entra con
// Google/GitHub/Facebook con ese email, o crea su contraseña con el código que le mandamos por email.
import { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Pantalla, EncabezadoPagina, Tarjeta, Campo, Opciones, Casilla, Boton, Texto } from '../../../../componentes/ui';
import Selector from '../../../../componentes/Selector';
import { useToast } from '../../../../contexto/toast';
import { api } from '../../../../lib/api';
import { esEmail, esNombre } from '../../../../lib/validacion';
import { ROLES } from '../../../../modulos';
import { espacio, useTema } from '../../../../tema';

const OPCIONES_ROL = ['EMPLEADO', 'JEFE', 'GERENCIA', 'ADMIN'].map((valor) => ({ valor, titulo: ROLES[valor] }));

export default function NuevoUsuario() {
  const router = useRouter();
  const toast = useToast();
  const t = useTema();
  const [datos, setDatos] = useState({ nombre: '', apellido: '', email: '', rol: 'EMPLEADO', empleado_id: null, legajo: null });
  const [mandarCodigo, setMandarCodigo] = useState(true);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const cambiar = (campo) => (valor) => setDatos((d) => ({ ...d, [campo]: valor }));

  /** Al elegir el legajo se completan nombre, apellido y email laboral si todavía están vacíos. */
  function elegirLegajo(id, e) {
    setDatos((d) => ({
      ...d,
      empleado_id: id,
      legajo: e ? `${e.legajo} · ${e.apellido}, ${e.nombre}` : null,
      nombre: d.nombre || e?.nombre || '',
      apellido: d.apellido || e?.apellido || '',
      email: d.email || e?.email_laboral || '',
    }));
  }

  async function guardar() {
    const e = {};
    if (!esNombre(datos.nombre)) e.nombre = 'Ingresá el nombre (solo letras)';
    if (!esNombre(datos.apellido)) e.apellido = 'Ingresá el apellido (solo letras)';
    if (!esEmail(datos.email)) e.email = 'Ingresá un email válido';
    setErrores(e);
    if (Object.keys(e).length) return;

    setGuardando(true);
    try {
      const creado = await api('/usuarios', {
        metodo: 'POST',
        cuerpo: {
          nombre: datos.nombre.trim(), apellido: datos.apellido.trim(), email: datos.email.trim(),
          rol: datos.rol, empleado_id: datos.empleado_id ?? undefined,
        },
      });
      let mensaje = `${datos.nombre} ya tiene cuenta.`;
      if (mandarCodigo) {
        try {
          await api(`/usuarios/${creado.id}/restablecer-password`, { metodo: 'POST' });
          mensaje += ' Le mandamos un email para que cree su contraseña.';
        } catch {
          mensaje += ' No se pudo mandar el email: probá de nuevo desde su ficha.';
        }
      }
      toast.exito(mensaje, { duracion: 6000 });
      router.replace(`/modulos/usuarios/${creado.id}`);
    } catch (err) {
      setErrores(err.porCampo ?? {});
      toast.error(err.codigo === 'DUPLICADO' ? 'Ya hay una cuenta con ese email o ese legajo' : err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Pantalla anchoMax={640}>
      <EncabezadoPagina titulo="Nuevo usuario" icono="person-add" sub="La cuenta queda habilitada. Si elegís el legajo, completamos sus datos." />
      <Tarjeta>
        <Selector etiqueta="Legajo del empleado" ruta="/empleados" consulta={{ estado: 'activo' }} valor={datos.empleado_id}
          textoValor={datos.legajo} opcional placeholder="Sin legajo (no ve módulos)"
          ayuda="Elegilo primero: se completan el nombre y el email laboral."
          alCambiar={elegirLegajo}
          mapear={(e) => ({ titulo: `${e.apellido}, ${e.nombre}`, sub: `${e.legajo} · ${e.area_nombre}${e.usuario_id ? ' · ya tiene cuenta' : ''}` })} />
        <Campo etiqueta="Nombre" value={datos.nombre} onChangeText={cambiar('nombre')} maxLength={60} error={errores.nombre} />
        <Campo etiqueta="Apellido" value={datos.apellido} onChangeText={cambiar('apellido')} maxLength={60} error={errores.apellido} />
        <Campo etiqueta="Email" value={datos.email} onChangeText={cambiar('email')} error={errores.email}
          keyboardType="email-address" autoCapitalize="none" maxLength={254} />
        <Text style={{ color: t.texto, fontSize: 15, marginBottom: 6 }}>Rol</Text>
        <Opciones opciones={OPCIONES_ROL} valor={datos.rol} alCambiar={cambiar('rol')} />
        <Casilla marcada={mandarCodigo} alCambiar={setMandarCodigo} etiqueta="Mandarle un email con un código para que cree su contraseña" />
        <Texto suave estilo={{ fontSize: 13, marginVertical: espacio.m }}>
          El código vence a los 10 minutos. Si se le vence, mandale otro desde su ficha.
        </Texto>
        <Boton titulo="Crear usuario" icono="checkmark" onPress={guardar} cargando={guardando} textoCargando="Creando…" />
      </Tarjeta>
    </Pantalla>
  );
}
