module.exports = {
  shapeURL: (url) => {
    if (url.substr(0, 4) !== 'http') {
      url = 'http://' + url;
    }
    return url;
  },
  sleep: (msec) => {
    return new Promise(resolve => {
      setTimeout(resolve, msec);
    });
  },
  utilToFullpath: (base, path) => {
    if (base.substr(-1) !== '/') base += '/';

    if (path[0] === '/') return base + path.substr(1);
    if (path.substr(0, 2) === './') return base + path.substr(2);
    while (path.substr(0, 3) === '../') {
      path = path.substr(3);
      base = base.replace(/[^\/]+\/$/, '');
    }
    return `${base}${path}`;
  }
};
