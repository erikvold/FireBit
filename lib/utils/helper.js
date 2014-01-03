/*
 * @desc: This is the helper module of the TorrentPlus Add-on
 * @author: Rodney Teal
 * @file: helper.js
 * @date: Monday, October 21, 2013 (CDT)
 */

// { delay, timeout }



    const { Cc, Ci, Cu, components } = require('chrome');
    const { defer, promised } = require('sdk/core/promise');
    const { setTimeout } = require('sdk/timers');

    var windowUtils = require('window/utils');

    const delay = function (ms, value) {
        var { promise, resolve } = defer();
        setTimeout(resolve, ms, value);
        return promise;
    };

    var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
    var watcher = Cc["@mozilla.org/embedcomp/window-watcher;1"].getService(Ci.nsIWindowWatcher);
    var filePicker = Cc['@mozilla.org/filepicker;1'];

        /*
    var convService = Cc["@mozilla.org/intl/scriptableunicodeconverter"];
    var NetUtil = Cu.import("resource://gre/modules/NetUtil.jsm");
        */
    //var FileUtils = Cu.import("resource://gre/modules/FileUtils.jsm");

    var { PageMod } = require('sdk/page-mod');
    var tabs = require('sdk/tabs');
    var system = require("sdk/system");

    var debug = true;

    exports.timeout = function (promise, ms, value) {
        var deferred = defer();
        promise.then(deferred.resolve, deferred.reject);
        delay(ms, value).then(deferred.reject);
        return deferred.promise;
    };

    exports.iterator = function (dictionary) {
        return {
            __iterator__: function () {
                for (var key in dictionary) yield[key, dictionary[key]];
            }
        };
    };

    exports.select = function (text, items) {
        var selected = {};
        if (prompts.select(null, 'TorrentPlus', text, items.length, items, selected))
            return selected.value;
    };

    exports.errLog = function (error) {
        prompts.alert(null, 'TorrentPlus', error.message);
        if (debug) console.error('\n'+error.message+'\n\n', 'filename: '+error.fileName+'\n\n', 'linenumber: '+error.lineNumber+'\n');
    };

    exports.open = function (url, title, options) {
        return watcher.openWindow(null, url, title, options, null);
    };



    exports.filePicker = function (title, mode, callback) {
        var window = windowUtils.getMostRecentBrowserWindow();
        var fp = filePicker.createInstance(Ci.nsIFilePicker);
        fp.init(window, title, Ci.nsIFilePicker[mode]);
        var aCallback = function (result) {
            callback(fp, (result === Ci.nsIFilePicker.returnOK || result === Ci.nsIFilePicker.returnReplace))
        };
        fp.open(aCallback);
    };

    exports.worker = function (worker) {
        try {
            worker.tabs = []; worker.events = [];
            worker.load = function () {
                worker.pageMod = PageMod({
                    include: worker.include,
                    contentScriptFile: worker.contentScriptFile,
                    contentStyleFile: worker.contentStyleFile,
                    onAttach: function (emitter) {
                        emitter.exists = true;
                        emitter.on('detach', function(){emitter.exists=false;});
                        if (worker.hasOwnProperty('error')) emitter.port.on('error', worker.error);
                        if (worker.hasOwnProperty('onAttach')) worker.onAttach(emitter);
                        if (worker.events.length) {
                            var event = worker.events.shift();
                            if (event.data) emitter.port.emit(event.name, event.data);
                            else emitter.port.emit(event.name);
                        }
                    }
                });
                tabs.on('close', worker.close);
            };
            worker.close = function (tab, reset) {
                try {
                    if (reset) {
                        for (tab of worker.tabs) tab.close();
                        delete worker.pageMod;
                    }
                    var index = worker.tabs.indexOf(tab);
                    if (index !== -1) {
                        worker.tabs.splice(index, 1);
                        if (!worker.tabs.length) {
                            worker.pageMod.destroy();
                            delete worker.pageMod;
                        }
                    }
                } catch (error) {
                    errlog(error);
                }
            };
            worker.open = function (event, data) {
                if (!worker.hasOwnProperty('pageMod')) worker.load();
                if (event) worker.events.push({name:event,data:data});
                tabs.open({
                    url: worker.include,
                    onOpen: function (tab) {
                       worker.tabs.push(tab);
                    }
                });
            };
            return worker;
        } catch (error) {
            console.error(error.message, error.fileName, error.lineNumber);
        }
    };

    exports.driveList = function () {
        if (system.platform === 'winnt') {
            var root = fileService.createInstance(Ci.nsILocalFile);
            root.initWithPath('\\\\.');
            var drivesEnum = root.directoryEntries, drives = [];
            while (drivesEnum.hasMoreElements()) {
              drives.push(drivesEnum.getNext().QueryInterface(Ci.nsILocalFile).path + '\\');
            }
            return drives;
        }
        return [];
    };

    /*
    exports.writeFile = function (file, data, charset) {
        var deferred = defer();
        if (typeof file === 'string') {
            var nsiFile = fileService.createInstance(Ci.nsILocalFile);
            nsiFile.initWithPath(file);
        } else var nsiFile = file;
        if (!charset) charset = 'UTF-8';
        var converter = convService.createInstance(Ci.nsIScriptableUnicodeConverter)
        converter.charset = charset;
        var ostream = FileUtils.openSafeFileOutputStream(nsiFile)
        var istream = converter.convertToInputStream(data);
        NetUtil.asyncCopy(istream, ostream, function(status) {
            if (!components.isSuccessCode(status)) {
              deferred.reject(Error('Could not write file to disk'));
              return;
            }

            deferred.resolve(true);
        });
        return deferred.promise;
    };
    */



