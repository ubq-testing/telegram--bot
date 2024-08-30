import { performance } from 'node:perf_hooks'
import type { Middleware } from 'grammy'
import type { Context } from '#root/bot/context.js'
import { getUpdateInfo } from '#root/bot/helpers/logging.js'

export function updateLogger(): Middleware<Context> {
  return async (ctx, next) => {
    ctx.api.config.use((previous, method, payload, signal) => {
      ctx.logger.debug("Bot API call", {
        method,
        payload,
      })

      return previous(method, payload, signal)
    })

    ctx.logger.debug("Update received", {
      update: getUpdateInfo(ctx),
    })

    const startTime = performance.now()
    try {
      await next()
    }
    finally {
      const endTime = performance.now()
      ctx.logger.debug("Update processed", {
        elapsed: endTime - startTime,
      })
    }
  }
}
