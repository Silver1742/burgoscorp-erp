// Alta de un usuario por el administrador: sus datos, su rol y dónde trabaja (área, puesto y
// habilidades). El legajo se crea solo con el número siguiente. La cuenta queda habilitada y sin
// contraseña: la crea con el código que le mandamos por email.
import { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Pantalla, EncabezadoPagina, Tarjeta, Campo, Opciones, Casilla, Boton, Texto } from '../../../../componentes/ui';
import UbicacionLaboral, { UBICACION_VACIA, cuerpoUbicacion } from '../../../../componentes/UbicacionLaboral';
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
  const [datos, setDatos] = useState({ nombre: '', apellido: '', email: '', rol: 'EMPLEADO' });
  const [ubicacion, setUbicacion] = useState(UBICACION_VACIA);
  const [mandarCodigo, setMandarCodigo] = useState(true);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const cambiar = (campo) => (valor) => setDatos((d) => ({ ...d, [campo]: valor }));

  async function guardar() {
    const e = {};
    if (!esNombre(datos.nombre)) e.nombre = 'Ingresá el nombre (solo letras)';
    if (!esNombre(datos.apellido)) e.apellido = 'Ingresá el apellido (solo letras)';
    if (!esEmail(datos.email)) e.email = 'Ingresá un email válido';
    if (datos.rol !== 'ADMIN' && !ubicacion.area_id) e.area_id = 'Elegí el área donde va a trabajar';
    setErrores(e);
    if (Object.keys(e).length) return;

    setGuardando(true);
    try {
      const creado = await api('/usuarios', {
        metodo: 'POST',
        cuerpo: {
          nombre: datos.nombre.trim(), apellido: datos.apellido.trim(), email: datos.email.trim(), rol: datos.rol,
          ...(datos.rol !== 'ADMIN' && ubicacion.area_id ? cuerpoUbicacion(ubicacion) : {}),
        },
      });
      let mensaje = `${datos.nombre} ya tiene cuenta${creado.legajo ? ` y el legajo ${creado.legajo}` : ''}.`;
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
      toast.error(err.codigo === 'DUPLICADO' ? 'Ya hay una cuenta con ese email' : err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Pantalla anchoMax={640}>
      <EncabezadoPagina titulo="Nuevo usuario" icono="person-add" sub="Cargá sus datos y dónde trabaja: el legajo se crea solo." />
      <Tarjeta titulo="Persona" icono="person-outline">
        <Campo etiqueta="Nombre" value={datos.nombre} onChangeText={cambiar('nombre')} maxLength={60} error={errores.nombre} />
        <Campo etiqueta="Apellido" value={datos.apellido} onChangeText={cambiar('apellido')} maxLength={60} error={errores.apellido} />
        <Campo etiqueta="Email" value={datos.email} onChangeText={cambiar('email')} error={errores.email}
          keyboardType="email-address" autoCapitalize="none" maxLength={254} />
        <Text style={{ color: t.texto, fontSize: 15, fontWeight: '600', marginBottom: 6 }}>Rol</Text>
        <Opciones opciones={OPCIONES_ROL} valor={datos.rol} alCambiar={cambiar('rol')} />
      </Tarjeta>
      {datos.rol === 'ADMIN' ? (
        <Tarjeta>
          <Texto suave>El administrador del sistema no pertenece a un área ni lleva legajo: ve y administra todo.</Texto>
        </Tarjeta>
      ) : (
        <Tarjeta titulo="Dónde trabaja" icono="business-outline">
          <UbicacionLaboral valor={ubicacion} error={errores.area_id}
            alCambiar={(v) => { setUbicacion(v); setErrores((e) => ({ ...e, area_id: undefined })); }} />
        </Tarjeta>
      )}
      <Tarjeta>
        <Casilla marcada={mandarCodigo} alCambiar={setMandarCodigo} etiqueta="Mandarle un email con un código para que cree su contraseña" />
        <Texto suave estilo={{ fontSize: 13, marginVertical: espacio.m }}>
          El código vence a los 10 minutos. Si se le vence, mandale otro desde su ficha.
        </Texto>
        <Boton titulo="Crear usuario" icono="checkmark" onPress={guardar} cargando={guardando} textoCargando="Creando…" />
      </Tarjeta>
    </Pantalla>
  );
}
