declare module '*.png'
declare module '*.jpg'
declare module '*.scss'
declare module '*.css'

declare namespace NodeJS {
  interface ProcessEnv {
    TARO_APP_ID?: string
    TARO_APP_CLOUD_ENV_ID?: string
  }
}
