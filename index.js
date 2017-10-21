'use strict';

const cmd = require('commander');
const fs = require('fs');

cmd
  .version('1.0.0')
  .option('--nginx', 'nginx configure')
  .option('--user <user>', 'nginx worker user', /^[a-z 0-9].*$/i, 'nginx')
  .option('--wp <worker_processes>', 'nginx worker processes', /^[0-9].*$/i, 'auto')
  .option('--wc <worker_connections>', 'nginx worker connections', /^[0-9].*$/i, 1024)
  .option('--charset <charset>', 'charset', /^[\/a-z 0-9]*.*$/i, 'UTF-8')
  .option('--el <error_log>', 'nginx error log dir', /^([\/a-z 0-9]*.*|off)$/i, '/var/log/nginx/error.log')
  .option('--al <access_log>', 'nginx access log dir', /^([\/a-z 0-9]*.*|off)$/i, '/var/log/nginx/access.log')
  .option('--keeptime <keepalive_time>', 'connection keep time', /^[0-9].*$/i, 75)
  .option('--sendfile <sendfile>', 'nginx sendfile')
  .option('--tcp_nopush <tcp_nopush>', 'nginx tcp_nopush')
  .option('--tcp_nodelay <tcp_nodelay>', 'nginx tcp_nodelay')
  .option('--gzip <gzip>', 'nginx gzip')
  .option('--include <include dir>', 'nginx include conf dir', /^[\/a-z 0-9]*.*$/i, '/etc/nginx/sites-enabled/*.conf')

  .option('--vhost', 'vhost configure')
  .option('--vhconf_name <vhost conf name>', 'vhost conf name')
  .option('--SSL', 'SSL')
  .option('--servername <servername>', 'server_name', /^.*\.[a-z]+$/i, 'localhost')
  .option('--rootdir <dir>', 'rootDir', /^[\/a-z 0-9]*.*$/i, '/var/www/html')
  .option('--index <index_file>', 'index files', /^.*\.[a-z]+$/i, 'index.html')
  .option('--php <php_socket_pass>', 'php socket dir', /^(.*\.[a-z]+:*|unix:[\/a-z 0-9]*.*|localhost:[0-9]*|[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}:[0-9]+)$/i, false)
  .option('--dhparam <dir>', 'dhparamDir', /^[\/a-z 0-9]*.*$/i, false)
  .option('--certdir <dir>', 'certfileDir', /^[\/a-z 0-9]*.*$/i, false)
  .option('--certkeydir <dir>', 'certkeyDir', /^[\/a-z 0-9]*.*$/i, false)
  .parse(process.argv);

if (cmd.nginx && cmd.vhost || !cmd.nginx && !cmd.vhost) {
  console.log('Error. choose only one option. --nginx or --vhost.');
  process.exit(1);
}

if (cmd.nginx) {
  let config;

  config = fs.readFileSync('confs/nginx.conf', 'utf-8');

  let put = {
    'user': cmd.user,
    'worker_processes': cmd.wp,
    'worker_connections': cmd.wc,
    'charset': cmd.charset,
    'error_log': cmd.el,
    'access_log': cmd.al,
    'user': cmd.user,
    'keepalive_timeout': cmd.keeptime,
    'include': cmd.include,
    'sendfile': cmd.sendfile ? 'on' : 'off',
    'tcp_nopush': cmd.tcp_nopush ? 'on' : 'off',
    'tcp_nodelay': cmd.tcp_nodelay ? 'on' : 'off',
    'gzip': cmd.gzip ? '' : '#',
  };

  config = replaceAll(config, put);

  if (!isExistFile('built')) {
    fs.mkdirSync('built');
  }

  fs.writeFileSync('built/nginx.conf', config);
}

if (cmd.vhost) {
  let config, location = null;

  config = fs.readFileSync('confs/temp.conf', 'utf-8');

  const server_ssl =
    'server {\n' +
    '  listen 80 http2;\n' +
    `  server_name ${cmd.servername};\n` +
    '  return 301 https://$host$request_uri;\n' +
    '}\n\n';

  let overrides = {
    'server_name': cmd.servername,
    'rootdir': cmd.rootdir,
    'index': cmd.index,
    'listen': cmd.SSL ? '443' : '80',
    'certfile_pass': (cmd.certdir != false && cmd.certkeydir != false && cmd.SSL) ? cmd.certdir : '',
    'certkey_pass': (cmd.certdir != false && cmd.certkeydir != false && cmd.SSL) ? cmd.certkeydir : '',
    'dhparam_pass': (cmd.certdir != false && cmd.certkeydir != false && cmd.dhparam != false && cmd.SSL) ? `ssl_dhparam ${cmd.dhparam};` : '',
    'ssl_settings': ''
  };

  if (cmd.SSL) {
    config = server_ssl + config;
    const ss = fs.readFileSync('confs/ssl_settings.conf', 'utf-8');
    overrides['ssl_settings'] = replaceAll(ss, overrides);
  }

  config = replaceAll(config, overrides);

  if (cmd.php !== false) {
    const temp = fs.readFileSync('confs/php_location.conf', 'utf-8');
    location = replace(temp, 'fastcgi_pass', cmd.php);
  }

  config = replace(config, 'location', location || '');

  // Save the configuration
  save(config);
}

/**
 * Save a configuration as a file
 * @param {*} config The configuration that you want to save
 */
function save(config) {
  // Make the built directory if it not exists
  if (!isExistFile('built')) fs.mkdirSync('built');

  const name = cmd.vhconf_name
    ? `${cmd.vhconf_name}.conf`
    : 'default.conf';

  // Write
  fs.writeFileSync(`built/${name}`, config);
}

function replaceAll(str, obj) {
  let result = str;

  const values = str.match(/\{\{(.*)\}\}/g) || [];

  values
    .map(v => v.match(/\{\{(.*)\}\}/)[1])
    .filter(v => obj[v] != null)
    .forEach(v => {
      result = replace(result, v, `${obj[v]}`);
    });

  return result;
}

function replace(template, name, value) {
  return template.replace(new RegExp(`{{${name}}}`, 'g'), value);
}

/**
 * Check whether the file exists
 * @param {*} file Name of the file that you want to check
 * @returns {boolean} Whether the file exists
 */
function isExistFile(file) {
  try {
    fs.statSync(file);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
  }
}
