const { Class } = require('sdk/core/heritage');

/*
 * Please read: https://developer.mozilla.org/en-US/docs/Web/JavaScript/ECMAScript_6_support_in_Mozilla
 *  Proxy, WeakMap, and Arrow Functions before reading this library.
 */

/*\
|*|
|*| Author: Rodney Teal
|*|
\*/

/*
 * Use cases:
 * 'ABCDEF'.bytes == Uint8Array: [65, 66, 67, 68, 69, 70]
 * 'ABCDEF'.hex == Hex: '414243444546' but has to call 'ABCDEF'.bytes first so its String.bytes.hex
 * 'ABCDEF'.binary ==  '001101010011010100110101001101010011010100110101' I lied thats not the right binary but its for example purposes and it calls to bytes first for you just like Hex
 * The following is true: value === value.bytes.hex.binary.hex.bytes.binary.bytes.chars.hex.toString()
 * and any variation of the chaining to the right will also === value if you toString() at the end
 * that is of course assuming (typeof value === 'string')
 * Number can be converted to Bytes i.e. (645646).bytes or to hex or binary
 * So there is logic to the type conversions. This module will not modify global Object.prototype
 * Its execution is sandboxed so you have to import the functionality using Require
 * use the exported (define) function to give this function to a particular type or types
 * Hex, Binary, and Bytes object constructors are also exported.
 * 
 * The Bytes object returned from the Byte contructor is a Proxy the purpose of that proxy is automatically convert types to byte 
 * var bytes = new Bytes(4); 
 * (bytes[0] = new Binary('01110110')) === 118;
 * (bytes[1] = new Hex('41')) === 65;
 * (bytes[2] = 'A') === 65;
 * (bytes[3] = {prop: 'value'}) === 0
 */

// Some types share the same methods so the following functions are reused in multiple places.

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
} // reusable function
function constructor(value) {
    this.value = value;
} // reusable function
function defineFunctions(obj, ...props) { // See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions_and_function_scope/rest_parameters?redirectlocale=en-US&redirectslug=Web%2FJavaScript%2FReference%2Frest_parameters
    var properties = {};
    for (var prop of props) { // props is an array(arg1, arg2, arg3, argN) made up of every argument after obj
        for (var sub in prop) { // for every property of prop where prop is one of the arguments passed to this function
            var name = prop[sub].name; // If the property has a name member which is expected to be Function.name
            if (name) { // We can define that property in our properties object because we know what it should be named
                properties[name] = prop;
            }
        }

    }
    Object.defineProperties(obj, properties); // Assign the properties to the specified obj argument
}
function lockObjects(...objects) {
    for (var obj of objects) { // For each of the arguments passed to lockObjects
        Object.seal(obj); // Members can't be deleted
        Object.freeze(obj); // Member value's are frozen aka they can't be assigned new values
        // Note that there was a bug I read somewhere that mentioned using one of the above methods will also invoke Object.preventExtensions which disallows adding new methods or properties to said object
    }
}

// cachedMethods is a methods accessor that caches binded functions but allows them to be garbages collected.
const cachedMethods = new WeakMap();
const handler = { // See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy
    set: function (target, key, value) { // target should be a Uint8Array instance
        if (typeof value === 'string') { // If the value is a char set the key's value to the char's code point
            target[key] = value.byte
        } else if (value instanceof Hex || value instanceof Binary) { // We always want the byte value
            target[key] = value.bytes[0];
        } else {
            target[key] = value;
        }
    },
    get: function (target, key, receiver) {
        var methods = cachedMethods.get(receiver); // get our methods from the WeakMap
        if (methods === undefined) { // If not defined do so now
            methods = Object.create(null);
            cachedMethods.set(receiver, methods);
        } else if (Object.prototype.hasOwnProperty.call(methods, key)) { // If theres an already cached(binded) instance return it
            return methods[key];
        }
        var result = target[key];
        if (typeof result !== 'function') { // property value is not a function so just return that value
            return result;
        }
        return methods[key] = result.bind(receiver); // We only cache binded functions
    }
};
function Bytes(value) {
    if (!value) value = 0; // Exception is thrown if value is undefined.
    return Proxy(new Uint8Array(value), handler); // See: https://developer.mozilla.org/en-US/docs/Web/API/Uint8Array
}
Object.defineProperty(Bytes, 'prototype', { // Proper prototype chaining so (Bytes instanceof Uint8Array) === true
    __proto__: null,
    value: Uint8Array.prototype
});

var Hex = Class({ // This wrapper class is returned when we want to return a String containing hex so that way the methods are type smart
    initialize: constructor,
    get bytes() { // We make a lot of calls to the primitive type's prototypes because they might differ than then the methods on objects outside this execution environment
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

var Binary = Class({ // Very similar to the above Hex class, the methods serve the same purposes
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

const prototype = { // Array and Uint8Array prototype properties that will be added to said prototypes below
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
        distance: { // See: http://www.bittorrent.org/beps/bep_0005.html returns a number value in the range of (0-160)
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

function define(...types) { // This function will add methods to the following objects if their an argument: Array, String, Number, Uint8Array
    for (var type of types) { // types variable is basically what (arguments) would be in this function scope
        if (type.prototype) { // Ensure that the object has a prototype property
            var Class = Object.prototype.toString.call(new type).slice(8, -1);
            var prototype = prototypes[Class];
            if (prototype) { // If the class is defined in the prototypes object defined above then copy the properties for that class to the type's prototype
                Object.defineProperties(type.prototype, prototype.properties); // See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperties
            }
        }
    }
    return exports;
}

defineFunctions(Bytes.prototype, getView); // assign the property to the specified prototype
defineFunctions(Hex.prototype, toString, getLength, getChars, getBinary);
defineFunctions(Binary.prototype, toString, getLength, getChars, getHex);

define(Array, String, Number, Uint8Array);

lockObjects(Bytes, Hex, Binary);

exports.Bytes = Bytes;
exports.Hex = Hex;
exports.Binary = Binary;
exports.prototypes = prototypes;
exports.define = define;





