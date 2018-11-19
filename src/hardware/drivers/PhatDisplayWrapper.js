const {resolve} = require('path');
const {spawn} = require('child_process');

const pythonDriverPath = resolve(__dirname, 'PhatDisplayDriver.py');

function jsonToStdoutString(json) {
  return `${JSON.stringify(json)}\n`;
}

class PhatDisplayWrapper {
  constructor() {
    this._pythonDriverProcess = spawn('python', [pythonDriverPath]);
    this._pythonDriverProcess.on('error', (err) => {
      throw `[PhatDisplayWrapper] python child process error: ${err}`;
    });
    this._pythonDriverProcess.on('close', (code) => {
      if (code !== 0) {
        throw `[PhatDisplayWrapper] python child process exits with non-zero code: ${code}`;
      }
    });

    this.setup();
  }

  setup() {
    this.writeString('------');
  }

  writeString(str) {
    this._pythonDriverProcess.stdin.write(
      jsonToStdoutString({
        cmd: 'write_string',
        arg: str
      })
    );
  }

  clear() {
    this._pythonDriverProcess.stdin.write(
      jsonToStdoutString({
        cmd: 'clear'
      })
    );
  }

  destroy() {
    this.clear();
    this._pythonDriverProcess.kill();
  }
}

module.exports = PhatDisplayWrapper;
