![Moleculer logo](http://moleculer.services/images/banner.png)

[![NPM version](https://img.shields.io/npm/v/@1xtr/moleculer-universal-logger.svg)](https://www.npmjs.com/package/@1xtr/moleculer-universal-logger) ![NPM Downloads](https://img.shields.io/npm/dw/@1xtr/moleculer-universal-logger)

## Send Moleculer logs to any endpoint (DataDog, LogTail, Newrelic, etc)

### Description

You can send Moleculer logs to any endpoint

Log format:

```json5
{
    timestamp: 1682190435415, // Date.now()
    level: "info", // "fatal", "error", "warn", "info", "debug", "trace"
    message: "{}", // JSON.stringify of log args
    nodeID: "mol-repl_6428", // Unique node identifier
    namespace: "local", // Namespace of nodes to segment your nodes on the same network
    service: "repl", // service name
    source: "v1.repl", // broker, registry, discovery, transporter, cacher
    hostname: "linux",
    version: 1, // service version
}
```

### Install

```bash
$ npm install @1xtr/moleculer-universal-logger
```

### Import

```js
// ES5 example
const UniversalLogger = require('@1xtr/moleculer-universal-logger')

// ES6+ example
import { UniversalLogger } from '@1xtr/moleculer-universal-logger'
```

### Usage

```js
module.exports = {
  logger: new UniversalLogger({
    // put here your options
    url: 'https://log-api.eu.newrelic.com/log/v1?Api-Key=your_key' // newrelic EU
  }),
}
```

### Default options

```js
const defaultOptions = {
  url: process.env.UNIVERSAL_LOGGER_URL,
  fetchOptions: {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  },
  hostname: hostname(),
  objectPrinter: null,
  interval: 10 * 1000,
  excludeModules: [], // broker, registry, discovery, transporter, cacher
}
```
