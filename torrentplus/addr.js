const { Class } = require('sdk/core/heritage');

require('./bytes').define(String);

exports.Addr = Class({
    initialize: function initialize(address, port, type) {
        if (address) {
            if (type) {
                if (type === 'compact') {
                    this.setCompact(address);
                } else if (type === 'dotted') {
                    this.setDotted(address);
                    this.setPort(port);
                } else if (type === 'decimal') {
                    this.setDecimal(address);
                    this.setPort(port);
                }
            } else {
                if (isNaN(+address)) {
                    if (address.length === 6) {
                        this.setCompact(address)
                    } else {
                        this.setDotted(address);
                        this.setPort(port);
                    }
                } else {
                    this.setDecimal(address);
                    this.setPort(port);
                }
            }
        } else {
            throw Error('Invalid IP address');
        }
    },
    setCompact: function (address) {
        this.compact = (address.length <= 6) ? address : address.slice(-6);
        var view = this.compact.bytes.view;
        this.setDecimal(view.getUint32(0));
        this.setPort(view.getUint16(4));
    },
    setDotted: function (address) {
        this.address = address;
    },
    setDecimal: function (address) {
        var integer = this.decimal = address;
        var asString = ((integer >> 24) & 0xFF) + '.' + ((integer >> 16) & 0xFF) + '.' + ((integer >> 8) & 0xFF) + '.' + (integer & 0xFF); // Big-endian (Network Byte Order)
        this.setDotted(asString);
    },
    setPort: function (port) {
        if (port && (+port === port) && port < (0xFFFF+1)) {
            this.port = port;
        } else {
            throw new RangeError('Port out of range.');
        }
    },
    address: null,
    port: null,
    compact: null,
    decimal: null
});

