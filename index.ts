import { registerRootComponent } from 'expo';
import App from './App';
import { fitWebViewport } from './src/safe';

fitWebViewport();
registerRootComponent(App);
