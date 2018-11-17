const {resolve} = require('path');
const {spawn} = require('child_process');

function jsonToStdoutString(json) {
  return `${JSON.stringify(json)}\n`;
}

function PhatDisplayWrapper() {
  const pythonDriverPath = resolve(__dirname, 'PhatDisplayDriver.py');

  console.log(`[PhatDisplayWrapper] spawn python driver: ${pythonDriverPath}`);

  this._pythonDriverProcess = spawn('python', [resolve(__dirname, 'PhatDisplayDriver.py')]);

  this._pythonDriverProcess.on('error', (err) => {
    throw `[PhatDisplayWrapper] python child process error: ${err}`;
  });

  this._pythonDriverProcess.on('close', (code) => {
    if (code !== 0) {
      throw `[PhatDisplayWrapper] python child process exits with non-zero code: ${code}`;
    }
  });

  this.writeString('*INIT*');

  return this;
}

PhatDisplayWrapper.prototype.writeString = function(str) {
  this._pythonDriverProcess.stdin.write(
    jsonToStdoutString({
      cmd: 'write_string',
      arg: str
    })
  );
};

PhatDisplayWrapper.prototype.clear = function() {
  this._pythonDriverProcess.stdin.write(
    jsonToStdoutString({
      cmd: 'clear'
    })
  );
};

PhatDisplayWrapper.prototype.destroy = function() {
  this.clear();
  this._pythonDriverProcess.kill();
};

module.exports = PhatDisplayWrapper;
