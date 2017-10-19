'use strict'

const cmd = require("commander");
const fs = require("fs");

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
  
if(cmd.nginx && cmd.vhost || !cmd.nginx && !cmd.vhost) {
  console.log("Error. choose only one option. --nginx or --vhost.");
  process.exit(1);
}

if(cmd.nginx) {
  let config;
  
  config = fs.readFileSync('confs/nginx.conf', 'utf-8');
  
  config = replace(config, "user", cmd.user);
  config = replace(config, "worker_processes", cmd.wp);
  config = replace(config, "worker_connections", cmd.wc);
  config = replace(config, "charset", cmd.charset);
  config = replace(config, "error_log", cmd.el);
  config = replace(config, "access_log", cmd.al);
  config = replace(config, "keepalive_timeout", cmd.keeptime);
  config = replace(config, "include", cmd.include);
  
  if(cmd.sendfile) {
    config = replace(config, "sendfile", 'on');
  }else{
    config = replace(config, "sendfile", 'off');
  }
  
  if(cmd.tcp_nopush) {
    config = replace(config, "tcp_nopush", 'on');
  }else{
    config = replace(config, "tcp_nopush", 'off');
  }
  
  if(cmd.tcp_nodelay) {
    config = replace(config, "tcp_nodelay", 'on');
  }else{
    config = replace(config, "tcp_nodelay", 'off');
  }
  
  if(cmd.gzip) {
    config = replace(config, "gzip", '');
  }else{
    config = replace(config, "gzip", '#');
  }
  
  if(!isExistFile('built')) {
    fs.mkdirSync('built');
  }
  
  fs.writeFileSync('built/nginx.conf', config);
}

if(cmd.vhost) {
  let config, location = null;
  
  config = fs.readFileSync('confs/temp.conf', 'utf-8');
  const server_ssl = "server {\n" +
                     "  listen 80 http2;\n" +
                     `  server_name ${cmd.servername};\n` +
                     "  return 301 https://$host$request_uri;\n" +
                     "}\n\n";
    
  config = replace(config, "server_name", cmd.servername);
  config = replace(config, "rootdir", cmd.rootdir);
  config = replace(config, "index", cmd.index);
      
  if(cmd.SSL) {
    config = server_ssl + config;
      const listen = "443";
      config = replace(config, "listen", listen);
  }else{
    const listen = "80";
    config = replace(config, "listen", listen);
  }
  
  if(cmd.certdir != false && cmd.certkeydir != false) {
    let temp = fs.readFileSync('confs/ssl_settings.conf', 'utf-8');
    temp = replace(temp, "certfile_pass", cmd.certdir);
    temp = replace(temp, "certkey_pass", cmd.certkeydir);
    
    if(cmd.dhparam != false) {
      temp = replace(temp, "dhparam_pass", `ssl_dhparam ${cmd.dhparam};`);
    }else{
      temp = replace(temp, "dhparam_pass", '');
    }
    
    config = replace(config, "ssl_settings", temp);
  }else{
    console.log("certfile or certkey nothing. danger security risk.");
    config = replace(config, "ssl_settings", '');
  }
  
  if(cmd.php !== false) {
    const temp = fs.readFileSync('confs/php_location.conf', 'utf-8');
    location = replace(temp, "fastcgi_pass", cmd.php);
  }
  
  if(location != null) {
    config = replace(config, "location", location);
  }else{
    config = replace(config, "location", '');
  }
  
  if(!isExistFile('built')) {
    fs.mkdirSync('built');
  }
    
  if(cmd.vhconf_name) {
    fs.writeFileSync(`built/${cmd.vhconf_name}.conf`, config);
  }else{
    fs.writeFileSync('built/default.conf', config);
  }
}

function replace(temp, name, value) {
  return temp.replace(new RegExp(`{{${name}}}`, 'g'), value);
}

function isExistFile(file) {
  try {
    fs.statSync(file);
    return true
  } catch(err) {
    if(err.code === 'ENOENT') return false
  }
}