const CODES = {
  EEXIST: 'EEXIST',
  EISFILE: 'EISFILE',
  ENOENT: 'ENOENT'
};

function createError(message, code = CODES.ENOENT) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function createNotExistError(message) {
  return createError(`${message}: file/directory not exist`); //TODO code???
}

module.exports = {
  CODES,
  createError,
  createNotExistError
};
