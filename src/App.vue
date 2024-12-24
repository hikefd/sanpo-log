<script setup>
import { DateTime } from 'luxon';
import { ref, computed, watchEffect } from 'vue';
import 'vue3-openlayers/dist/vue3-openlayers.css';
import gpxUrl from './assets/tracksrc-5033895.gpx';
import { fromLonLat } from 'ol/proj';

import Sun from './components/sky.vue';

let gpx = new gpxParser();
// ロード
let gpxdata = ref([]);
fetch(gpxUrl).then((res) => res.text()).then((text) => {
  gpx.parse(text);
  gpxdata.value = gpx.tracks;
  tRange.value = [
    gpx.tracks[0].points[0].time.getTime(),
    gpx.tracks.at(-1).points.at(-1).time.getTime(),
  ];
  t.value = gpx.tracks[0].points[0].time.getTime();
}).catch(e => {
  console.log(e);
});
const zoom = ref(13.3);
const center = ref(fromLonLat([139.1, 35.3]));
const rotation = ref(310 * Math.PI / 180);
const projection = ref('EPSG:3857');
const followCenter = ref(false);
const t = ref(Date.now());
const datetime = computed(() => {
  return DateTime.fromMillis(t.value);
});
const lon = ref(139.1);
const lat = ref(35.3);

const tRange = ref([Date.now(), Date.now()]);
const tView = computed(() => {
  return datetime.value.toFormat('yyyy/LL/dd HH:mm:ss');
});
const points = computed(() => {
  if (!gpxdata.value) {
    return [];
  }
  let arr = [];
  gpxdata.value.forEach(g => {
    arr = arr.concat(g.points);
  });
  return arr;
});

const lonlats = computed(() => {
  if (!points.value?.length) {
    return null;
  }
  return points.value.map((p) => [p.lon, p.lat]);
});
// 現在位置
const currentPos = computed(() => {
  if (!points.value.length) {
    return null;
  }
  let i = 1;
  for (i = 1; i < points.value.length; i++) {
    if (points.value[i].time.getTime() > t.value) {
      break;
    }
  }
  return points.value[i - 1];
});
const currentLonlat = computed(() => {
  if (!currentPos.value) {
    return null;
  }
  return fromLonLat([currentPos.value.lon, currentPos.value.lat]);
});
watchEffect(() => {
  if (followCenter.value) {
    center.value = currentLonlat.value;
  }
});

const Deg2Rad = Math.PI / 180.0;
const Rad2Deg = 180.0 / Math.PI;
function correctAngle(angleInRadians) {
  if (angleInRadians < 0) {
    return 2 * Math.PI - (Math.abs(angleInRadians) % (2 * Math.PI));
  }
  else if (angleInRadians > 2 * Math.PI) {
    return angleInRadians % (2 * Math.PI);
  }
  else {
    return angleInRadians;
  }
}

