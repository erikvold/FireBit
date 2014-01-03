/*
 * @desc: This is the bencode module of the TorrentPlus Add-on
 * @author: Rodney Teal
 * @file: bencode.js
 * @date: Monday, October 21, 2013 (CDT)
 */

// Exports: { bencode, bdecode }


function decode(string, index, recursive) {
    if (!index && !recursive) index = 0;
    if (!recursive) decode.iterations = 0;
    decode.iterations += 1;
    if (decode.iterations > string.length) throw 'Error: decode function reached implied maximum recursion level - Invalid Bencoded Data!';
    var decoded, char = string[index];
    //console.log( index+'='+char );
    switch (true) {
    case (char === 'd'):
        decoded = decodeDictionary(string, ++index);
        break;
    case (char === 'l'):
        decoded = decodeList(string, ++index);
        break;
    case (char === 'i'):
        decoded = decodeInteger(string, ++index);
        break;
    case (char >= 0 && char <= 9):
        decoded = decodeString(string, index);
        break;
    default:
        decoded = {
            data: null,
            index: null
        };
        console.error('Error: decode function encounter an invalid data type identifier - Invalid Bencoded Data!');
    }
    if (!recursive) {
        return decoded.data;
    } else {
        return decoded;
    }
}

function decodeDictionary(string, index) {
    var dictionary = {},
        decoded;
    do {

        var colon = getColonIndex(string, index);
        var count = parseInt(string.substr(index, colon));
        var key = string.substr(++colon, count);
        decoded = decode(string, colon + count, true);
        dictionary[key] = decoded.data;
        //if (!decoded.index || decoded.index >= string.length) return {'data':dictionary,'index':null};
        if (!decoded.index) return {
            'data': dictionary,
            'index': null
        };
        index = decoded.index;
        if (string[index] === 'e') {
            decoded = {
                'data': dictionary,
                'index': index + 1
            };
            return decoded;
        }

    } while (index <= string.length);
}

function decodeList(string, index) {
    var list = [],
        decoded;
    do {
        decoded = decode(string, index, true);
        list.push(decoded.data);
        //if (!decoded.index || decoded.index >= string.length) return {'data':list,'index':null};
        if (!decoded.index) return {
            'data': list,
            'index': null
        };
        index = decoded.index;
        if (string[index] === 'e') {
            decoded = {
                'data': list,
                'index': index + 1
            };
            return decoded;
        }
    } while (index <= string.length);
}

function getColonIndex(string, index) {
    for (var char = index; char < string.length; char++) {
        if (string[char] === ':') return char;
    }
}

function decodeInteger(string, index) {
    var sliceOfString = string.slice(index);
    var end = sliceOfString.indexOf('e');
    var integer = sliceOfString.substr(0, end),
        decoded = {
            'data': parseInt(integer),
            'index': index + end + 1
        };
    return decoded;
}

function decodeString(string, index) {
    ////console.log(string.substr(index-5));
    //console.log( '\n\n\n' + string.substr(index-5).length);
    var colon = getColonIndex(string, index);
    var count = parseInt(string.substr(index, colon));
    colon += 1;
    string = string.substr(colon, count);
    var decoded = {
        'data': string,
        'index': colon + count
    };
    return decoded;
}

function isType(type, obj) {
    var clas = Object.prototype.toString.call(obj).slice(8, -1);
    return obj !== undefined && obj !== null && clas === type;
}

function encode(obj) {
    var encoded = '';
    switch (true) {
    case (isType('String', obj)):
        // String
        encoded = obj.length + ':' + obj;
        break;
    case (isType('Object', obj)):
        // Dictionary
        for (var key in obj) {
            encoded += encode(key) + encode(obj[key]);
        }
        encoded = 'd' + encoded + 'e';
        break;
    case (isType('Array', obj)):
        // List
        for (var i = 0; i < obj.length; i++) {
            encoded += encode(obj[i]);
        }
        encoded = 'l' + encoded + 'e';
        break;
    case (isType('Number', obj)):
        // Integer
        encoded = 'i' + obj + 'e';
        break;
    default:
        throw Error('Invalid Data Type! The valid types allowed are (String, Object, Array, Number).');
    }
    return encoded;
}

exports.bdecode = decode;
exports.bencode = encode;
