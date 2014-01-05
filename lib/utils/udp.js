const { Cc, Ci } = require('chrome'); // https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/tutorials/chrome.html
const { Class } = require('sdk/core/heritage'); // https://addons.mozilla.org/en-US/developers/docs/sdk/latest/modules/sdk/core/heritage.html
let { EventTarget } = require("sdk/event/target"); // https://addons.mozilla.org/en-US/developers/docs/sdk/latest/modules/sdk/event/target.html
let { emit } = require("sdk/event/core"); // https://addons.mozilla.org/en-US/developers/docs/sdk/latest/modules/sdk/event/core.html

// UDPServer class will emit to events packet and stop
// i.e. server.on('packet', Function);
//      server.on('stop', Function);
// The only method used is server.send at this time
/*
 *  use case:
 *      var NewServer = Class({ // Add new methods etc.
 *          extends: UDPServer,
 *          initialize: function (port) {
 *              UDPServer.prototype.initialize.call(this, port, false, false);
 *          }
 *      });
 *
 *      var server = NewServer(6881);
 *      server.on('packet', function (aMessage) {
 *          console.log(aMessage.fromAddr.address, aMessage.data);
 *      });
 *      server.on('stop', function (status) {
 *          console.log('Server stopped with status ' + status);
 *      });
 *      var data = [85, 65, 66, 89];
 *      server.send('127.0.0.1', 80, data);
 *      server.send('localhost', 80, data); // DNS resolution is done for us by nsIUDPSocket.
 */

exports.UDPServer = Class({
    extends: EventTarget,
    initialize: function initialize(aPort, aLoopbackOnly, aRandom) {
        EventTarget.prototype.initialize.call(this);
        this.socket = Cc["@mozilla.org/network/udp-socket;1"].createInstance(Ci.nsIUDPSocket); // See: http://dxr.mozilla.org/mozilla-central/source/netwerk/base/public/nsIUDPSocket.idl
        if (aRandom) aPort = parseInt((Math.random()*(0xFFFF-10000))+10000);
        if (aPort > 0xFFFF) throw new RangeError('Invalid port number passed to initializer or randomizer overflow.');
        this.socket.init(((+aPort) ? aPort : -1), aLoopbackOnly);
        this.socket.asyncListen(this);
    },
    socket: null,
    send: function (aHost, aPort, aData, aDataLength) { // aData must be an array of bytes, it prefers Uint8Array // this function makes the length argument optional
        return this.socket.send(aHost, aPort, aData, (aDataLength ? aDataLength : aData.length));
    },
    sendRequest: function (aAddr, aSocket, aData) { // Just another wrapper method for socket
        return this.socket.sendRequest(aAddr, aSocket, aData);
    },
    onStopListening: function (_, aStatus) { // onStopListening and onPacketReceived make up the nsIUDPSocketListener interface so we can pass (this) in the intializer to socket.ayncListen
        emit(this, 'stop', aStatus)
    },
    onPacketReceived: function (_, aMessage) {
        emit(this, 'packet', aMessage);
    },
    stop: function () { // Just another wrapper method for socket
        this.socket.close();
    },
    get port() this.socket.port
});





