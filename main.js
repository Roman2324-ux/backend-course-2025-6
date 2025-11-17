const { program } = require('commander');

program
  .requiredOption('-h, --host <address>', 'Server address')
  .requiredOption('-p, --port <number>', 'Server port')
  .requiredOption('-c, --cache <path>', 'Path to cache directory');

program.parse(process.argv);

const options = program.opts();

console.log('Configuration loaded:');
console.log(`Host: ${options.host}`);
console.log(`Port: ${options.port}`);
console.log(`Cache: ${options.cache}`);