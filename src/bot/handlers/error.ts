import type { ErrorHandler } from 'grammy'
import type { Context } from '#root/bot/grammy-context.js'
import { getUpdateInfo } from '#root/bot/helpers/logging.js'

export const errorHandler: ErrorHandler<Context> = (error) => {
  const { ctx } = error

  ctx.logger.error(
    'Request failed', {
    err: error,
    update: getUpdateInfo(ctx),
  })
}
