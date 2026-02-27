import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { setupI18n } from "./plugins/i18n";
import Antd from "ant-design-vue";
import "ant-design-vue/dist/reset.css";
import "./styles/global.css";

async function bootstrap() {
  const app = createApp(App);
  const i18n = setupI18n();

  app.use(router);
  app.use(i18n);
  app.use(Antd);

  app.mount("#app");
}

bootstrap();
