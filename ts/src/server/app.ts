import * as express from "express";
import * as http from "http";
import * as socketio from "socket.io";
import * as net from "net";

import { IoEvent } from "../shared/ioevent";

let serverConfig = require("../../configServer.js");
console.log(serverConfig);

let cwd = process.cwd();


let telnetIdNext = 0;

let server: http.Server = http.createServer();
let io: SocketIO.Server = socketio();

let telnetNs: SocketIO.Namespace = io.of("/telnet");
telnetNs.on("connection", (client: SocketIO.Socket) => {
    let telnet: net.Socket;
    let ioEvt = new IoEvent(client);
    let remoteAddr = client.request.headers['x-real-ip'] || client.request.connection.remoteAddress;

    let writeQueue: any[] = [];
    let canWrite: boolean =  true;
    let checkWrite = () => {
        if (!canWrite) { return; }

        if (writeQueue.length > 0) {
            let data = writeQueue.shift();
            canWrite = false;
            canWrite = telnet.write(data as Buffer);
        }
    };

    let writeData = (data: any) => {
        writeQueue.push(data);
        checkWrite();
    };

    client.on("disconnect", () => {
        if (telnet) {
            telnet.end();
            telnet = null;
        }
    });

    ioEvt.clReqTelnetOpen.handle(() => {
        telnet = new net.Socket();

        let telnetId: number = telnetIdNext++;

        let host: string = serverConfig.gameHost;
        let port: number = serverConfig.gamePort;

        let conStartTime: Date;

        telnet.on("data", (data: Buffer) => {
            ioEvt.srvTelnetData.fire(data.buffer);
        });
        telnet.on("close", (had_error: boolean) => {
            ioEvt.srvTelnetClosed.fire(had_error);
            telnet = null;
            let elapsed: number = <any>(new Date()) - <any>conStartTime;
            tlog(telnetId, "::", remoteAddr, "->", host, port, "::closed after", (elapsed/1000), "seconds");
        });
        telnet.on("drain", () => {
            canWrite = true;
            checkWrite();
        });
        telnet.on("error", (err: Error) => {
            tlog(telnetId, "::", "TELNET ERROR:", err);
            ioEvt.srvTelnetError.fire(err.message);
        });

        try {
            tlog(telnetId, "::", remoteAddr, "->", host, port, "::opening");
            telnet.connect(port, host, () => {
                ioEvt.srvTelnetOpened.fire(null);
                conStartTime = new Date();
            });
        }
        catch (err) {
            tlog(telnetId, "::", "ERROR CONNECTING TELNET:", err);
            ioEvt.srvTelnetError.fire(err.message);
        }
    });

    ioEvt.clReqTelnetClose.handle(() => {
        if (telnet == null) { return; }
        telnet.end();
        telnet = null;
    });

    ioEvt.clReqTelnetWrite.handle((data) => {
        if (telnet == null) { return; }
        writeData(data);
    });

    ioEvt.srvSetClientIp.fire(remoteAddr);
});

if (serverConfig.serveStatic) {
    let express_app = express();
    server.on("request", express_app);

    express_app.use(express.static("static"));

    express_app.get("/", function(req, res) {
        res.sendFile("static/index.html", {root: cwd});
    });

    express_app.use((err: any, req: any, res: any, next: any) => {
        tlog("Express app error: " +
                    "err: " + err + " | " +
                    "req: " + req + " | " +
                    "res: " + res + " | ");
        next(err);
    });
}

io.attach(server);

server.on("error", (err: Error) => {
    tlog("Server error:", err);
});

server.listen(serverConfig.serverPort, serverConfig.serverHost, () => {
    console.log("Server is running on " + serverConfig.serverHost + ":" + serverConfig.serverPort);
});

function tlog(...args: any[]) {
    console.log("[[", new Date().toLocaleString(), "]]", ...args);
}
