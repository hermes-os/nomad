import env from '#start/env'
import { defineConfig } from '@adonisjs/transmit'
import { redis } from '@adonisjs/transmit/transports'

export default defineConfig({
  pingInterval: false,
  transport:
    env.get('NODE_ENV') === 'test'
      ? null
      : {
          driver: redis({
            host: env.get('REDIS_HOST'),
            port: env.get('REDIS_PORT'),
            keyPrefix: 'transmit:',
          }),
        },
})
