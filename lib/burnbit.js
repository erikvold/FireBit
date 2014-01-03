
var { Request } = require('sdk/request');
var { setTimeout } = require('sdk/timers');
var tabs = require('sdk/tabs');

function burnReq(action, data) {
    Request({
        url: 'http://burnbit.com/' + action,
        header: {
            'Accept': 'application/json, text/javascript, */*',
            'X-Requested-With': 'XMLHttpRequest'
        },
        overrideMimeType: 'application\/json',
        contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
        content: data,
        onComplete: function (response) {
            if (response.status === 200) nextAction(response.json, null);
            else {
                console.error('Request Error: ' + response.statusText);
            }
        }
    }).post();
}

function statusReq(action, data, id, ms) {
    setTimeout(function () {
        burnReq(action, data, function (burnbit) {
            nextAction(burnbit, id);
        });
    }, ms);
}

function download(path) tabs.activeTab.url = 'http://burnbit.com' + path.replace(/torrent/, 'download');

//http://ftp.mozilla.org/pub/mozilla.org/firefox/nightly

function nextAction(burnbit, id) {
    if (burnbit) {
        if (burnbit.status) {
            if (burnbit.status === 'success') {
                id = burnbit.redirect.match(/torrent\/(.*?)\//i)[1];
                if (burnbit.redirect) { 
                    statusReq('checkstatus', 'id='+id, id, 5000);
                } else if (burnbit.thash) {
                    download('/download/' + id + '/');
                }
            } else if (burnbit.status === 'wait') { 
                statusReq('regfile', 'rh='+burnbit.rh, id, 5000);
            } else if (burnbit.status === 'error') {
                console.error('Error: ' + burnbit.html);
            } else if (burnbit.status === 'exists') {
                download(burnbit.redirect);
            } else if (burnbit.status === 'burning' || burnbit.status === 'queued') {
                statusReq('checkstatus', 'id='+id, id, 5000);
            }
        } else if (burnbit[id]) {
                //burning[id].p -- progress
                //burning[id].e -- eta
                nextAction(burnbit[id], id);
        }
    }
}

exports.burn = function (file) { burnReq('regfile', 'file=' + encodeURIComponent(file)); };