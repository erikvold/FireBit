/*
 * @desc: This is the torrent module of the TorrentPlus Add-on
 * @author: Rodney Teal
 * @file: torrent.js
 * @date: Monday, October 21, 2013 (CDT)
 */

// Exports: { readTorrent, parseTorrent, isMagnet, convertMagnet }

const { SHA1 } = require('./utils/crypto');
const { bencode, bdecode } = require('./utils/bencode');
const { base64, base32, base16 } = require('./utils/basex');
const { BINARY, MAGNET, TORRENT } = require('./literals');
const { select } = require('./utils/helper');
const { defer } = require('sdk/core/promise');

var { Request } = require('sdk/request');

exports.isMagnet = function (tUrl) {
    return MAGNET.RE.test(tUrl);
};

exports.convertMagnet = function (tUrl) {
    var deferred = defer();
    var Desc = 'Magnet conversion failed: ';
    var hash = MAGNET.HASH.exec(tUrl)[1].toUpperCase();
    if (hash && hash.length) {
        if (hash.length === 32) hash = base16.encode(base32.decode(hash));
        else if (hash.length === 40) {
            var index = select('Torrent Mirror: ', TORRENT.MIRRORS);
            if (index !== undefined) {
                if (TORRENT.MIRRORS[index] === 'http://istoretor.com') deferred.resolve(TORRENT.MIRRORS[index] + '/fdown.php?hash=' + hash);
                else deferred.resolve(TORRENT.MIRRORS[index] + '/torrent/' + hash + '.torrent');
            } else deferred.reject(Error('User aborted'));
        } else deferred.reject(Error(Desc + 'Invalid hash length'));
    } else deferred.reject(Error(Desc + 'Invalid magnet URI'));
    return deferred.promise;
};

exports.convertHash = function (tUrl) {
    var hash = MAGNET.HASH.exec(tUrl)[1];
    if (hash.length === 32) hash = base16.encode(base32.decode(hash));
    return hash;
};

exports.shortMagnet = function (URI) {
    var deferred = defer();
    URI = encodeURIComponent(URI);
    Request({
        url: 'http://mgnet.me/api/create?m='+URI+'&format=json',
        onComplete: function (response) {
            if (response.status === 200 && response.text) {
                try {
                    deferred.resolve({me:JSON.parse(response.text)});
                } catch (error) {
                    deferred.resolve({me:{state:'failure',message:'Unable to parse response from Magnet.me'}});
                }
            } else {
                deferred.resolve({me:{state:'failure',message:response.statusText}});
            }
        }
    }).get();
    return deferred.promise;
};

exports.readTorrent = function(tUrl) {
    var deferred = defer();
    Request({
        url: tUrl,
        overrideMimeType: BINARY.IO.MIMETYPE,
        onComplete: function (response) {
            if (response.status === 200) {
                deferred.resolve(response.text);
            } else {
                if (response.statusText) deferred.reject(Error(response.statusText));
                else deferred.reject(Error('Not Found'));
            }
        }
    }).get();
    return deferred.promise;
};

exports.parseTorrent = function (binary) {
    var deferred = defer();
    try {
        var torrent = bdecode(binary);
        if (torrent && torrent.hasOwnProperty('info')) {
            torrent.binary = binary;
            torrent.hash = new SHA1(bencode(torrent['info'])).hexDigest();
            torrent.magnet = MAGNET.SCHEME + MAGNET.XT + torrent.hash;
            if (torrent.info.hasOwnProperty('name')) {
                torrent.magnet += MAGNET.DN + encodeURIComponent(torrent.info.name).replace(/'/g, '%27');
            }
            if (torrent.info.hasOwnProperty('files')) {
                torrent.size = 0;
                for (var file of torrent.info.files) {
                    if (file.length) torrent.size += file.length;
                }
                torrent.magnet += MAGNET.XL + torrent.size;
            }
            if (torrent.hasOwnProperty('announce-list')) {
                for (var tracker of torrent['announce-list']) {
                    if (tracker) torrent.magnet += MAGNET.TR + encodeURIComponent(tracker);
                }
            }
            deferred.resolve(torrent);
        } else {
            deferred.reject(Error('Couldn\'t parse torrent: Invalid torrent data'));
        }
    } catch (error) {
        deferred.reject(error);
    }     
    return deferred.promise;
};

var File = require('file');

exports.tinyTorrent = function (torrent) {
    var deferred = defer();
    var data = base64.encode(torrent.binary);
    if (data.length < 65536) {
        Request({
            url: 'http://tinyurl.com/api-create.php?url='+encodeURIComponent('data:application/x-bittorrent;base64,'+data),
            onComplete: function (response) {
                if (response.status === 200 && response.text) {
                    if (!response.text) deferred.reject(Error('Unable to create TinyURL - Unknown Error'));
                    else deferred.resolve(response.text);
                } else {
                    deferred.reject(Error('Unable to create TinyURL - Maybe too many requests'));
                }
            }
        }).get();
    } else deferred.reject(Error('Encoded torrent data exceeds the 65,536 character limit'));
    return deferred.promise;
};

var { Cc, Ci } = require('chrome');
exports.mirrorTorrent = function (torrent) {
    try {
    var deferred = defer();
    var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Ci.nsIScriptableUnicodeConverter);
    converter.charset = "UTF-8";
    var data = converter.ConvertFromUnicode(torrent.binary);
    data += converter.Finish();
    var boundaryString = '---------------------------281082742525110', boundary = '--' + boundaryString;
    var requestbody = boundary + '\r\n'
        + 'Content-Disposition: form-data; name="torrent"; filename="upload.torrent"'
        + '\r\nContent-Type: application/x-bittorrent\r\n\r\n'
        + data + '\r\n'+ boundary + '--\r\n';
    var xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
    xhr.open('POST', 'http://torrage.com/upload.php', true);
    xhr.setRequestHeader("Referer", "http://torrage.com");
    xhr.setRequestHeader("Content-type", "multipart\/form-data; charset=UTF-8; boundary=" + boundaryString);
    xhr.setRequestHeader("Content-length", requestbody.length);
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            if (xhr.status == 200) {
                if (!xhr.responseText) throw Error('Unable to upload torrent - Unknown Error');
                else {
                    console.error('RESPONSE: ');
                    console.error(xhr.responseText);
                }
            } else throw Error('Unable to upload torrent - Bad response');
        }
    };
    xhr.sendAsBinary(requestbody);
    return deferred.promise;
    } catch (error) {
        console.error(error.message, error.fileName, error.lineNumber);
    }
};
