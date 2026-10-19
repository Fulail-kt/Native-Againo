import * as Location from 'expo-location';
import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { LocateFixed, MapPin } from '../icons';
import { colors } from '../theme';
import { pop } from '../pop';

type Props = {
  lat: number | null;
  lng: number | null;
  radiusMeters: number;
  onChange: (lat: number, lng: number) => void;
  tall?: boolean;
};

function mapHtml(lat: number | null, lng: number | null, radiusMeters: number) {
  const startLat = lat ?? 12.9716;
  const startLng = lng ?? 77.5946;
  const hasPin = lat != null && lng != null;
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html,body,#map{margin:0;padding:0;height:100%;background:#dce3ed;}
    .leaflet-control-attribution{background:rgba(255,255,255,.85)!important;color:#5b6475;font-size:10px;}
    .leaflet-control-zoom a{background:#fff;color:#1a1f2a;border-color:#c9d2e0;}
    .pin{width:28px;height:40px;}
    .pin i{
      display:block;width:22px;height:22px;margin:0 auto;
      background:#4f8cff;border:3px solid #fff;
      border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      box-shadow:0 3px 10px rgba(20,40,80,.35);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true, preferCanvas: true, attributionControl: true })
      .setView([${startLat}, ${startLng}], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    var icon = L.divIcon({
      className: '',
      html: '<div class="pin"><i></i></div>',
      iconSize: [28, 40],
      iconAnchor: [14, 38]
    });
    var marker = null;
    var circle = null;
    var radius = ${radiusMeters};
    var dragging = false;
    function post(obj) {
      var payload = JSON.stringify(obj);
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(payload);
      else if (window.parent) window.parent.postMessage(payload, '*');
    }
    function clearPin() {
      if (marker) { map.removeLayer(marker); marker = null; }
      if (circle) { map.removeLayer(circle); circle = null; }
    }
    function update(lat, lng, r) {
      if (r != null) radius = r;
      if (lat == null || lng == null || lat !== lat) { clearPin(); return; }
      if (marker) map.removeLayer(marker);
      if (circle) map.removeLayer(circle);
      marker = L.marker([lat, lng], { draggable: true, icon: icon }).addTo(map);
      circle = L.circle([lat, lng], {
        radius: radius, color: '#4f8cff', fillColor: '#4f8cff', fillOpacity: 0.16, weight: 2
      }).addTo(map);
      marker.on('dragstart', function() { dragging = true; });
      marker.on('dragend', function(e) {
        var p = e.target.getLatLng();
        post({ lat: p.lat, lng: p.lng });
      });
    }
    window.__sync = function(lat, lng, r) {
      update(lat, lng, r);
      if (lat != null && lng != null && lat === lat) map.panTo([lat, lng], { animate: true });
    };
    window.addEventListener('message', function(e) {
      var d = e.data;
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch(err) { return; } }
      if (d && d.type === 'sync') window.__sync(d.lat, d.lng, d.radius);
    });
    map.on('click', function(e) {
      if (dragging) { dragging = false; return; }
      update(e.latlng.lat, e.latlng.lng);
      post({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    map.whenReady(function() { post({ type: 'ready' }); });
    ${hasPin ? `update(${lat}, ${lng});` : ''}
  </script>
</body>
</html>`;
}

function openInMaps(lat: number, lng: number) {
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?ll=${lat},${lng}&q=Gym`
      : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  Linking.openURL(url).catch((e) => pop.err('Could not open Maps', e));
}

export function LocationMapPicker({ lat, lng, radiusMeters, onChange, tall }: Props) {
  const hasPin = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng);
  const boot = useRef({ lat, lng, radiusMeters });
  const html = useMemo(
    () => mapHtml(boot.current.lat, boot.current.lng, boot.current.radiusMeters),
    [],
  );
  const webRef = useRef<WebView>(null);
  const iframeRef = useRef<{ contentWindow: Window | null } | null>(null);
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);

  function onMapMsg(raw: unknown) {
    try {
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (data?.type === 'ready') {
        setReady(true);
        return;
      }
      if (data?.type === 'sync') return;
      if (typeof data?.lat === 'number' && typeof data?.lng === 'number') onChange(data.lat, data.lng);
    } catch {
      /* ignore */
    }
  }

  function pushSync() {
    const payload = JSON.stringify({ type: 'sync', lat, lng, radius: radiusMeters });
    webRef.current?.injectJavaScript(
      `window.__sync && window.__sync(${lat == null ? 'null' : lat}, ${lng == null ? 'null' : lng}, ${radiusMeters}); true;`,
    );
    iframeRef.current?.contentWindow?.postMessage(payload, '*');
  }

  useEffect(() => {
    pushSync();
  }, [lat, lng, radiusMeters]);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 4000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    function onMsg(e: MessageEvent) {
      onMapMsg(e.data);
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [onChange]);

  async function useCurrentLocation() {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        pop.info('Location needed', 'Allow location to drop the pin where you stand.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      onChange(pos.coords.latitude, pos.coords.longitude);
    } catch (e) {
      pop.err('Location failed', e);
    } finally {
      setLocating(false);
    }
  }

  return (
    <View className="mb-md">
      <Text className="mb-sm text-[13px] leading-[18px] text-muted">
        Tap map for gym pin · drag to adjust · blue circle = check-in zone
      </Text>

      <View
        className={`relative overflow-hidden rounded-lg border border-border bg-[#dce3ed] ${tall ? 'h-[380px]' : 'h-[300px]'}`}
      >
        {Platform.OS === 'web'
          ? createElement('iframe', {
              title: 'Gym map',
              srcDoc: html,
              ref: (el: unknown) => {
                iframeRef.current = el as { contentWindow: Window | null } | null;
              },
              onLoad: pushSync,
              style: { width: '100%', height: '100%', borderWidth: 0 },
            })
          : (
          <WebView
            ref={webRef}
            originWhitelist={['*']}
            source={{ html }}
            style={{ flex: 1, backgroundColor: '#dce3ed' }}
            javaScriptEnabled
            domStorageEnabled
            scrollEnabled={false}
            overScrollMode="never"
            onLoadEnd={pushSync}
            onMessage={(e) => onMapMsg(e.nativeEvent.data)}
          />
        )}

        {!ready ? (
          <View className="absolute inset-0 items-center justify-center gap-sm bg-[#dce3ed]" pointerEvents="none">
            <ActivityIndicator color={colors.primary} />
            <Text className="text-[13px] text-[#5b6475]">Loading map…</Text>
          </View>
        ) : null}

        <View className="absolute left-[10px] right-[10px] top-[10px] items-end" pointerEvents="box-none">
          <Pressable
            className={`h-9 flex-row items-center gap-[7px] rounded-pill bg-primary px-md ${locating ? 'opacity-[0.85]' : ''}`}
            style={{
              shadowColor: '#000',
              shadowOpacity: 0.22,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
              elevation: 4,
            }}
            onPress={useCurrentLocation}
            disabled={locating}
            hitSlop={8}
            accessibilityLabel="Drop pin at my current location"
          >
            {locating ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <LocateFixed size={15} color="#fff" strokeWidth={2.5} />
            )}
            <Text className="text-[12px] font-bold text-white">{locating ? 'Locating…' : 'Use my location'}</Text>
          </Pressable>
        </View>

        <View className="absolute bottom-[10px] left-[10px] right-[10px]" pointerEvents="box-none">
          <View className="flex-row items-center gap-1.5 rounded-pill bg-bg/88 px-md py-sm" pointerEvents="none">
            <MapPin size={14} color={hasPin ? colors.primary : colors.warning} />
            <Text className="flex-1 text-[12px] font-semibold text-ink" numberOfLines={1}>
              {hasPin
                ? `${lat.toFixed(5)}, ${lng.toFixed(5)}  ·  ${radiusMeters} m`
                : 'No pin yet — tap the map'}
            </Text>
          </View>
        </View>
      </View>

      <View className="mb-sm mt-1.5 flex-row items-center justify-between">
        <Text className="text-[10px] text-muted">© OpenStreetMap</Text>
        {hasPin ? (
          <Pressable onPress={() => openInMaps(lat, lng)} hitSlop={8}>
            <Text className="text-[12px] font-semibold text-primary">Preview in Maps</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