const sunPos = computed(() => {
  // Convert to UTC  
  //dateTime = dateTime.ToUniversalTime();
  const d = DateTime.fromMillis(t.value);
  // Number of days from J2000.0.  
  let julianDate = 367 * d.year -
    Math.floor((7.0 / 4.0) * (d.year +
      Math.floor((d.month + 9.0) / 12.0))) +
    Math.floor((275.0 * d.month) / 9.0) +
    d.day - 730531.5;
  let julianCenturies = julianDate / 36525.0;

  // Sidereal Time  
  const siderealTimeHours = 6.6974 + 2400.0513 * julianCenturies;
  const totalHours = (d.hour + d.minute / 60 + d.second / 3600 + d.millisecond / 3600000);
  const siderealTimeUT = siderealTimeHours + (366.2422 / 365.2422) * totalHours; // dateTime.TimeOfDay.TotalHours;

  const siderealTime = siderealTimeUT * 15 + lon.value;

  // Refine to number of days (fractional) to specific time.  
  julianDate += totalHours / 24.0;
  julianCenturies = julianDate / 36525.0;

  // Solar Coordinates  
  const meanLongitude = correctAngle(Deg2Rad *
    (280.466 + 36000.77 * julianCenturies));

  const meanAnomaly = correctAngle(Deg2Rad *
    (357.529 + 35999.05 * julianCenturies));

  const equationOfCenter = Deg2Rad * ((1.915 - 0.005 * julianCenturies) *
    Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly));

  const elipticalLongitude = correctAngle(meanLongitude + equationOfCenter);

  const obliquity = (23.439 - 0.013 * julianCenturies) * Deg2Rad;

  // Right Ascension  
  const rightAscension = Math.atan2(
    Math.cos(obliquity) * Math.sin(elipticalLongitude),
    Math.cos(elipticalLongitude));

  const declination = Math.asin(
    Math.sin(rightAscension) * Math.sin(obliquity));

  // Horizontal Coordinates  
  let hourAngle = correctAngle(siderealTime * Deg2Rad) - rightAscension;

  if (hourAngle > Math.PI) {
    hourAngle -= 2 * Math.PI;
  }

  const altitude = Math.asin(Math.sin(lat.value * Deg2Rad) *
    Math.sin(declination) + Math.cos(lat.value * Deg2Rad) *
    Math.cos(declination) * Math.cos(hourAngle));

  // Nominator and denominator for calculating Azimuth  
  // angle. Needed to test which quadrant the angle is in.  
  const aziNom = -Math.sin(hourAngle);
  const aziDenom = Math.tan(declination) * Math.cos(lat.value * Deg2Rad) - Math.sin(lat.value * Deg2Rad) * Math.cos(hourAngle);
  let azimuth = Math.atan(aziNom / aziDenom);

  if (aziDenom < 0) { // In 2nd or 3rd quadrant  
    azimuth += Math.PI;
  } else if (aziNom < 0) {// In 4th quadrant  
    azimuth += 2 * Math.PI;
  }

  return {
    altitude,
    azimuth,
    hourAngle,
    totalHours,
  };
});


</script>

<template>
  <nav>東海道ログ</nav>

  <div style="position:absolute; top:0; bottom:0; left: 0; width: 400px;">
    <ol-map :loadTilesWhileAnimating="true" :loadTilesWhileInteracting="true" style="height:100%; width: 100%;">
      <ol-view ref="view" v-model:center="center" :rotation="rotation" v-model:zoom="zoom" :projection="projection" />
      <ol-tile-layer>
        <!-- <ol-source-xyz url="https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png" /> -->
        <ol-source-xyz url="https://rekichizu.jp/map/{z}/{x}/{y}.png" />
      </ol-tile-layer>
      <ol-vector-layer>
        <ol-source-vector>
          <ol-feature v-if="lonlats">
            <ol-geom-line-string :coordinates="lonlats"></ol-geom-line-string>
            <ol-style>
              <ol-style-stroke color="red" :width="6"></ol-style-stroke>
            </ol-style>
          </ol-feature>
          <ol-feature v-if="currentLonlat">
            <ol-geom-point :coordinates="currentLonlat"></ol-geom-point>
            <ol-style>
              <ol-style-circle :radius="10">
                <ol-style-fill color="red"></ol-style-fill>
                <ol-style-stroke color="black"></ol-style-stroke>
              </ol-style-circle>
            </ol-style>
          </ol-feature>
        </ol-source-vector>

      </ol-vector-layer>
    </ol-map>
  </div>
  <main style="margin-left: 400px;">
    <input type="number" v-model="t" step="300000" max="1672217778000">
    <input type="range" style="width: 800px;" :min="tRange[0]" :max="tRange[1]" v-model.number="t" step="100000">
    
    <input type="checkbox" v-model="followCenter">
    <div style="width: 900px; height: 400px;">
      <Sun :lon="currentPos?.lon" :lat="currentPos?.lat" :alt="currentPos?.ele" :datetime="datetime"></Sun>
    </div>
    <div>
      仰角: {{ sunPos.altitude * Rad2Deg }}度
      方位: {{ sunPos.azimuth * Rad2Deg }} 度
    </div>
    <div> {{ sunPos }}</div>{{ currentLonlat }}
    {{ currentPos }}
    <section>
      <h6></h6>
      <p></p>
    </section>
  </main>

</template>

<style scoped>
:root {
  font-family: 'Iosevka Custom', '更紗等幅ゴシック J', Consolas, 'Courier New', monospace;
}

</style>
