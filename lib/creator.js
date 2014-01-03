/*
 * @desc: This is the torrent creation module of the TorrentPlus Add-on
 * @author: Rodney Teal
 * @file: creator.js
 * @date: Sunday, October 27, 2013 (CDT) 
 */

// Exports: { createTorrent }

const { Cc, Ci, Cr } = require('chrome');
const { SHA1 } = require('./utils/crypto');
const { errLog } = require('./utils/helper');
const { bencode } = require('./utils/bencode');

var threadMgr = Cc["@mozilla.org/thread-manager;1"].getService();
var transportSrv = Cc['@mozilla.org/network/stream-transport-service;1'].createInstance(Ci.nsIStreamTransportService)

//See nsprpub/pr/include/prio.h.
const openFlags = parseInt('0x02')/*WRITE*/ | parseInt('0x08')/*CREATE*/ | parseInt('0x20')/*TRUNCATE*/;
const permFlags = parseInt('0644', 8); // u+rw go+r

function dirList(nsiFile) {
    var filelist = [], sublist, files = nsiFile.directoryEntries, file, subfile;
    while (files.hasMoreElements()) {
        file = files.getNext().QueryInterface(Ci.nsIFile);
        if (file.isDirectory()) {
            sublist = dirList(file);
            if (sublist.length) {
                for (subfile of sublist) filelist.push(subfile);
            }
        } else if (file.fileSize > 0) {
            filelist.push(file);
        }
    }
    return filelist;
}

function AsyncFileStream(nsiFile, aCallback, aRequestedCount) {
    this.fileStream = Cc['@mozilla.org/network/file-input-stream;1'].createInstance(Ci.nsIFileInputStream);
    this.fileStream.init(nsiFile, -1, 0, 0);
    this.transport = transportSrv.createInputTransport(this.fileStream, -1, -1, true);
    this.asyncStream = this.transport.openInputStream(0, 0, 0).QueryInterface(Ci.nsIAsyncInputStream);
    this.scriptStream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
    this.scriptStream.init(this.asyncStream); var aStream = this;
    this.onDataAvailable = function () {
        aCallback(aStream);
    };
    this.asyncWait = function () {
        this.asyncStream.asyncWait(this.onDataAvailable, 0, aRequestedCount, threadMgr.currentThread);
    };
    this.read = function (bytes) {
        if (!bytes) bytes = this.available();
        return this.scriptStream.read(bytes);
    };
    this.available = function () {
        return this.asyncStream.available();
    };
    this.readBytes = function (bytes) {
        if (!bytes) bytes = this.available();
        return this.scriptStream.readBytes(bytes);
    };
    this.close = function () {
        this.asyncStream.close();
    };
    this.asyncWait();
}

exports.createTorrent = function (torrent, progress, outfile) {
    try {
        if (!torrent.hasOwnProperty('info') || !torrent.info.hasOwnProperty('files') || !torrent.info.files.length)
            throw Error('Torrent object is missing files');
        var active = true, dead = false, next = true, ready = false;
        var control = {
            suspend: function() { next = false; },
            resume: function () {
                if (!active) {
                    next = true;
                    if (ready && !dead) control.stream.asyncWait();
                }
            },
            abort: function () { if (!dead) control.resume(); dead = true; }
        };
        if (!torrent.hasOwnProperty('encoding')) torrent.encoding = 'UTF-8';
        if (!torrent.info.hasOwnProperty('length')) torrent.info.length = 0;
        if (!torrent.info.hasOwnProperty('name')) torrent.info.name = '';
        if (!torrent.info.hasOwnProperty('piece length')) torrent.info['piece length'] = 0;
        if (!torrent.info.hasOwnProperty('pieces')) torrent.info.pieces = '';
        var root = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile); root.initWithPath(torrent.info.files[0]);
        if (torrent.info.name === '') torrent.info.name = root.leafName;
        if (root.isDirectory()) {
            if (root.parent === null) throw Error('Unable to create torrents from the root of drives');
            torrent.info.files = dirList(root);
        }
        else torrent.info.files = [root];
        if (!torrent.info.files.length) throw Error('File enumeration failed');
        for (var file of torrent.info.files) torrent.info.length += file.fileSize;
        if (torrent.info['piece length'] < 16384/*16KB*/) {
            if (torrent.info.length < 16384/*16KB*/) throw Error('Torrent must be larger than 16KB');
            else {
                torrent.info['piece length'] = 262144/*256KB*/;
                while (torrent.info.length / torrent.info['piece length'] > 2000) torrent.info['piece length'] *= 2;
                while (torrent.info.length / torrent.info['piece length'] < 8) torrent.info['piece length'] /= 2;
                torrent.info['piece length'] = Math.max(Math.min(torrent.info['piece length'], 1048576/*1MB*/), 16384/*16KB*/);
            }
        }
        var callback = false, length = 0, read = 0, index = 0, requested, available, hasher = new SHA1(), name
            remaining = torrent.info['piece length']; file = torrent.info.files[index];
        if (typeof progress === 'function') callback = true;
        var onDataAvailable = function (inputStream) {
            try {
                available = inputStream.available();
                if (remaining >= available) requested = available;
                else requested = remaining;
                try {
                    hasher.updateFromStream(inputStream.asyncStream, requested);
                    remaining -= requested; length += requested; read += requested;
                    if (callback) progress(read, torrent.info.length, {'name':file.leafName,'read':length,'size':file.fileSize});
                    if (!remaining) {
                        torrent.info.pieces += hasher.digest(); remaining = torrent.info['piece length'];
                    }
                    if (length === file.fileSize) {
                        length = 0;
                        if (index < torrent.info.files.length-1) {
                            file = torrent.info.files[++index];
                            control.stream = new AsyncFileStream(file, onDataAvailable, torrent.info['piece length']); return;
                        } else {
                            if (remaining) torrent.info.pieces += hasher.digest(); dead = true;
                            if (root.isDirectory()) {
                                var files = [], path;
                                for (file of torrent.info.files) {
                                    path = [file.leafName]; length = file.fileSize;
                                    while (file.parent !== null) {
                                        file = file.parent;
                                        if (file.path === root.path) break;
                                        path.push(file.leafName);
                                    }
                                    path.reverse();
                                    files.push({'length':length, 'path':path});
                                }
                                torrent.info.files = files;
                            } else delete torrent.info.files;
                            torrent = bencode(torrent);
                            file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
                            file.initWithPath(outfile);
                            var fileStream = Cc['@mozilla.org/network/file-output-stream;1'].createInstance(Ci.nsIFileOutputStream);
                            fileStream.init(file, openFlags, permFlags, 0);
                            var byteStream = Cc["@mozilla.org/binaryoutputstream;1"].createInstance(Ci.nsIBinaryOutputStream);
                            byteStream.setOutputStream(fileStream);
                            byteStream.writeBytes(torrent, torrent.length);
                            byteStream.close(); return;
                        }
                    }
                } catch (error if error === Cr.NS_ERROR_NOT_AVAILABLE) {}
                active = next;
                if (!dead) {
                    if (active) inputStream.asyncWait();
                    else if (callback) progress(read, torrent.info.length, {'name':'Process suspended.','read':length,'size':file.fileSize});
                } else {
                    inputStream.close(); control = undefined;
                }
            } catch (error) {
                errLog(error);
            }
        };
        control.stream = new AsyncFileStream(file, onDataAvailable, torrent.info['piece length']); ready = true;
        return control;
    } catch (error) {
        errLog(error);
    }
};