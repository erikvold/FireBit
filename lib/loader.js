'use strict';

this.EXPORTED_SYMBOLS = ['require'];

let { Loader } = Components.utils.import('resource://gre/modules/commonjs/toolkit/loader.js', {});

let loader = Loader.Loader({
    paths: {
       'sdk/': 'resource://gre/modules/commonjs/sdk/',
       '': 'globals:///'
    },
    resolve: function(id, base) {
       if (id == 'chrome' || id.startsWith('@'))
          return id;
       return Loader.resolve(id, base);
    }
});

let module = Loader.Module('main', 'resource://');
let require = Loader.Require(loader, module);

