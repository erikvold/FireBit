const { Class } = require('sdk/core/heritage');

var store = Class({
    initialize: function initialize() {
        this.values = {};
    },
    add: function (name, value) {
        this.values[name] = value;
    },
    get: function (name)
    values: null
});
