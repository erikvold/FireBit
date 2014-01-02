var EXPORTED_SYMBOLS = ['Request'];

 'use strict';

const { classes: Cc, Constructor: CC, interfaces: Ci, utils: Cu,
        results: Cr, manager: Cm } = Components;

const PR_UINT32_MAX = 0xFFFFFFFF;

const STATES = {
    0xC1F30001: ['NOT_INITIALIZED', 'Transport has not been initialized.'],
    0x804b0003: ['RESOLVING', 'Transport is resolving the host. Usually a DNS lookup.'],
    0x804b000b: ['RESOLVED', 'Transport has resolved the host.'],
    0x804b0007: ['CONNECTING', 'Transport is connecting to host.'],
    0x804b0004: ['CONNECTED', 'Transport is connected to host'],
    0x804b0005: ['SENDING', 'Transport is sending data to host.'],
    0x804b000a: ['WAITING', 'Transport is waiting for the host to respond.'],
    0x804b0006: ['RECEIVING', 'Transport is receiving data from host.'],
    0x0: ['UNSENT', 'open() has not been called yet.'],
    0x1: ['OPENED', 'send() has not been called yet.'],
    0x2: ['HEADERS_RECEIVED', 'send() has been called, and headers and status are available.'],
    0x3: ['LOADING', 'Downloading; partial data available.'],
    0x4: ['DONE', 'The operation is complete.'],
    0x5: ['SENT', 'The request has been sent.'],
    0x6: ['REQUEST_ERROR', 'The operation is complete but an error occurred.'],
    0x7: ['ALREADY_OPEN', 'The request has already been opened.'],
    0x8: ['UNAVAILABLE', 'The resource is unavailable until headers are received.'],
    0x9: ['ALREADY_SENT', 'The request has already been sent.'],
    0x10: ['MUST_OPEN', 'The request must open before send().'],
    0x11: ['IN_PROGRESS', 'The request is in progress and the resource cannot be modified.'],
    0x12: ['ILLEGAL_VALUE', 'Attempted to set a request property with an illegal value.'],
    0x13: ['INVALID_OBSERVER', 'Attempted to set an observer with a non function value.']
};

var IOService = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
//Cu.import('resource://gre/modules/CertUtils.jsm');
var StreamConverter = Cc['@mozilla.org/streamConverters;1'].getService(Ci.nsIStreamConverterService);

var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);

//var JSON = Cc["@mozilla.org/dom/json;1"].createInstance(Ci.nsIJSON); //-Deprecated

//https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIConsoleService
var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                 .getService(Components.interfaces.nsIConsoleService);
var console = {
    error: function (aMessage, aLineNumber, aSourceName) {
        //https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIScriptError
        var scriptError = Components.classes["@mozilla.org/scripterror;1"]
                              .createInstance(Components.interfaces.nsIScriptError);
        scriptError.init(aMessage, aSourceName, null, aLineNumber,
                         0, 0x0, 'component javascript');
        consoleService.logMessage(scriptError);
    }
};

