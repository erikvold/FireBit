/*
 * @desc: This is the binary module of the TorrentPlus Add-on
 * @author: Rodney Teal
 * @file: binary.js
 * @date: Monday, October 21, 2013 (CDT)
 */

// { inet_ntoa, readUInt32, readUInt16 }

const bin = {

    inet_ntoa: function (i) {
        return ((i >> 24) & 0xFF) + '.' + ((i >> 16) & 0xFF) + '.' + ((i >> 8) & 0xFF) + '.' + (i & 0xFF); // big-endian
    },

    // read big-endian (network byte order) unsigned 32-bit int from data, at offset
    readUInt32: function (data, offset) {
        return ((data.charCodeAt(offset) & 0xFF) << 24) + ((data.charCodeAt(offset + 1) & 0xFF) << 16) + ((data.charCodeAt(offset + 2) & 0xFF) << 8) + (data.charCodeAt(offset + 3) & 0xFF);
    },

    // read big-endian (network byte order) unsigned 16-bit int from data, at offset
    readUInt16: function (data, offset) {
        return ((data.charCodeAt(offset) & 0xFF) << 8) + (data.charCodeAt(offset + 1) & 0xFF);
    }

};

for (var name in bin) exports[name] = bin[name];