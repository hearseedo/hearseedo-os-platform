import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_FIREBASE_API_KEY':            JSON.stringify(env.VITE_FIREBASE_API_KEY),
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN':        JSON.stringify(env.VITE_FIREBASE_AUTH_DOMAIN),
      'import.meta.env.VITE_FIREBASE_PROJECT_ID':         JSON.stringify(env.VITE_FIREBASE_PROJECT_ID),
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET':     JSON.stringify(env.VITE_FIREBASE_STORAGE_BUCKET),
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID':JSON.stringify(env.VITE_FIREBASE_MESSAGING_SENDER_ID),
      'import.meta.env.VITE_FIREBASE_APP_ID':             JSON.stringify(env.VITE_FIREBASE_APP_ID),
      'import.meta.env.VITE_ADMIN_EMAIL':                 JSON.stringify(env.VITE_ADMIN_EMAIL),
      'import.meta.env.VITE_LANDING_PAGE_URL':            JSON.stringify(env.VITE_LANDING_PAGE_URL),
      'import.meta.env.VITE_APP_URL_PHONICS':             JSON.stringify(env.VITE_APP_URL_PHONICS),
      'import.meta.env.VITE_APP_URL_EIKEN':               JSON.stringify(env.VITE_APP_URL_EIKEN),
      'import.meta.env.VITE_APP_URL_SPEAK':               JSON.stringify(env.VITE_APP_URL_SPEAK),
      'import.meta.env.VITE_APP_URL_WONDERCAMP':          JSON.stringify(env.VITE_APP_URL_WONDERCAMP),
      'import.meta.env.VITE_APP_URL_FAMILY':              JSON.stringify(env.VITE_APP_URL_FAMILY),
      'import.meta.env.VITE_APP_URL_SIPSWITCH':           JSON.stringify(env.VITE_APP_URL_SIPSWITCH),
      'import.meta.env.VITE_APP_URL_INNERKEY':            JSON.stringify(env.VITE_APP_URL_INNERKEY),
      'import.meta.env.VITE_ELEVENLABS_API_KEY':          JSON.stringify(env.VITE_ELEVENLABS_API_KEY),
      'import.meta.env.VITE_ELEVENLABS_VOICE_ID':         JSON.stringify(env.VITE_ELEVENLABS_VOICE_ID),
    },
  }
})
