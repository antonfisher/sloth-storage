const {join} = require('path');
const {FtpServer} = require('ftpd');

const {version, description, homepage} = require('../package.json');
const DevicesManager = require('./application/devicesManager');
const MergedFs = require('./application/mergedFs');
const parseCliArgs = require('./application/parseCliArgs');

//TODO add winston

const ftpServerOptions = {
  host: process.env.IP || '127.0.0.1',
  port: process.env.PORT || 7002,
  tls: null
};

parseCliArgs(
  {
    argv: process.argv,
    description,
    homepage,
    version
  },
  (cliOptions) => {
    let devicesPath = null;

    if (cliOptions.devicesPath) {
      devicesPath =
        cliOptions.devicesPath[0] === '/' ? cliOptions.devicesPath : join(process.cwd(), cliOptions.devicesPath);
      console.log(`Lookup for storage devices in this path: ${devicesPath}`);
    } else {
      //TODO to separated method
      devicesPath = join('/media', process.env.USER); // default ubuntu path for mount media devices
      console.log(`Lookup for storage devices in this path: ${devicesPath} (auto discovered Ubuntu media folder)`);
    }

    const devicesManager = new DevicesManager({devicesPath});
    const mergedFs = new MergedFs({devicesManager});

    const server = new FtpServer(ftpServerOptions.host, {
      pasvPortRangeStart: 1025,
      pasvPortRangeEnd: 1050,
      tlsOptions: ftpServerOptions.tls,
      allowUnauthorizedTls: true,
      useWriteFile: false, // unstable
      useReadFile: false, // unstable
      uploadMaxSlurpSize: 1024 * 1024 * 1024, // N/A unless 'useWriteFile' is true.
      getInitialCwd: () => '/',
      getRoot: () => '/'
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
    server.listen(ftpServerOptions.port);

    console.log(`Listening on port ${ftpServerOptions.port}`);
  }
);
