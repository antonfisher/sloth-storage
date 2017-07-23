const {execSync} = require('child_process');

function exec(command) {
  return execSync(command, {shell: '/bin/bash'});
}

module.exports = {
  exec
};
