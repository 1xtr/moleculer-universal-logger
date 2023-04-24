/*
 * moleculer
 * Copyright (c) 2023 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

/**
 * @typedef {Object} UniversalLoggerOptions
 * @property {string} [url=""] UniversalLogger logs endpoint
 * @property {RequestInit} [fetchOptions={method: "POST", headers: {"Content-Type": "application/json"}}] Fetch options
 * @property {string} [hostname='hostname'] Hostname, default is machine hostname 'os.hostname()'
 * @property {Function} [objectPrinter=null] Callback function for object printer, default is 'JSON.stringify'
 * @property {number} [interval=10000] Date uploading interval in milliseconds, default is 10000
 * @property {string[]} [excludeModules=[]] Exclude modules from logs, 'broker', 'registry' etc.
 */

'use strict'

const _ = require('lodash')
const BaseLogger = require('moleculer').Loggers.Base
const { MoleculerError } = require('moleculer').Errors
const { hostname } = require('os')

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace']

const isObject = (o) => o !== null && typeof o === 'object' && !(o instanceof String)

function replacerFunc() {
  const visited = new WeakSet()
  return (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (visited.has(value)) {
        return
      }
      visited.add(value)
    }
    return value
  }
}

const [NODE_VERSION] = process.versions.node.split('.')
if (NODE_VERSION < 18) {
  require('isomorphic-fetch')
}

/**
 * UniversalLogger logger for Moleculer
 *
 * @constructor
 * @class UniversalLogger
 * @property {import('moleculer').ServiceBroker} broker - Moleculer broker
 * @extends {BaseLogger}
 */
class UniversalLogger extends BaseLogger {
  /**
   * Creates an instance of UniversalLogger.
   * @param {UniversalLoggerOptions} opts
   * @memberof UniversalLogger
   */
  constructor(opts = {}) {
    super(opts)

    /**
     * @type {UniversalLoggerOptions}
     */
    this.opts = _.defaultsDeep(this.opts, {
      url: process.env.UNIVERSAL_LOGGER_URL,
      fetchOptions: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      hostname: hostname(),
      objectPrinter: null,
      interval: 10 * 1000,
      excludeModules: [],
    })

    this.queue = []
    this.timer = null

    if (!this.opts.url)
      throw new MoleculerError(
        'URL is missing. Set url in options or UNIVERSAL_LOGGER_URL environment variable.'
      )
  }

  /**
   * Initialize logger.
   * @param {import('moleculer').LoggerFactory} loggerFactory
   */
  init(loggerFactory) {
    super.init(loggerFactory)

    this.objectPrinter = this.opts.objectPrinter
      ? this.opts.objectPrinter
      : (obj) => JSON.stringify(obj, replacerFunc())

    if (this.opts.interval > 0) {
      this.timer = setInterval(() => this.flush(), this.opts.interval)
      this.timer.unref()
    }
  }

  /**
   * Stopping logger
   * @return {Promise<void>|*}
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    return this.flush()
  }

  /**
   * Generate a new log handler.
   * @param {object} bindings
   */
  getLogHandler(bindings) {
    let level = bindings ? this.getLogLevel(bindings.mod) : null
    if (!level) return null

    const extra = new Map()

    const printArgs = (args) => {
      return args.map((p) => {
        if (isObject(p) || Array.isArray(p)) return this.objectPrinter(p)
        return p
      })
    }
    const levelIdx = LOG_LEVELS.indexOf(level)

    return (type, args) => {
      const typeIdx = LOG_LEVELS.indexOf(type)
      if (typeIdx > levelIdx) return

      // If broker in exclude array, allow only `error` and `fatal` from it
      if (
        this.opts.excludeModules.includes(bindings.mod) &&
        !(bindings.mod === 'broker' && typeIdx <= 1)
      ) {
        return
      }

      this.queue.push({
        ts: Date.now(),
        level: type,
        message: printArgs(args).join(' '),
        bindings,
      })
      extra.clear()
      if (!this.opts.interval) this.flush()
    }
  }

  /**
   * Flush queued log entries to UniversalLogger.
   */
  flush() {
    if (this.queue.length > 0) {
      const rows = Array.from(this.queue)
      this.queue.length = 0

      const data = rows.map((row) => {
        return {
          timestamp: row.ts,
          level: row.level,
          message: row.message,
          nodeID: row.bindings.nodeID,
          namespace: row.bindings.ns,
          service: row.bindings.svc,
          source: row.bindings.mod,
          hostname: this.opts.hostname,
          version: row.bindings.ver ?? '',
        }
      })

      return fetch(this.opts.url, {
        ...this.opts.fetchOptions,
        body: JSON.stringify(data),
      })
        .then((res) => {
          if (res.status !== 202) {
            console.info('Logs are uploaded to UniversalLogger without success.', res)
          }
        })
        .catch((err) => {
          console.warn(`Unable to upload logs to service. Error: ${err.message}`, err)
        })
    }

    return this.broker.Promise.resolve()
  }
}

module.exports = UniversalLogger
