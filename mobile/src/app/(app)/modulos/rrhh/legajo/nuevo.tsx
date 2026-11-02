// Nuevo legajo (RRHH): alta de una persona en el personal. El número de legajo lo asigna la API;
// la cuenta para entrar a la app es aparte (la crea el administrador o la pide la persona).
import { useRouter } from 'expo-router';
import { Pantalla, EncabezadoPagina } from '../../../../../componentes/ui';
import FormLegajo from '../../../../../componentes/FormLegajo';
import { useToast } from '../../../../../contexto/toast';
import { api } from '../../../../../lib/api';

export default function NuevoLegajo() {
  const router = useRouter();
  const toast = useToast();

  async function crear(cuerpo) {
    const e = await api('/empleados', { metodo: 'POST', cuerpo });
    toast.exito(`Legajo ${e.legajo} dado de alta.`);
    router.replace(`/modulos/rrhh/legajo/${e.id}`);
  }

  return (
    <Pantalla>
      <EncabezadoPagina titulo="Nuevo legajo" icono="person-add" sub="El número de legajo se asigna solo." />
      <FormLegajo alGuardar={crear} alCancelar={() => router.back()} />
    </Pantalla>
  );
}
