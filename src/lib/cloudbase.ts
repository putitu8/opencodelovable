import cloudbase from "@cloudbase/js-sdk";

const envId = import.meta.env.VITE_TCB_ENV_ID || "";

let app: ReturnType<typeof cloudbase.init> | null = null;

export function getCloudbase() {
  if (!app) {
    app = cloudbase.init({ env: envId });
  }
  return app;
}

export function getAuth() {
  return getCloudbase().auth();
}

export function getDb() {
  return getCloudbase().database();
}
