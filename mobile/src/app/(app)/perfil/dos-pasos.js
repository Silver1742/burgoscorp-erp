// Activar / desactivar la verificación en dos pasos con una app autenticadora.
// Flujo: configurar → escanear el QR (o copiar la clave) → confirmar un código → guardar los códigos de respaldo.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Pantalla, Titulo, Campo, Boton, Aviso, Tarjeta, Texto } from '../../../componentes/ui';
import { useSesion } from '../../../contexto/sesion';
import { api } from '../../../lib/api';
import { esCodigo6 } from '../../../lib/validacion';
import { espacio, useTema } from '../../../tema';

export default function ConfigurarDosPasos() {
  const { usuario, refrescarPerfil } = useSesion();
  const t = useTema();
  const [config, setConfig] = useState(null);          // { secreto, otpauthUri }
  const [respaldo, setRespaldo] = useState(null);      // códigos a mostrar una sola vez
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function ejecutar(fn) {
    setError(null);
    setMensaje(null);
    setEnviando(true);
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  const iniciar = () => ejecutar(async () => {
    setConfig(await api('/auth/2fa/configurar', { metodo: 'POST' }));
  });

  const activar = () => ejecutar(async () => {
    if (!esCodigo6(codigo)) throw new Error('El código tiene 6 dígitos');
    const r = await api('/auth/2fa/activar', { metodo: 'POST', cuerpo: { codigo: codigo.trim() } });
    setRespaldo(r.codigosRespaldo);
    setConfig(null);
    setCodigo('');
    await refrescarPerfil();
  });

  const desactivar = () => ejecutar(async () => {
    if (codigo.trim().length < 6) throw new Error('Ingresá un código de la app o uno de respaldo');
    await api('/auth/2fa/desactivar', { metodo: 'POST', cuerpo: { codigo: codigo.trim() } });
    setCodigo('');
    setMensaje('La verificación en dos pasos quedó desactivada.');
    await refrescarPerfil();
  });

  const regenerar = () => ejecutar(async () => {
    if (codigo.trim().length < 6) throw new Error('Ingresá un código de la app o uno de respaldo');
    const r = await api('/auth/2fa/codigos-respaldo', { metodo: 'POST', cuerpo: { codigo: codigo.trim() } });
    setRespaldo(r.codigosRespaldo);
    setCodigo('');
  });

  // Recién activada: mostrar los códigos de respaldo una única vez.
  if (respaldo) {
    return (
      <Pantalla>
        <Titulo sub="Guardalos en un lugar seguro (anotados en papel o en un gestor de contraseñas). Cada uno sirve una sola vez si perdés el celular. No los vas a poder ver de nuevo.">
          Códigos de respaldo
        </Titulo>
        <Tarjeta>
          <View style={estilos.codigos}>
            {respaldo.map((c) => <Texto key={c} selectable estilo={estilos.codigo}>{c}</Texto>)}
          </View>
        </Tarjeta>
        <Boton titulo="Ya los guardé" onPress={() => setRespaldo(null)} icono="checkmark-done-outline" />
      </Pantalla>
    );
  }

  if (usuario.dosPasosActivo) {
    return (
      <Pantalla>
        <Titulo sub="Al iniciar sesión te pedimos un código de tu app autenticadora, uno por email o uno de respaldo.">
          Verificación activada
        </Titulo>
        <Aviso tipo="exito">{mensaje}</Aviso>
        <Aviso>{error}</Aviso>
        <Campo etiqueta="Código de la app o de respaldo" value={codigo} onChangeText={setCodigo}
          autoCapitalize="characters" maxLength={9} ayuda="Para cambiar esta configuración tenés que confirmar que sos vos." />
        <Boton titulo="Generar códigos de respaldo nuevos" variante="secundario" onPress={regenerar} cargando={enviando} />
        <Boton titulo="Desactivar verificación en dos pasos" variante="peligro" onPress={desactivar} deshabilitado={enviando} />
      </Pantalla>
    );
  }

  if (!config) {
    return (
      <Pantalla>
        <Titulo sub="Además de tu contraseña, vas a necesitar un código de 6 dígitos que genera una app en tu celular (Google Authenticator, Microsoft Authenticator o Authy).">
          Verificación en dos pasos
        </Titulo>
        <Aviso tipo="exito">{mensaje}</Aviso>
        <Aviso>{error}</Aviso>
        <Boton titulo="Configurar" onPress={iniciar} cargando={enviando} icono="qr-code-outline" />
      </Pantalla>
    );
  }

  return (
    <Pantalla>
      <Titulo sub="1. Abrí tu app autenticadora y escaneá este código QR (o cargá la clave a mano).">Escaneá el código</Titulo>
      <Aviso>{error}</Aviso>
      <View style={[estilos.qr, { backgroundColor: '#FFFFFF', borderColor: t.borde }]}>
        <QRCode value={config.otpauthUri} size={200} />
      </View>
      <Texto suave estilo={{ textAlign: 'center' }}>Clave para cargar a mano:</Texto>
      <Texto selectable estilo={estilos.secreto}>{config.secreto.match(/.{1,4}/g).join(' ')}</Texto>

      <Texto estilo={{ marginVertical: espacio.m }}>2. Escribí el código de 6 dígitos que muestra la app:</Texto>
      <Campo value={codigo} onChangeText={setCodigo} keyboardType="number-pad" maxLength={6}
        accessibilityLabel="Código de la app autenticadora" onSubmitEditing={activar} />
      <Boton titulo="Activar" onPress={activar} cargando={enviando} icono="shield-checkmark-outline" />
      <Boton titulo="Cancelar" variante="texto" onPress={() => { setConfig(null); setCodigo(''); }} />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  qr: { alignSelf: 'center', padding: espacio.l, borderRadius: 12, borderWidth: 1, marginBottom: espacio.m },
  secreto: { textAlign: 'center', fontFamily: 'monospace', fontSize: 16, letterSpacing: 1, marginTop: espacio.xs },
  codigos: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  codigo: { width: '48%', fontFamily: 'monospace', fontSize: 17, paddingVertical: espacio.s, textAlign: 'center' },
});
