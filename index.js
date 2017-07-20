const {join} = require('path');
const {FtpServer} = require('ftpd');
const DevicesManager = require('./src/devicesManager');
const MergedFs = require('./src/mergedFs');

const options = {
  host: process.env.IP || '127.0.0.1',
  port: process.env.PORT || 7002,
  tls: null,
};

const workDir = process.argv[2];
const workPath = join(process.cwd(), workDir);
console.log(`Used devices path: ${workPath}`);

const devicesManager = new DevicesManager(workPath);
const mergedFs = new MergedFs(devicesManager);

const server = new FtpServer(options.host, {
  pasvPortRangeStart: 1025,
  pasvPortRangeEnd: 1050,
  tlsOptions: options.tls,
  allowUnauthorizedTls: true,
  useWriteFile: true,
  useReadFile: true,
  uploadMaxSlurpSize: 7000, // N/A unless 'useWriteFile' is true.
  getInitialCwd: () => '/',
  getRoot: () => workPath
});

server.on('error', (error) => {
  console.log('FTP Server error:', error);
});

server.on('client:connected', (connection) => {
  let username = null;

  console.log(`client connected: ${connection.remoteAddress}`);
  connection.on('command:user', (user, success, failure) => {
    if (user) {
      username = user;
      success();
    } else {
      failure();
    }
  });


  connection.on('command:pass', (pass, success, failure) => {
    if (pass) {
      success(username, mergedFs);
    } else {
      failure();
    }
  });
});

server.debugging = 4;
server.listen(options.port);

console.log(`Listening on port ${options.port}`);
