const { Class } = require('sdk/core/heritage');

/*\
|*|
|*| Author: Rodney Teal
|*|
\*/

const toString = {
    __proto__: null,
    value: function toString() {
        return String.prototype.toString.call(this.chars.join(''));
    }
};
const getChars = {
    __proto__: null,
    get: function chars() {
        return this.bytes.chars;
    }
};
const getBytes = {
    __proto__: null,
    get: function bytes() {
        if (this instanceof Bytes) return this;
        return Bytes(Array.prototype.map.call(this, value => value.byte));
    }
};
const getHex = {
    __proto__: null,
    get: function hex() {
        return this.bytes.hex;
    }
};
const getBinary = {
    __proto__: null,
    get: function binary() {
        return this.bytes.binary;
    }
};
const getLength = {
    __proto__: null,
    get: function length() {
        return this.value.length;
    }
};
const getView = {
    __proto__: null,
    get: function view() {
        return new DataView(this);
    }
};

function valueOf() {
    return this.value;
}
function constructor(value) {
    this.value = value;
}
function defineFunctions(obj, ...props) {
    var properties = {};
    for (var prop of props) {
        for (var sub in prop) {
            var name = prop[sub].name;
            if (name) {
                properties[name] = prop;
            }
        }

    }
    Object.defineProperties(obj, properties);
}
function lockObjects(...objects) {
    for (var obj of objects) {
        Object.seal(obj);
        Object.freeze(obj);
    }
}

const cachedMethods = new WeakMap();
const handler = {
    set: function (target, key, value) {
        if (typeof value === 'string') {
            target[key] = value.byte
        } else if (value instanceof Hex || value instanceof Binary) {
            target[key] = value.bytes[0];
        } else {
            target[key] = value;
        }
    },
    get: function (target, key, receiver) {
        var methods = cachedMethods.get(receiver);
        if (methods === undefined) {
            methods = Object.create(null);
            cachedMethods.set(receiver, methods);
        } else if (Object.prototype.hasOwnProperty.call(methods, key)) {
            return methods[key];
        }
        var result = target[key];
        if (typeof result !== 'function') {
            return result;
        }
        return methods[key] = result.bind(receiver);
    }
};
function Bytes(value) {
    if (!value) value = 0;
    return Proxy(new Uint8Array(value), handler);
}
Object.defineProperty(Bytes, 'prototype', {
    __proto__: null,
    value: Uint8Array.prototype
});

var Hex = Class({
    initialize: constructor,
    get bytes() {
        return Bytes(Array.prototype.map.call(this.toArray(), hex => parseInt(hex, 16)));
    },
    get hex() this,
    toArray: function () {
        return String.prototype.match.call(this.value, /.{2}/g);
    },
    valueOf: valueOf,
    get byteLength() {
        return this.toArray().length;
    }
});

var Binary = Class({
    initialize: constructor,
    get bytes() {
        return Bytes(Array.prototype.map.call(this.toArray(), binary => parseInt(binary, 2)));
    },
    get binary() this,
    toArray: function () {
        return String.prototype.match.call(this.value, /.{8}/g);
    },
    valueOf: valueOf,
    get byteLength() {
        return this.toArray().length;
    }
});

const prototype = {
    properties: {
        chars: {
            __proto__: null,
            get: function chars() {
                return Array.prototype.map.call(this, value => value.char);
            }
        },
        bytes: getBytes,
        binary: {
            __proto__: null,
            get: function binary() {
                var length = 8;
                var binaryArray = Array.prototype.map.call(this, value => {
                    var binary = value.binary;
                    return String.prototype.repeat.call(0, length-binary.length) + '' + binary.valueOf();
                });
                return new Binary(binaryArray.join(''));
            }
        },
        hex: {
            __proto__: null,
            get: function hex() {
                var length = 2;
                var hexArray = Array.prototype.map.call(this, value => {
                    var hex = value.hex;
                    return String.prototype.repeat.call(0, length-hex.length) + '' + hex.valueOf();
                });
                return new Hex(hexArray.join(''));
            }
        },
        toString: toString,
        distance: {
            __proto__: null,
            value: function (value) {
                let self = this.bytes, other = value.bytes, diff = 0, i, length = self.length - 1;
                for (i = 0; i <= length; i++) {
                    diff = self[i] ^ other[i];
                    if (diff > 0) return 8 * (length - i) + Math.floor(Math.log(diff) / Math.LN2) - 7;
                }
                return 0;
            }
        }
    }
};

const prototypes = {
    String: {
        properties: {
            bytes: getBytes,
            chars: {
                __proto__: null,
                get: function chars() {
                    return String.prototype.toArray.call(this);
                }
            },
            binary: getBinary,
            hex: getHex,
            char: {
                __proto__: null,
                get: function char() {
                    return String.prototype.toString.call(this);
                }
            },
            byte: {
                __proto__: null,
                get: function byte() {
                    return String.prototype.codePointAt.call(this);
                }
            },
            toArray: {
                __proto__: null,
                value: function toArray() {
                    return String.prototype.split.call(this, '');
                }
            }
        }
    },
    Number: {
        properties: {
            bytes: {
                __proto__: null,
                get: function bytes() {
                    var value = +this;
                    if (value < 256) {
                        return Bytes([value]);
                    }
                    return this.hex.bytes;
                }
            },
            chars: getChars,
            char: {
                __proto__: null,
                get: function char() {
                    return String.fromCharCode(this);
                }
            },
            byte: {
                __proto__: null,
                get: function byte() {
                    return Number.prototype.valueOf.call(this);
                }
            },
            hex: {
                __proto__: null,
                get: function hex() {
                    return new Hex(Number.prototype.toString.call(this, 16));
                }
            },
            binary: {
                __proto__: null,
                get: function binary() {
                    return new Binary(Number.prototype.toString.call(this, 2));
                }
            }
        }
    },
    Array: prototype,
    Uint8Array: prototype
};

function define(...types) {
    for (var type of types) {
        if (type.prototype) {
            var Class = Object.prototype.toString.call(new type).slice(8, -1);
            var prototype = prototypes[Class];
            if (prototype) {
                Object.defineProperties(type.prototype, prototype.properties);
            }
        }
    }
    return exports;
}

defineFunctions(Bytes.prototype, getView);
defineFunctions(Hex.prototype, toString, getLength, getChars, getBinary);
defineFunctions(Binary.prototype, toString, getLength, getChars, getHex);

define(Array, String, Number, Uint8Array);

lockObjects(Bytes, Hex, Binary);

exports.Bytes = Bytes;
exports.Hex = Hex;
exports.Binary = Binary;
exports.prototypes = prototypes;
exports.define = define;





