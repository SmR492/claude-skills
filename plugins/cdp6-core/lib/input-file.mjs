import { closeSync, constants, existsSync, fstatSync, openSync, readSync, realpathSync, statSync } from 'node:fs';

const FD_DIR = '/proc/self/fd';
const DELETED = ' (deleted)';

function descriptorPath(fd) {
  try {
    return realpathSync(`${FD_DIR}/${fd}`);
  } catch {
    return null;
  }
}

function sameIdentity(fd, real) {
  try {
    const a = fstatSync(fd);
    const b = statSync(real);
    return a.dev === b.dev && a.ino === b.ino;
  } catch {
    return false;
  }
}

export function openInput(path, hooks = {}) {
  let fd;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch (e) {
    const error = e.code === 'ENOENT' ? 'missing' : e.code === 'ELOOP' ? 'symlink' : 'unreadable';
    return { path, error };
  }
  hooks.afterOpen?.();
  const stat = fstatSync(fd);
  const byKernel = existsSync(FD_DIR);
  let real = null;
  if (byKernel) {
    real = descriptorPath(fd);
  } else {
    try {
      real = realpathSync(path);
    } catch {
      real = null;
    }
  }
  const same = real !== null && !real.endsWith(DELETED) && sameIdentity(fd, real);
  return { path, fd, real, byKernel, isFile: stat.isFile(), nlink: stat.nlink, size: stat.size, same };
}

export function stillSame(handle) {
  if (handle.fd === undefined) return false;
  try {
    if (handle.byKernel) {
      const now = descriptorPath(handle.fd);
      return now === handle.real && !now.endsWith(DELETED) && fstatSync(handle.fd).nlink === 1 && sameIdentity(handle.fd, now);
    }
    const real = realpathSync(handle.path);
    return real === handle.real && sameIdentity(handle.fd, real);
  } catch {
    return false;
  }
}

export class InputError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function readInput(handle) {
  if (handle.content !== undefined) return handle.content;
  const limit = handle.size + 1;
  const buf = Buffer.alloc(limit);
  let got = 0;
  while (got < limit) {
    const n = readSync(handle.fd, buf, got, limit - got, got);
    if (n === 0) break;
    got += n;
  }
  if (got > handle.size) throw new InputError('file-grew', 'a file is larger than it was when it was opened');
  handle.content = buf.subarray(0, got);
  return handle.content;
}

export function closeInput(handle) {
  if (handle.fd === undefined) return;
  try {
    closeSync(handle.fd);
  } catch {
    return;
  }
}

export function readProjectFile(path, maxBytes = Infinity) {
  const handle = openInput(path);
  try {
    if (handle.error || !handle.isFile || !handle.same || handle.size > maxBytes) return null;
    return readInput(handle);
  } catch {
    return null;
  } finally {
    closeInput(handle);
  }
}
