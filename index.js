const fetch = require('node-fetch');
const fs = require('fs');
const jsSHA = require('jssha');
const puppeteer = require('puppeteer');
const util = require('./util');

const pc = {
  'name': 'Chrome Mac',
  'userAgent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.186 Safari/537.36',
  'viewport': {
    'width': 1024,
    'height': 800,
    'deviceScaleFactor': 1,
    'isMobile': false,
    'hasTouch': false,
    'isLandscape': false
  }
};

// page._client.send('使用したいChrome DevTools Protocolメソッド名', {パラメータ});

(async() => {
  //  const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
  const browser = await puppeteer.launch({
    // userDataDir: './udd',
    // devtools: true,
  });
  const page = await browser.newPage();
  const url = util.shapeURL(process.argv[2]) || 'http://www.yahoo.co.jp/';
  const filename = url.replace(/\/$/, '').replace(/[:./]/g, '-').replace(/--+/g, '-');
  const dirname = encodeURIComponent(url);

  try {
    // console.log(`Original UA is ${await browser.userAgent()}`);
    await page.emulate(pc);
    console.log(`Access to ${url}`);
    await page.goto(url, {waitUntil: 'load', timeout: 10 * 1000});
    if (!fs.existsSync(dirname)){
      fs.mkdirSync(dirname);
    }

    /* page.on('console', msg => {
      for (let i = 0; i < msg.args().length; ++i)
        console.log(msg.args()[i]);
    }); */

    const base = await page.url().match(/^https?:\/\/[^\/]+\//)[0];

    await util.sleep(5 * 1000);
    await page._client.send(
      'Input.synthesizeScrollGesture',
      {
        x: 400,
        y: 400,
        xDistance: 0,
        yDistance: -1000,
      }
    );
    await util.sleep(5 * 1000);

    /* 画面をフルサイズで撮る */
    await page.screenshot({path: `./${dirname}/fullss.png`, fullPage: true});

    // localにあるファイルの一覧を保持
    let locals = [];
    //{
      const res = await page._client.send(
        'Page.getResourceTree'
      );
      res.frameTree.resources.forEach(async ({url, type, mimeType}, index) => {
        // console.log(`${url}, ${type}, ${mimeType}`);
        if (url.substr(0, 5) === 'data:') return;
        try {
          const orgURL = url;
          url = url.replace(/^[a-z]+:\/\//, '');
          const path = url.match(/^([^#?]+\/|[^\/]+$)/)[0];
          const name = url.substr(path.length).length;
          const paths = path.split('/');
          for (let i = 0; i < paths.length; ++i) {
            const tmpPath = paths.slice(0, i + 1).join('/');
            if (!fs.existsSync(`./${dirname}/${tmpPath}`)){
              fs.mkdirSync(`./${dirname}/${tmpPath}`);
            }
          }
          // fs.writeFileSync(`./${dirname}/${encodeURIComponent(url)}`);
          const buffer = await fetch(orgURL, {
            method: 'GET',
            mode: 'cors',
          }).then(res => res.buffer());
          const encodedName = encodeURIComponent(name);

          // console.log(`${url}, ${type}, ${mimeType}`);
          console.log(locals.length);
          const now = Date.now();
          console.log(now);

          if (encodedName.length >= 256) {
            const sha = new jsSHA('SHA-256', 'TEXT');
            sha.update(encodedName);
            const hashedName = `${encodedName.substr(0, 192)}${sha.getHash('HEX')}`;

            locals.push({
              url: url,
              path: `./${path}/${hashedName}`,
            });
            fs.writeFileSync(`./${dirname}/${path}/${hashedName}`, buffer);
          } else {
            locals.push({
              url: url,
              path: `./${path}/${encodedName}`,
            });
            fs.writeFileSync(`./${dirname}/${path}/${encodedName}`, buffer);
          }
        } catch (e) {
          // console.error(e);
          console.error(`error: ${url}`);
        }
      });
    //}
    /* const pdfbase64 = await page._client.send(
      'Page.printToPDF'
    );
    fs.writeFileSync(`./${dirname}/file.pdf`, pdfbase64, 'base64'); */

    //{
      console.log('locals');
      console.log(locals);
      console.log(Date.now());
      await page.$$eval('*', (items, locals) => {
        const pathToFullpath = (base, path) => {
          if (base.substr(-1) !== '/') base += '/';

          if (path[0] === '/') return base + path.substr(1);
          if (path.substr(0, 2) === './') return base + path.substr(2);
          while (path.substr(0, 3) === '../') {
            path = path.substr(3);
            base = base.replace(/[^\/]+\/$/, '');
          }
          return `${base}${path}`;
        }
        const base = location.href.match(/^([^#?]+\/|[^\/]+$)/)[0];
        //const locals = JSON.parse(args[0]);
        //console.log(args);
        //console.log(`typeof is ${typeof locals} ${locals}`);
        console.log(`typeof is ${typeof JSON.parse(locals)} ${JSON.parse(locals)}`);

        items.forEach(item => {
          if (item.src) {
            const fullpath = pathToFullpath(base, item.src);
            const index = locals.findIndex(elem => elem.url.replace(/\/\/+/, '/') === fullpath.replace(/\/\/+/, '/'));
            if (index > -1) item.src = fullpath[index].path;
          } else if (item.href) {
            const fullpath = pathToFullpath(base, item.href);
            const index = locals.findIndex(elem => elem.url.replace(/\/\/+/, '/') === fullpath.replace(/\/\/+/, '/'));
            if (index > -1) item.href = fullpath[index].path;
          } else {
            console.log('None of them');
          }
        });
      }, JSON.stringify(locals));
    //}

    await page.content().then(content => {
      fs.writeFileSync(`./${dirname}/file.html`, content);
    });
    // await page.content().then(content => console.log("************* TOP content="+content));
  } catch (e) {
    console.error(e);
  }

  browser.close();
})();
