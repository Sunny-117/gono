# tsx

```js
#!/usr/bin/env node

const spawn = require('cross-spawn')

const spawnSync = spawn.sync

const register = require.resolve('esbuild-register')

const argv = process.argv.slice(2)

process.exit(spawnSync('node', ['-r', register, ...argv], { stdio: 'inherit' }).status)

// 这个版本的思路是使用 node 的 register 功能

// 而 esmo.mjs 使用了 esbuild-node-loader 来加载文件
```

[esbuild-register](https://chatgpt.com/c/69732ba7-235c-8322-9312-007959408a5a)