function Supports() {}
Supports.prototype = {
    QueryInterface : function(/*nsIIDRef*/aIID) {
        if (aIID.equals(Ci.nsISupports) ||
            aIID.equals(Ci.nsIInterfaceRequestor) ||
            aIID.equals(Ci.nsIChannelEventSink) ||
            aIID.equals(Ci.nsIProgressEventSink) ||
            aIID.equals(Ci.nsIHttpEventSink) ||
            aIID.equals(Ci.nsIObserver) ||
            aIID.equals(Ci.nsIRequestObserver) ||
            aIID.equals(Ci.nsIStreamListener))
                return this;

        throw Cr.NS_NOINTERFACE;
    }
};
function InterfaceRequestor() { Supports.call(this); }
InterfaceRequestor.prototype = Object.create(Supports.prototype, {
    getInterface: {
        value: function (/*nsIIDRef*/aIID) {
            try {
                return this.QueryInterface(aIID);
            } catch (error) {
                throw Cr.NS_NOINTERFACE;
            }
        }
    }
});
function ChannelEventSink() { InterfaceRequestor.call(this); }
ChannelEventSink.prototype = Object.create(InterfaceRequestor.prototype, {
    asyncOnChannelRedirect: {
        value: function (oldChannel, newChannel, flags, callback) {
            console.error('Encountered an asynchronous channel redirect.');
            this.request.channel = newChannel;
        }
    },
    onChannelRedirect: {
        value: function (oldChannel, newChannel, flags) {
            console.error('Encountered a synchronous channel redirect.');
            this.request.channel = newChannel;
        }
    },
    constructor: { value: ChannelEventSink }
});
function ProgressEventSink() { ChannelEventSink.call(this); }
ProgressEventSink.prototype = Object.create(ChannelEventSink.prototype, {
    onProgress: {
        value: function (aRequest, aContext, aProgress, aProgressMax) {
            //this.request.onProgress.call(this.request, aRequest, aContext, aProgress, aProgressMax);
        }
    },
    onStatus: {
        value: function (aRequest, aContext, aStatus, aStatusArg) {
            this.request.state = aStatus;
        }
    },
    constructor: { value: ProgressEventSink }
});
function HttpEventSink() { ProgressEventSink.call(this); }
HttpEventSink.prototype = Object.create(ProgressEventSink.prototype, {
    onRedirect: {
        value: function (oldChannel, newChannel) {
            console.error('Encountered a http channel redirect.');
            //Not implemented
        }
    },
    constructor: { value: HttpEventSink }
});
function RequestObserver() { HttpEventSink.call(this); }
RequestObserver.prototype = Object.create(HttpEventSink.prototype, {
    onStartRequest: {
        value: function (aRequest, aContext) {
            //Note: An exception thrown from onStartRequest has the side-effect of causing the request to be canceled.            
            //if (!this.request.channel.requestSucceeded) throw Cr.NS_ERROR_NOT_CONNECTED;
            //if (this.request.overrideMimeType) this.request.channel.contentType = this.request.overrideMimeType;
            this.request.data = '';
            this.request.state = /*HEADERS_RECEIVED*/2;
        }
    },
    onStopRequest: {
        value: function (aRequest, aContext, aStatusCode) {
            //Note: An exception thrown from onStopRequest is generally ignored.
            if (Components.isSuccessCode(aRequest.status) ){//|| (this.request.channel.responseStatus === 404 && this.request.allow404)) {
                this.request.state = /*DONE*/4;
                if (this.request.data) {
                    console.error('We have the resulting data as ' + this.request.responseType);
                    if (this.request.responseType == 'document') {
                        var parser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser);
                        parser.init(null, this.request.URI);
                        this.request.data = parser.parseFromString(this.request.data, "text/html");
                    } else if (this.request.responseType == 'json') {
                        //this.request.data = JSON.decodeFromStream(this.request.stream, this.request.stream.available()); //-Deprecated
                        console.error('test1: ' + this.request.data);
                        this.request.data = JSON.parse(this.request.data);
                        console.error('test2: ' + this.request.data);
                    }
                } 
                this.request.setResponse.call(this.request);
                if (typeof this.request.onload === 'function') this.request.onload.call(this.request, this.request.response);
                this.request.channel = null;
            } else {
                this.request.state = /*REQUEST_ERROR*/6;
                if (typeof this.request.onerror === 'function') this.request.onerror.call(this.request);
            }
            for (var name in this.request.observers) observerService.removeObserver(this.request.listener, name);
        }
    },
    observe: {
        value: function(aSubject, aTopic, aData) {
            if (aSubject === this.request.channel && this.request.observers[aTopic])
                this.request.observers[aTopic](aSubject, aTopic, aData);
        }
    },
    constructor: { value: RequestObserver }
});
function StreamListener() { RequestObserver.call(this); };
StreamListener.prototype = Object.create(RequestObserver.prototype, {
    onDataAvailable: {
        value: function (aRequest, aContext, aInputStream, aOffset, aCount)  {
            //Note: Your implementation of this method must read exactly aCount bytes of data before returning.
            var stream = Cc['@mozilla.org/scriptableinputstream;1'].createInstance(Ci.nsIScriptableInputStream);
            stream.init(aInputStream);
            this.request.state = /*LOADING*/3;
            if (typeof this.request.onDataAvailable === 'function')
                this.request.onDataAvailable.call(this.request, aRequest, aContext, stream, aOffset, aCount);
            else this.request.data += stream.read(aCount);
            stream.close();
        }
    },
    constructor: { value: StreamListener }
});
function ChannelListener(request) {
    StreamListener.call(this);
    this.request = request;
};
ChannelListener.prototype = Object.create(StreamListener.prototype, { constructor: { value: ChannelListener } });
function Channel() {
    if (!this.validated) this.validate();
    this.channel = IOService.newChannel(this.url, this.originCharset, null);
    this.channel.QueryInterface(Ci.nsIRequest);
    this.channel.QueryInterface(Ci.nsIHttpChannel);
    this.unLoadBridge();
    this.setAttributes([
        'contentCharset',
        'contentLength',
        'contentType',
        'originalURI',
        'owner',
        'requestMethod',
        'referrer',
        'allowPipelining',
        'redirectionLimit'
    ]);
    this.setLoadFlags(this.flags);
    this.setHeaders(this.headers ? this.headers : {});
    this.setListener();
}
Channel.prototype = {
    setLoadFlags: function (flags) {
       for (var constant in flags) {
          if (constant = this.channel[flags[constant]]) this.channel.loadFlags |= constant;
       }
    },
    setHeaders: function (headers) {
       for (var header in headers) this.channel.setRequestHeader(header, headers[header], true);
    },
    setAttributes: function (attributes) {
       for (var attribute in attributes) {
          if (this[attribute]) this.channel[attribute] = attributes[attribute];
       }
    },
    unLoadBridge: function () {
        for (var property in this.bridge) {
            this.channel[property] = this.bridge[property];
            delete this.bridge[property];
        }
    }
};
function HttpHeaderVisitor() {
    this.headers = {};
}
HttpHeaderVisitor.prototype = {
    visitHeader: function (header, value) {
        this.headers[header] = value;
    }
};
function HttpObserver(name) {
    return {
        __proto__: null,
        get: function () {
            return this.observers[name];
        },
        set: function (observer) {
            this.addObserver(name, observer);
        }
    };
}
function HttpRequestState(aStatusCode) {
    this.statusCode = aStatusCode;
    if (STATES[aStatusCode]) {
        this.message = STATES[aStatusCode][0];
        this.description = STATES[aStatusCode][1];
    }
}
HttpRequestState.prototype = {
    message: 'Unknown',
    description: '',
    toString: function () {
        return this.message;
    },
    valueOf: function () {
        return this.message;
    },
    equals: function (aStatusCode) {
        return (this.statusCode === aStatusCode);
    }
};
function HttpRequest(options) {
    this.readyState = this.errorState = 0; this.transportState = Cr.NS_ERROR_NOT_INITIALIZED;
    this.validate(options ? options : {}, true);
}
HttpRequest.prototype = Object.create(Channel.prototype, {
    constructor: {
        __proto__: null,
        value: HttpRequest
    },
    send: {
        __proto__: null,
        value: function (content) {
            if (this.readyState === /*OPENED*/1) {
                if (this.requestMethod === 'POST' && (this.content = content ? content : this.content)) {
                    var stream = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
                    stream.setData(this.content, isNaN(this.contentLength) ? this.content.length : this.contentLength);
                    this.transfer.QueryInterface(Ci.nsIUploadChannel);
                    this.transfer.setUploadStream(stream, this.contentType ? this.contentType : '', -1);
                    this.transfer.requestMethod = this.requestMethod;
                    this.transfer.allowPipelining = !!this.allowPipelining;
                }
                this.state = /*SENT*/5;
                if (this.sync) this.syncOpen();
                else this.asyncOpen();
            } else if (this.readyState === /*SENT*/5) this.state = /*ALREADY_SENT*/9;
            else this.state = /*MUST_OPEN*/10;
            return this;
        }
    },
    validate: {
        __proto__: null,
        value: function (options, initial) {
            if (initial) {
                this.observers = options.observers = options.observers ? options.observers : {};
                options.flags = options.flags ? new Array(options.flags.toString()) : ['LOAD_NORMAL'];
                if (options.responseType == 'document' && !~options.flags.indexOf('LOAD_DOCUMENT_URI'))
                    options.flags.push('LOAD_DOCUMENT_URI');
                for (var option in options) this[option] = options[option];
                options = null;
            } else {
                if (!(typeof this.onload === 'function') && !(typeof this.onDataAvailable === 'function'))
                    throw Error('Data listeners must be defined before the request is opened.')
                if (!this.originalURI)
                    this.originalURI = IOService.newURI(this.url, this.originCharset = this.originCharset ? this.originCharset : 'UTF-8', null);
                if (this.convertType) {
                    if (!this.convertType.from || !this.convertType.to)
                        throw Error('The convertType object specified is invalid. Expected: {from: \'type\', to: \'type\'}.');
                }
                if (!(typeof this.onProgress === 'function')) this.onProgress = function () {};
                this.validated = true;
            }
        }
    },
    open: {
        __proto__: null,
        value: function (method, url, sync) {
            if (this.readyState === /*UNSENT*/0) {
                this.url = url;
                this.requestMethod = (method == 'POST') ? 'POST' : 'GET';
                this.sync = sync ? sync : this.sync;
                this.data = '';
                Channel.call(this);
                this.state = /*OPENED*/1;
            } else this.state = /*ALREADY_OPEN*/7;
            return this;
       }
    },
    cancel: {
        __proto__: null,
        value: function (aStatusCode) { //nsiCancelable
            this.transfer.cancel(isNaN(aStatusCode) ? Cr.NS_BINDING_ABORTED : aStatusCode);
            return this;
        }
    },
    isPending: {
        __proto__: null,
        value: function () {
            return this.transfer.isPending();
        }
    },
    suspend: {
        __proto__: null,
        value: function () {
            this.transfer.suspend();
            return this;
        }
    },
    resume: {
        __proto__: null,
        value: function () {
            this.transfer.resume();
            return this;
        }
    },
    syncOpen: {
        __proto__: null,
        value: function () {
            this.stream = this.transfer.open();
            this.listener.onStartRequest(this.transfer, null);
            this.listener.onDataAvailable(this.transfer, null, this.stream, 0, this.stream.available());
            this.listener.onStopRequest(this.transfer, null, Cr.NS_OK);
            this.stream.close();
        }
    },
    asyncOpen: {
        __proto__: null,
        value: function () {
            this.transfer.asyncOpen(this.listener, null);
        }
    },
    get: {
        __proto__: null,
        value: function () {
            if (this.readyState === /*UNSENT*/0) return this.open('GET', this.url).send();
            else this.state = /*IN_PROGRESS*/11;
            return this;
        }
    },
    post: {
        __proto__: null,
        value: function (content) {
            if (this.readyState === /*UNSENT*/0) return this.open('POST', this.url).send(content);
            else this.state = /*IN_PROGRESS*/11;
            return this;
        }
    },
    setRequestHeader: {
        __proto__: null,
        value: function (header, value, merge) {
            if (this.readyState === /*UNSENT*/0) {
                this.transfer.setRequestHeader(header, value, !!merge);
                return true;
            } else this.state = /*IN_PROGRESS*/11;
            return false;
        }
    },
    setResponseHeader: {
        __proto__: null,
        value: function (header, value, merge) {
            if (this.hasHeaders()) {
                try {
                    this.transfer.setResponseHeader(header, value, !!merge);
                    return true;
                } catch (error if error === Cr.NS_ERROR_ILLEGAL_VALUE) {
                    this.state = /*ILLEGAL_VALUE*/12;
                }
            } else this.state = /*UNAVAILABLE*/8;
            return false;
        }
    },
    getRequestHeader: {
        __proto__: null,
        value: function (header) {
            try {
                return this.transfer.getRequestHeader(header);
            } catch (error if error === Cr.NS_ERROR_NOT_AVAILABLE) {
                this.state = /*UNAVAILABLE*/8;
            }
            return null;
        }
    },
    getResponseHeader: {
        __proto__: null,
        value: function (header) {
            if (this.hasHeaders()) return this.transfer.getResponseHeader(header);
            else this.state = /*UNAVAILABLE*/8;
            return null;
        }
    },
    isNoCacheResponse: {
        __proto__: null,
        value: function () {
            if (this.readyState === 0) return this.transfer.isNoCacheResponse();
            else this.state = /*UNAVAILABLE*/8;
            return -1;
        }
    },
    isNoStoreResponse: {
        __proto__: null,
        value: function () {
            if (this.readyState === 0) return this.transfer.isNoStoreResponse();
            else this.state = /*UNAVAILABLE*/8;
            return -1;
        }
    },
    getAllResponseHeaders: {
        __proto__: null,
        value: function () {
            if (this.hasHeaders()) {
                var visitor = new HttpHeaderVisitor();
                this.transfer.visitResponseHeaders(visitor);
                return visitor.headers;
            } else this.state = /*UNAVAILABLE*/8;
            return {};
        }
    },
    getAllRequestHeaders: {
        __proto__: null,
        value: function () {
            var visitor = new HttpHeaderVisitor();
            this.transfer.visitRequestHeaders(visitor);
            return visitor.headers;
        }
    },
    redirectTo: {
        __proto__: null,
        value: function (nsiURI) {
            if (this.readyState === /*UNSENT*/0) {
                if (!nsiURI instanceof Ci.nsiURI) throw Error('Invalid instance of nsiURI specified as redirection target.')
                this.transfer.redirectTo(nsiURI);
                return true;
            } else this.state = /*IN_PROGRESS*/11;
            return false;
        }
    },
    setListener: {
        __proto__: null,
        value: function () {
            this.listener = new ChannelListener(this);
            for (var name in this.observers) this.addObserver(name, this.observers[name]);
            if (!this.sync) this.transfer.notificationCallbacks = this.listener;
            return this.listener = this.convertType ? StreamConverter.asyncConvertData(this.convertType.from, this.convertType.to, this.listener, null) : this.listener;
        }
    },
    overrideMimeType: {
        __proto__: null,
        value: function (mimeType) {
            this.overrideMimeType = mimeType;
            return this;
        }
    },
    setResponse: {
        __proto__: null,
        value: function () {
            this.response = {status: this.responseStatus, statusText: this.responseStatusText};
            if (typeof this.onComplete === 'function') {
                if (this.responseType == 'json') this.response.json = this.data;
                else if (this.responseType == 'document') this.response.xml = this.data;
                else this.response.text = this.data;
                this.onComplete(this.response);
            } else this.response = this.data;
        }
    },
    state: {
        __proto__: null,
        set: function (aStatusCode) {
            if (this.transportState !== aStatusCode && this.readyState !== aStatusCode && this.errorState !== aStatusCode) {
                if (aStatusCode < 6 && aStatusCode > -1) this.readyState = aStatusCode;
                else if (aStatusCode > 5 && aStatusCode < 14) this.errorState = aStatusCode;
                else this.transportState = aStatusCode;
                if (typeof this.onStateChange === 'function')
                    this.onStateChange(new HttpRequestState(aStatusCode));
            }
        }
    },
    hasHeaders: {
        __proto__: null,
        value: function () {
            return (this.readyState >= /*LOADING*/2);
        }
    },
    responseStatus: {
        __proto__: null,
        get: function () {
            if (this.hasHeaders()) return this.transfer.responseStatus;
            else this.state = /*UNAVAILABLE*/8;
            return 0;
        }
    },
    responseStatusText: {
        __proto__: null,
        get: function () {
            if (this.hasHeaders()) return this.transfer.responseStatusText;
            else this.state = /*UNAVAILABLE*/8;
            return '';
        }
    },
    addObserver: {
        __proto__: null,
        value: function (name, observer) {
            if (!this.hasHeaders()) {
                if (typeof observer === 'function') {
                    this.observers[name] = observer;
                    if (this.listener) observerService.addObserver(this.listener, name, false);
                    return true;
                } else this.state = /*INVALID_OBSERVER*/13;
            } else this.state = /*IN_PROGRESS*/11;
            return false;
        }
    },
    onModifyRequest: /*SETTER*/HttpObserver('http-on-modify-request'),
    onExamineResponse: /*SETTER*/HttpObserver('http-on-examine-response'),
    onOpenResponse: /*SETTER*/HttpObserver('http-on-opening-request'),
    onCachedResponse: /*SETTER*/HttpObserver('http-on-examine-cached-response'),
    onMergedResponse: /*SETTER*/HttpObserver('http-on-examine-merged-response'),
    transfer: {
        __proto__: null,
        get: function () {
            return this.channel ? this.channel : this.bridge;
        }
    },
    bridge: {
        __proto__: null,
        value: {}
    }
});
function Request(options) {
    return new HttpRequest(options);
}


// @Todo - timeout, binary - responseType, REDIRECTED - status, remove ability to add the same observer at the same time - prevent,
// JSON parsing does not work propertly, onProgres is being called even if not defined.
// See - https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIHttpChannel

