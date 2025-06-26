import {readFileSync} from 'fs'
import {Logger} from '@nestjs/common'

const logger = new Logger('utils')

export const getSecretKey = (): string | null => {
  const secretFile = process.env.LEMURIA_SECRET_FILE
  if (secretFile) {
    try {
      return readFileSync(secretFile, 'utf8').trim()
    } catch (error) {
      logger.warn(`Failed to read secret file ${secretFile}: ${error.message}`)
    }
  }
  return null
}
