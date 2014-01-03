const { Cc, Ci } = require('chrome');
const { Class } = require('sdk/core/heritage');
let { EventTarget } = require("sdk/event/target");
let { emit } = require("sdk/event/core");

exports.UDPServer = Class({
    extends: EventTarget,
    initialize: function initialize(aPort, aLoopbackOnly, aRandom) {
        EventTarget.prototype.initialize.call(this);
        this.socket = Cc["@mozilla.org/network/udp-socket;1"].createInstance(Ci.nsIUDPSocket);
        if (aRandom) aPort = parseInt((Math.random()*(0xFFFF-10000))+10000);
        if (aPort > 0xFFFF) throw new RangeError('Invalid port number passed to initializer or randomizer overflow.');
        this.socket.init(((+aPort) ? aPort : -1), aLoopbackOnly);
        this.socket.asyncListen(this);
    },
    socket: null,
    send: function (aHost, aPort, aData, aDataLength) {
        return this.socket.send(aHost, aPort, aData, (aDataLength ? aDataLength : aData.length));
    },
    sendRequest: function (aAddr, aSocket, aData) {
        return this.socket.sendRequest(aAddr, aSocket, aData);
    },
    onStopListening: function (aSocket, aStatus) {
        emit(this, 'stop', aStatus)
    },
    onPacketReceived: function (aSocket, aMessage) {
        emit(this, 'packet', aMessage);
    },
    stop: function () {
        this.socket.close();
    },
    get port() this.socket.port
});





