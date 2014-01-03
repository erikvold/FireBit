const { Class } = require('sdk/core/heritage');

require('./bytes').define(String);
/*
 * address: an IPv4 address string, 6 byte compact IP/Port (string||bytes), Integer form(decimal)
 * port: is Number
 * type: optional address type.
 */

exports.Addr = Class({
    initialize: function initialize(address, port, type) {
        if (address) {
            if (type) { // use the corrensponding set method
                if (type === 'compact') {
                    this.setCompact(address);
                } else if (type === 'dotted') {
                    this.setDotted(address);
                    this.setPort(port);
                } else if (type === 'decimal') {
                    this.setDecimal(address);
                    this.setPort(port);
                } else {
                    throw TypeError();
                }
            } else {
                if (isNaN(+address)) { // !isInteger
                    if (address.length === 6/*bytes*/) {
                        this.setCompact(address)
                    } else { // is IPv4 dot noted string
                        this.setDotted(address);
                        this.setPort(port);
                    }
                } else { // isInteger
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
        // if address is bytes then compact.bytes returh this, otherwise get bytes
        // view is a DataView see: https://developer.mozilla.org/en-US/docs/Web/API/DataView
        var view = this.compact.bytes.view;
        this.setDecimal(view.getUint32(0)); // get 32 bit unsigned integer from bytes
        this.setPort(view.getUint16(4)); // get 16 bit unsigned port number from bytes
    },
    setDotted: function (address) {
        this.address = address; // IPv4 string
    },
    setDecimal: function (address) {
        var integer = this.decimal = address; // Store the integer form and below is inet_ntoa
        var asString = ((integer >> 24) & 0xFF) + '.' + ((integer >> 16) & 0xFF) + '.' + ((integer >> 8) & 0xFF) + '.' + (integer & 0xFF); // Big-endian (Network Byte Order)
        this.setDotted(asString);
    },
    setPort: function (port) {
        if (port && (+port === port) && port < (0xFFFF+1)) { // Port number range check
            this.port = port;
        } else {
            throw new RangeError('Port out of range.');
        }
    },
    address: null,
    port: null,
    compact: null, // will contain the compact form of the address and port if any
    decimal: null
});

