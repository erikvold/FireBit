let events = require("sdk/system/events");
// https://addons.mozilla.org/en-US/developers/docs/sdk/latest/modules/sdk/system/events.html
// Information related the user should be exported here

var user = {};

events.on('user-interaction-active', function () {
    user.active = true;
});

events.on('user-interaction-inactive', function () {
    user.active = false;
});

exports.user = user;
