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
        arg1: str
      })
    );
  }

  setPixel(x, y, v) {
    this._pythonDriverProcess.stdin.write(
      jsonToStdoutString({
        cmd: 'set_pixel',
        arg1: Number(x),
        arg2: Number(y),
        arg3: Boolean(v)
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
    setTimeout(() => this._pythonDriverProcess.kill(), 100);
  }
}

module.exports = PhatDisplayWrapper;
