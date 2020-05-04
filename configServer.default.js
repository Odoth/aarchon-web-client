var config = {};


config.gameHost = "aarchonmud.com";
config.gamePort = 7000;

/* If false, only serve socket.io and not static files */
config.serveStatic = true;

config.serverHost = "0.0.0.0";
config.serverPort = 80;


module.exports = config;
