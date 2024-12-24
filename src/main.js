import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

import OpenLayersMap from 'vue3-openlayers';

let app = createApp(App);
app.use(OpenLayersMap);
app.mount('#app');

