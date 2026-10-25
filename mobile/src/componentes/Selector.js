// Selector con búsqueda (como un <select> de Bootstrap, pero cómodo en el celular):
// muestra el valor elegido y, al tocarlo, abre una hoja con la lista que trae de la API.
//
//   <Selector etiqueta="Cliente" ruta="/clientes" valor={id} alCambiar={(id, item) => ...}
//             mapear={(c) => ({ titulo: c.razon_social, sub: c.cuit })} consulta={{ activo: 1 }} opcional />
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Cargando, ErrorCarga, Vacio } from './ui';
import { api } from '../lib/api';
import { espacio, radio, useTema } from '../tema';

export default function Selector({
  etiqueta, ruta, valor, textoValor, alCambiar, mapear, consulta, error, ayuda,
  opcional = false, deshabilitado = false, placeholder = 'Elegir…', estilo,
}) {
  const t = useTema();
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState('');
  const [items, setItems] = useState(null);
  const [errorCarga, setErrorCarga] = useState(null);
  const [elegido, setElegido] = useState(textoValor ?? null);
  const claveConsulta = JSON.stringify(consulta ?? {});

  useEffect(() => { setElegido(textoValor ?? null); }, [textoValor]);

  const cargar = useCallback(async (texto) => {
    setErrorCarga(null);
    try {
      const r = await api(ruta, { consulta: { ...JSON.parse(claveConsulta), limite: 50, q: texto || undefined } });
      setItems(r.data ?? r);
    } catch (err) {
      setErrorCarga(err.message);
    }
  }, [ruta, claveConsulta]);

  useEffect(() => {
    if (!abierto) return undefined;
    const espera = setTimeout(() => cargar(q.trim()), q ? 350 : 0);
    return () => clearTimeout(espera);
  }, [abierto, q, cargar]);

  function elegir(item) {
    const m = item ? mapear(item) : null;
    setElegido(m?.titulo ?? null);
    alCambiar(item ? item.id : null, item);
    setAbierto(false);
  }

  return (
    <View style={[{ marginBottom: espacio.l }, estilo]}>
      {etiqueta ? <Text style={[estilos.etiqueta, { color: t.texto }]}>{etiqueta}</Text> : null}
      <Pressable
        onPress={() => !deshabilitado && setAbierto(true)}
        accessibilityRole="button"
        accessibilityLabel={`${etiqueta}: ${elegido ?? placeholder}`}
        style={[estilos.caja, { backgroundColor: t.superficie, borderColor: error ? t.error : t.borde, opacity: deshabilitado ? 0.6 : 1 }]}
      >
        <Text style={{ flex: 1, color: elegido ? t.texto : t.textoTenue, fontSize: 16 }} numberOfLines={1}>{elegido ?? placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color={t.textoSuave} />
      </Pressable>
      {error
        ? <Text style={[estilos.ayuda, { color: t.error }]}>{error}</Text>
        : ayuda ? <Text style={[estilos.ayuda, { color: t.textoSuave }]}>{ayuda}</Text> : null}

      <Modal visible={abierto} animationType="slide" transparent onRequestClose={() => setAbierto(false)}>
        <View style={estilos.fondo}>
          <SafeAreaView edges={['bottom']} style={[estilos.hoja, { backgroundColor: t.superficie }]}>
            <View style={[estilos.cabecera, { borderBottomColor: t.borde }]}>
              <Text style={{ flex: 1, color: t.texto, fontSize: 17, fontWeight: '600' }}>{etiqueta}</Text>
              <Pressable onPress={() => setAbierto(false)} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={8}>
                <Ionicons name="close" size={24} color={t.textoSuave} />
              </Pressable>
            </View>
            <View style={[estilos.buscador, { borderColor: t.borde, backgroundColor: t.fondo }]}>
              <Ionicons name="search" size={18} color={t.textoTenue} />
              <TextInput value={q} onChangeText={setQ} placeholder="Buscar…" placeholderTextColor={t.textoTenue}
                autoFocus autoCapitalize="none" maxLength={100} accessibilityLabel={`Buscar ${etiqueta}`}
                style={{ flex: 1, color: t.texto, fontSize: 16, paddingVertical: 8, marginLeft: 6 }} />
            </View>
            {errorCarga ? <ErrorCarga error={errorCarga} onReintentar={() => cargar(q.trim())} /> : null}
            {!items && !errorCarga ? <Cargando /> : null}
            {items ? (
              <FlatList
                data={items}
                keyExtractor={(i) => String(i.id)}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={opcional ? (
                  <Pressable onPress={() => elegir(null)} style={[estilos.opcion, { borderBottomColor: t.borde }]}>
                    <Text style={{ color: t.textoSuave, fontStyle: 'italic' }}>Ninguno</Text>
                  </Pressable>
                ) : null}
                ListEmptyComponent={<Vacio titulo="Sin resultados" />}
                renderItem={({ item }) => {
                  const m = mapear(item);
                  const activo = item.id === valor;
                  return (
                    <Pressable onPress={() => elegir(item)} accessibilityRole="button" accessibilityState={{ selected: activo }}
                      style={({ pressed }) => [estilos.opcion, { borderBottomColor: t.borde }, (pressed || activo) && { backgroundColor: t.rojoSuave }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: t.texto, fontSize: 15, fontWeight: activo ? '600' : '400' }}>{m.titulo}</Text>
                        {m.sub ? <Text style={{ color: t.textoSuave, fontSize: 13 }}>{m.sub}</Text> : null}
                      </View>
                      {activo ? <Ionicons name="checkmark" size={20} color={t.primario} /> : null}
                    </Pressable>
                  );
                }}
              />
            ) : null}
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const estilos = StyleSheet.create({
  etiqueta: { fontSize: 15, marginBottom: 6 },
  caja: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radio.m, minHeight: 44, paddingHorizontal: espacio.m },
  ayuda: { fontSize: 13, marginTop: espacio.xs },
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  hoja: { maxHeight: '85%', minHeight: '55%', borderTopLeftRadius: 12, borderTopRightRadius: 12, width: '100%', maxWidth: 640, alignSelf: 'center' },
  cabecera: { flexDirection: 'row', alignItems: 'center', padding: espacio.l, borderBottomWidth: 1 },
  buscador: { flexDirection: 'row', alignItems: 'center', margin: espacio.m, paddingHorizontal: espacio.m, borderWidth: 1, borderRadius: radio.m },
  opcion: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: espacio.l, paddingVertical: 12, borderBottomWidth: 1 },
});
