// Activar / desactivar la verificación en dos pasos con una app autenticadora.
// Flujo: configurar → escanear el QR (o copiar la clave) → confirmar un código → guardar los códigos de respaldo.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Pantalla, EncabezadoPagina, Tarjeta, Campo, Boton, Insignia } from '../../../componentes/ui';
import ConfirmDialog from '../../../componentes/ConfirmDialog';
import { useSesion } from '../../../contexto/sesion';
import { useToast } from '../../../contexto/toast';
import { api } from '../../../lib/api';
import { esCodigo6 } from '../../../lib/validacion';
import { espacio, fuentes, useTema } from '../../../tema';

export default function ConfigurarDosPasos() {
  const { usuario, refrescarPerfil } = useSesion();
  const toast = useToast();
  const t = useTema();
  const [config, setConfig] = useState(null);          // { secreto, otpauthUri }
  const [respaldo, setRespaldo] = useState(null);      // códigos a mostrar una sola vez
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmarDesactivar, setConfirmarDesactivar] = useState(false);

  async function ejecutar(fn) {
    setError(null);
    setEnviando(true);
    try {
      await fn();
    } catch (err) {
      if (err.porCampo?.codigo) setError(err.porCampo.codigo);
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  }

  const iniciar = () => ejecutar(async () => {
    setConfig(await api('/auth/2fa/configurar', { metodo: 'POST' }));
  });

  const activar = () => {
    if (!esCodigo6(codigo)) { setError('El código tiene 6 dígitos'); return; }
    ejecutar(async () => {
      const r = await api('/auth/2fa/activar', { metodo: 'POST', cuerpo: { codigo: codigo.trim() } });
      setRespaldo(r.codigosRespaldo);
      setConfig(null);
      setCodigo('');
      toast.exito('Verificación en dos pasos activada.');
      await refrescarPerfil();
    });
  };

  const regenerar = () => {
    if (codigo.trim().length < 6) { setError('Ingresá un código de la app o uno de respaldo'); return; }
    ejecutar(async () => {
      const r = await api('/auth/2fa/codigos-respaldo', { metodo: 'POST', cuerpo: { codigo: codigo.trim() } });
      setRespaldo(r.codigosRespaldo);
      setCodigo('');
      toast.exito('Se generaron códigos de respaldo nuevos. Los anteriores dejaron de servir.');
    });
  };

  async function desactivar() {
    try {
      await api('/auth/2fa/desactivar', { metodo: 'POST', cuerpo: { codigo: codigo.trim() } });
      setCodigo('');
      toast.exito('La verificación en dos pasos quedó desactivada.');
      await refrescarPerfil();
    } catch (err) {
      if (err.porCampo?.codigo) setError(err.porCampo.codigo);
      toast.error(err.message);
      throw err;
    }
  }

  // Recién activada o regenerados: mostrar los códigos de respaldo una única vez.
  if (respaldo) {
    return (
      <Pantalla>
        <EncabezadoPagina titulo="Códigos de respaldo" icono="key"
          sub="Guardalos en un lugar seguro. Cada uno sirve una sola vez si perdés el celular y no los vas a poder ver de nuevo." />
        <Tarjeta acentoArriba>
          <View style={estilos.codigos}>
            {respaldo.map((c) => <Text key={c} selectable style={[estilos.codigo, { color: t.texto, borderColor: t.borde }]}>{c}</Text>)}
          </View>
        </Tarjeta>
        <Boton titulo="Ya los guardé" onPress={() => setRespaldo(null)} icono="checkmark-done-outline" />
      </Pantalla>
    );
  }

  if (usuario.dosPasosActivo) {
    return (
      <Pantalla>
        <EncabezadoPagina titulo="Verificación en dos pasos" icono="shield-checkmark"
          acciones={<Insignia texto="Activada" tono="exito" />}
          sub="Al iniciar sesión te pedimos un código de tu app autenticadora, uno por email o uno de respaldo." />
        <Tarjeta titulo="Confirmá que sos vos" icono="lock-closed-outline">
          <Campo etiqueta="Código de la app o de respaldo" value={codigo} onChangeText={setCodigo} error={error}
            autoCapitalize="characters" maxLength={9} ayuda="Lo necesitás para cambiar esta configuración." />
          <View style={estilos.botones}>
            <Boton titulo="Generar códigos nuevos" variante="secundario" icono="refresh" onPress={regenerar} cargando={enviando} chico />
            <Boton titulo="Desactivar" variante="contornoPeligro" icono="close-circle-outline" chico deshabilitado={enviando}
              onPress={() => { if (codigo.trim().length < 6) setError('Ingresá un código de la app o uno de respaldo'); else setConfirmarDesactivar(true); }} />
          </View>
        </Tarjeta>
        <ConfirmDialog
          visible={confirmarDesactivar}
          titulo="Desactivar verificación en dos pasos"
          mensaje="Tu cuenta va a quedar protegida solo con la contraseña. ¿Querés desactivarla?"
          textoConfirmar="Desactivar"
          alConfirmar={desactivar}
          alCerrar={() => setConfirmarDesactivar(false)}
        />
      </Pantalla>
    );
  }

  if (!config) {
    return (
      <Pantalla>
        <EncabezadoPagina titulo="Verificación en dos pasos" icono="shield-checkmark" acciones={<Insignia texto="Desactivada" />}
          sub="Además de tu contraseña, vas a necesitar un código de 6 dígitos que genera una app en tu celular (Google Authenticator, Microsoft Authenticator o Authy)." />
        <Boton titulo="Configurar" onPress={iniciar} cargando={enviando} textoCargando="Preparando…" icono="qr-code-outline" estilo={{ alignSelf: 'flex-start' }} />
      </Pantalla>
    );
  }

  return (
    <Pantalla>
      <EncabezadoPagina titulo="Escaneá el código" icono="qr-code" sub="1. Abrí tu app autenticadora y escaneá este código QR (o cargá la clave a mano)." />
      <Tarjeta>
        <View style={estilos.qr}>
          <QRCode value={config.otpauthUri} size={200} />
        </View>
        <Text style={{ color: t.textoSuave, textAlign: 'center' }}>Clave para cargar a mano</Text>
        <Text selectable style={[estilos.secreto, { color: t.texto }]}>{config.secreto.match(/.{1,4}/g).join(' ')}</Text>
      </Tarjeta>
      <Tarjeta titulo="2. Escribí el código que muestra la app" icono="keypad-outline">
        <Campo value={codigo} onChangeText={setCodigo} error={error} keyboardType="number-pad" maxLength={6}
          accessibilityLabel="Código de la app autenticadora" onSubmitEditing={activar} />
        <View style={estilos.botones}>
          <Boton titulo="Cancelar" variante="secundario" chico onPress={() => { setConfig(null); setCodigo(''); setError(null); }} />
          <Boton titulo="Activar" onPress={activar} cargando={enviando} textoCargando="Activando…" icono="shield-checkmark-outline" chico />
        </View>
      </Tarjeta>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  qr: { alignSelf: 'center', padding: espacio.l, borderRadius: 8, backgroundColor: '#ffffff', marginBottom: espacio.m },
  secreto: { textAlign: 'center', fontFamily: fuentes.mono, fontSize: 16, letterSpacing: 1, marginTop: espacio.xs },
  codigos: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: espacio.s },
  codigo: { width: '48%', fontFamily: fuentes.mono, fontSize: 17, paddingVertical: espacio.s, textAlign: 'center', borderWidth: 1, borderRadius: 6 },
  botones: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: espacio.s },
});
