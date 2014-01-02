'use strict';

this.EXPORTED_SYMBOLS = [
    'XMLHttpRequest',
];

if (~String(this).indexOf('BackstagePass')) {
    (Components).utils.import('resource://firefox-at-torrentplus-dot-com/torrentplus/lib/loader.js');
}

const { Cc, Ci, Cu, Cr, Cm } = require('chrome');

const contract = '@torrentplus.com/xmlhttprequest;1';

if (!Cc[contract]) {
    let { Class } = require('sdk/core/heritage');
    const { registerFactory } = Cm.QueryInterface(Ci.nsIComponentRegistrar);
    const { generateUUID } = Cc['@mozilla.org/uuid-generator;1'].getService(Ci.nsIUUIDGenerator);
    let StreamConverter = Cc['@mozilla.org/streamConverters;1'].getService(Ci.nsIStreamConverterService);
    const Supports = new function() {
      function hasInterface(component, iid) {
        return component && component.interfaces &&
          ( component.interfaces.some(function(id) iid.equals(Ci[id])) ||
            component.implements.some(function($) hasInterface($, iid)) ||
            hasInterface(Object.getPrototypeOf(component), iid));
      }
      return Class({
        QueryInterface: function QueryInterface(iid) {
          if (iid && !hasInterface(this, iid))
            throw Cr.NS_ERROR_NO_INTERFACE;
          return this;
        },
        interfaces: Object.freeze([ 'nsISupports' ])
      });
    };
    let InterfaceRequestor = Class({
        extends: Supports,
        get wrappedJSObject() this,
        initialize: function initialize() {},
        interfaces: ['nsISupports', 'nsIInterfaceRequestor', 'nsISupportsWeakReference', 'nsIObserver',
        'nsIRequest', 'nsIRequestObserver', 'nsIStreamListener', 'nsIXMLHttpRequest'],
        getInterface: function (aIID) {
            try {
                return this.QueryInterface(aIID);
            } catch (error) {
                throw Cr.NS_NOINTERFACE;
            }
        }
    });
    let SupportsWeakReference = Class({
        extends: InterfaceRequestor,
        initialize: function initialize() {
            InterfaceRequestor.prototype.initialize.call(this);
        },
        GetWeakReference: function () {
            return { QueryReferent: this.QueryInterface };
        }
    });
    let Observer = Class({
        extends: SupportsWeakReference,
        initialize: function initialize() {
            SupportsWeakReference.prototype.initialize.call(this);
            this.originalListener = null;
        },
        observe: function(aSubject, aTopic, aData) {
            if (aTopic === 'http-on-modify-request') {
                if (aSubject === this.channel) {
                    this.unregister();
                    try {
                        aSubject.QueryInterface(Ci.nsITraceableChannel);
                        if (this.convertType && this.convertType.from && this.convertType.to) {
                            let convListener = StreamConverter.asyncConvertData(this.convertType.from, this.convertType.to, this, null)
                            this.originalListener = aSubject.setNewListener(convListener);
                        } else this.originalListener = aSubject.setNewListener(this);
                    } catch (error) {
                        aSubject.cancel(Cr.NS_BINDING_ABORTED);
                        throw error;
                    }
                }
            }
        },
        register: function() {
            if (!this.registered) {
                this.registered = true;
                Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService)
                    .addObserver(this, 'http-on-modify-request', true);
            }
        },
        unregister: function() {
            Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService)
                .removeObserver(this, 'http-on-modify-request');
        }
    });
    let RequestObserver = Class({
        extends: Observer,
        initialize: function initialize() {
            Observer.prototype.initialize.call(this);
        },
        onStartRequest: function () {
            //Note: An exception thrown from onStartRequest has the side-effect of causing the request to be canceled.
            this.originalListener.onStartRequest.apply(this.orginalListener, arguments);
        },
        onStopRequest: function () {
            //Note: An exception thrown from onStopRequest is generally ignored.
            this.originalListener.onStopRequest.apply(this.orginalListener, arguments);
        }
    });
    let StreamListener = Class({
        extends: RequestObserver,
        initialize: function initialize() {
            RequestObserver.prototype.initialize.call(this);
        },
        onDataAvailable: function (aRequest, aContext, aInputStream, aOffset, aCount)  {
            try {
                //Note: Your implementation of this method must read exactly aCount bytes of data before returning.
                this.blocksOriginal = false;
                let storageStream = Cc['@mozilla.org/storagestream;1'].createInstance(Ci.nsIStorageStream);
                let scriptInputStream = Cc['@mozilla.org/scriptableinputstream;1'].createInstance(Ci.nsIScriptableInputStream);
                storageStream.init(8192, aCount, null);
                scriptInputStream.init(aInputStream);
                storageStream.getOutputStream(0).write(scriptInputStream.read(aCount), aCount);
                scriptInputStream.close();
                aInputStream.close();
                scriptInputStream = Cc['@mozilla.org/scriptableinputstream;1'].createInstance(Ci.nsIScriptableInputStream);
                scriptInputStream.init(storageStream.newInputStream(0));
                this.callbackListener.call(this, scriptInputStream, aOffset, aCount);
                if (!this.blocksOriginal)
                    this.originalListener.onDataAvailable(aRequest, aContext, storageStream.newInputStream(0), aOffset, aCount);
            } catch (error) {
                this.cancel();
                throw error;
            }
        }
    });
    let Request = Class({
        cancel: function (status) {
            this.channel.cancel(isNaN(status) ? Cr.NS_BINDING_ABORTED : status);
        },
        suspend: function () { this.channel.suspend(); },
        resume: function () { this.channel.resume(); },
        isPending: function () { return this.channel.isPending(); }
    });
    let TracingListener = Class({
        extends: StreamListener,
        implements: [Request],
        initialize: function initialize() {
            StreamListener.prototype.initialize.call(this);
        },
        preventDefault: function () {
            this.blocksOriginal = true;
        }
    });
    let Wrapper = Class({
        extends: TracingListener,
        initialize: function initialize() {
            TracingListener.prototype.initialize.call(this);
            this.properties.map(function (property) {
                Object.defineProperty(this, property, this.setProperty(property));
            }, this);
            this.methods.map(function (method) {
                Object.defineProperty(this, method, this.setMethod(method));
            }, this);
            this.events.map(function (event) {
                Object.defineProperty(this, event='on'+event, this.setProperty(event));
            }, this);
        },
        setMethod: function (property) {
            return {
                __proto__: null,
                value: function () {
                    this.XMLHttpRequest[property].apply(this.XMLHttpRequest, arguments);
                }
            };
        },
        setProperty: function (property) {
            return {
                __proto__: null,
                get: function () {
                    return this.XMLHttpRequest[property];
                },
                set: function (data) {
                    this.XMLHttpRequest[property] = data;
                }
            };
        },
        XMLHttpRequest: Cc['@mozilla.org/xmlextras/xmlhttprequest;1'].createInstance(Ci.nsIXMLHttpRequest),
        properties: ['readyState', 'response', 'responseText', 'responseType', 'responseXML',
            'status', 'statusText', 'timeout', 'upload', 'withCredentials', 'channel', 'mozAnon',
            'mozSystem', 'mozBackgroundRequest', 'mozResponseArrayBuffer', 'multipart', 'anon'],
        methods: ['open', 'overrideMimeType', 'send', 'abort', 'getAllResponseHeaders', 'getResponseHeader',
            'setRequestHeader', 'sendAsBinary'],
        events: ['loadend', 'abort', 'timeout', 'error', 'load', 'loadstart', 'progress', 'readystatechange'],
        set ondata(callbackListener) {
            if (typeof callbackListener === 'function') {
                this.callbackListener = callbackListener;
                this.register();
            } else throw Error('The onData property must be of type function.');
        },
    });
    let Factory = new (Class({
        extends: Supports,
        interfaces: [ 'nsIFactory' ],
        id: generateUUID(),
        description: 'TorrentPlus nsIXMLHttpRequest Wrapper',
        lockFactory: function lockFactory(lock) undefined,
        register: true,
        unregister: true,
        contract: contract,
        Component: Wrapper,
        createInstance: function createInstance(outer, iid) {
            try {
                if (outer)
                    throw Cr.NS_ERROR_NO_AGGREGATION;
                return this.create().QueryInterface(iid);
            }
            catch (error) {
                throw error instanceof Ci.nsIException ? error : Cr.NS_ERROR_FAILURE;
            }
        },
        create: function create() this.Component()
    }));
    registerFactory(Factory.id, Factory.description, Factory.contract, Factory);
}

let XMLHttpRequest = ((typeof(exports) === 'undefined') ? {} : exports)
        .XMLHttpRequest = function () { 
            return Cc[contract].createInstance(Ci.nsIXMLHttpRequest).wrappedJSObject;
        };

//let { XMLHttpRequest } = require('./request');
//Cu.import('resource://firefox-at-torrentplus-dot-com/torrentplus/lib/request.js');
//let XMLHttpRequest = Cc['@torrentplus.com/xmlhttprequest;1'].createInstance(Ci.nsIXMLHttpRequest).wrappedJSObject;