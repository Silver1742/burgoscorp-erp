// Escanear: se abre desde el ícono QR de la barra (o desde Inventario, Compras y Mantenimiento).
// Lleva a la tarea del operario en esa pieza, a la ficha de la máquina, al stock del producto
// o a la orden de compra.
import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Pantalla, EncabezadoPagina } from '../../../componentes/ui';
import Escaner, { destinoEscaneo } from '../../../componentes/Escaner';

export default function Escanear() {
  const router = useRouter();
  const alEncontrar = useCallback((r) => {
    const destino = destinoEscaneo(r);
    if (destino) router.push(destino, { withAnchor: true });
  }, [router]);

  return (
    <Pantalla>
      <EncabezadoPagina titulo="Escanear" icono="qr-code" sub="Piezas, máquinas, materiales y órdenes de compra." />
      <Escaner alEncontrar={alEncontrar} />
    </Pantalla>
  );
}
