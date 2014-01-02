const { Bytes } = require('./bytes');
const { Class } = require('sdk/core/heritage');

const Packet = Class({
    initialize: function initialize(value) {
        this.data = new Bytes(value);
    },
    get length() {
        return this.data.length;
    },
    get byteLength() {
        return this.data.byteLength;
    }
});

exports.packet = Packet;