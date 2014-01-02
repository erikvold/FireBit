/*
 * @desc: This is the crypto module of the TorrentPlus Add-on
 * @author: Rodney Teal
 * @file: crypto.js
 * @date: Saturday, October 26, 2013 (CDT) 
 */

// Exports: { SHA1 }

const { Cc, Ci } = require('chrome');

exports.SHA1 = function (data) {
    this.toHexString = function (hash) {
        var hex = new String();
        for (var i in hash) hex += ('0' + hash.charCodeAt(i).toString(16)).slice(-2);
        return hex;
    };
    this.InputStream = function (object) {
        if ((typeof object === 'object') && object.isFile) {
            return this.fileInputStream(object);
        } else if ((typeof object === 'string') && object.length) {
            return this.stringInputStream(object);
        } else return null;
    };
    this.stringInputStream = function (string) {
        var istream = Cc['@mozilla.org/io/string-input-stream;1'].createInstance(Ci.nsIStringInputStream);
        istream.setData(string, string.length);
        return istream;
    };
    this.updateFromStream = function (stream, count) {
        try {
            this.hasher.updateFromStream(stream, count);
            return this;
        } catch (error) {
            console.error(error.message, error.fileName, error.lineNumber);
        }
        return this;
    };
    this.update = function (data, count) {
        try {
            this.hasher.update(data, count);
            return this;
        } catch (error) {
            console.error(error.message, error.fileName, error.lineNumber);
        }
    };
    this.digest = function (boolean) {
        return this.createInstance(null, this.hasher.finish(boolean));
    };
    this.hexDigest = function (boolean) {
        return this.toHexString(this.digest(boolean));
    };
    this.fileInputStream = function (nsIFile) {
        var istream = Cc['@mozilla.org/network/file-input-stream;1'].createInstance(Ci.nsIFileInputStream);
        istream.init(nsIFile, 0x01, 0444, 0);
        return istream;
    };
    this.createInstance = function (data, chain) {
        this.hasher = Cc['@mozilla.org/security/hash;1'].createInstance(Ci.nsICryptoHash);
        this.hasher.init(this.hasher.SHA1);
        if (data) {
            var stream = this.InputStream(data);
            if (stream) this.updateFromStream(stream, stream.available());
        } else if (chain) return chain;
        else return this;
    };
    this.createInstance(data);
};
