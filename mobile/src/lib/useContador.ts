// Número que "cuenta" hasta su valor (useCountUp de R3): ease-out de ~700 ms.
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export default function useContador(valor, duracion = 700) {
  const [mostrado, setMostrado] = useState(valor == null ? null : 0);
  const anterior = useRef(0);

  useEffect(() => {
    if (valor == null) return undefined;
    let frame;
    let cancelado = false;
    const desde = anterior.current;
    AccessibilityInfo.isReduceMotionEnabled().then((reducir) => {
      if (cancelado) return;
      if (reducir || desde === valor) {
        setMostrado(valor);
        anterior.current = valor;
        return;
      }
      const inicio = Date.now();
      const paso = () => {
        const p = Math.min(1, (Date.now() - inicio) / duracion);
        const suavizado = 1 - (1 - p) ** 3;
        setMostrado(Math.round(desde + (valor - desde) * suavizado));
        if (p < 1) frame = requestAnimationFrame(paso);
        else anterior.current = valor;
      };
      frame = requestAnimationFrame(paso);
    });
    return () => { cancelado = true; cancelAnimationFrame(frame); };
  }, [valor, duracion]);

  return mostrado;
}
