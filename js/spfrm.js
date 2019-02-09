/**
 * SixPlusFour Resource Manager
 * Version: 1.0.0
 * Date: 11-04-2014
 *
 * @license Copyright (c) 2014, SixPlusFour. All rights reserved.
 * @author: George Reith, sixplusfour.co.uk
 **/

(function(window) {
  "use strict";

  var SpfRM = {};

  /**
   * Defines a TimeoutError which is created when an external resource times out.
   *
   * @constructor
   * @param {string=} url (optional) URL of erronous resource
   */
  function TimeoutError(url) {
    /** @type {string} */
    this.name = "TimeoutError";
    /** @type {string} */
    this.message = (url || "Script") + " timed out";
    /** @type {string|undefined} */
    this.url = url;
  }
  TimeoutError.prototype = new Error();
  TimeoutError.prototype.constructor = TimeoutError;

  /** @type {Object.<string, Profile>} */
  var profiles = {};
  /**
   * Models a profile, profiles define what resources are required and how events are transmitted.
   *
   * @constructor
   * @param {string} name unique identifer for the profile
   * @param {Object=} opts (optional) options
   */
  var Profile = function(name, opts) {
    profiles[name] = this;
  };
  /** @type {Array.<Resource>} */
  Profile.prototype.dependencies = [];
  /**
   * Adds a resource to be loaded before init callback
   *
   * @param {(string|Array.<string>)} url URL or array of URLs of resource(s) to be loaded
   * @param {(Callback|Function)=} callback (optional) function to be called once all the specified resources have loaded
   * @returns {Profile}
   */
  Profile.prototype.need = function(url, callback) {
    if (typeof url === "string") {
      /** @type {Resource} */
      var resource;
      // Check if Resource object already exists for given resource
      if (resources.hasOwnProperty(url)) {
        resource = resources[url];
        resource.addCallback(callback);
      } else {
        resource = new Resource(url, callback);
      }
      this.dependencies.push(resource);
    } else if (url instanceof Array) {
      if (typeof callback === "function") {
        callback = new Callback(callback);
      }
      var i = url.length;
      while(i--) {
        this.need(url[i], callback);
      }
    }
    return this;
  };
  /**
   * Loads the profiles dependencies
   *
   * @returns {Profile}
   */
  Profile.prototype.use = function() {
    for (var i = 0; i < this.dependencies.length; ++i) {
      this.dependencies[i].load();
    }
    return this;
  };

  /** @type {!Element} */
  var injectEl = document.getElementsByTagName('script')[0]; // Element to inject scripts into
  /** @type {Object.<string, Resource>} */
  var resources = {};
  /** @type {Object.<string, Function>} */
  var prefixes = {
    "async": function() {
      this.el.async = true;
    },
    "timeout": function(s) {
      var time = parseInt(s);
      this.timeout = (parseInt(s) >= 0) ?  time : this.timeout;
    }
  };
  /**
   * Creates a Resource object, used to load external JavaScript files and trigger callbacks
   * NOTE: Resources should be checked for existence before creation.
   *
   * @private
   * @constructor
   * @param {string} url URL of resource to be loaded
   * @param {(Callback|Function)=} callback (optional) Callback object or function to be called once resource is loaded
   */
  var Resource = function(url, callback) {
    /** @type {Array.<string>} */
    var parts = url.split("!");
    /** @type {string} */
    this.url = parts.pop();
    /** @type {string} */
    this.name = url.split("/").pop().split("?")[0];
    /** @type {boolean} */
    this.injected = false; // flag whether resource has been inserted into DOM
    /** @type {boolean} */
    this.loaded = false; // flag whether resource has fired readyState
    /** @type {Array.<Callback>} */
    this.callbacks = [];
    /** @type {Element} */
    this.el = document.createElement("script");
    this.el.src = this.url;
    this.el.type = "text/javascript";
    /** @type {Array.<Object.<string, ?>>} */
    this.loadEvents = [];

    /*
     * Apply custom settings
     * Passed via the url property with format: "key=value!"
     */
    var i = parts.length;
    while(i--) {
      /** @type {Array.<string>} */
      var args = parts[i].split("=");
      /** @type {string} */
      var key = args.shift();
      if (prefixes.hasOwnProperty(key)) {
        prefixes[key].apply(this, args);
      }
    }

    this.addCallback(callback);

    resources[url] = this;
  };
  /**
   * Default load timeout (10 seconds)
   * @type {number}
   */
  Resource.prototype.timeout = 10000;
  /**
   * Adds a callback to be fired when the resource is loaded.
   *
   * @private
   * @param {(Callback|Function)=} callback Callback object or function to be called once resource is loaded
   */
  Resource.prototype.addCallback = function(callback) {
    if (typeof callback === "function") {
      callback = new Callback(callback, this);
    } else if (callback instanceof Callback) {
      callback.need(this);
    }
    if (callback) {
      this.callbacks.push(callback);
    }
  };
  /**
   * Loads the resource if it isn't already loaded
   *
   * @private
   */
  Resource.prototype.load = function() {
    if (this.injected === false) {
      this.injected = true;
      injectEl.parentNode.insertBefore(this.el, injectEl);
      var self = this;
      var target = this.el;
      var timeout = window.setTimeout(function() {
        self.stopLoad(new TimeoutError(self.url));
      }, this.timeout);

      target.onreadystatechange = target.onload = function() {
        var state = target.readyState;
        if (!state || state === "loaded" || state === "complete" || state === "uninitialized") {
          window.clearTimeout(timeout);
          // Handle memory leak in IE
          self.stopLoad();
          self.loaded = true;
          for (var i = 0; i < self.loadEvents.length; ++i) {
            var loadEvent = self.loadEvents[i];
            loadEvent.func.apply(loadEvent.context, loadEvent.args);
          }
        }
      };
    }
  };
  /**
   * Cancels this resource's onload listeners
   *
   * @private
   * @param {Error=} err (optional) Error that triggered the stop
   */
  Resource.prototype.stopLoad = function(err) {
    this.el.onload = this.el.onreadystatechange = null;
    if (err) {
      var i = this.callbacks.length;
      while (i--) {
        this.callbacks[i].void(this);
      }
    }
  };
  /**
   * Registers a function to be called when the resource is loaded
   *
   * @private
   * @param {!Function} func callback function
   * @param {?Object=} context (optional) Context to call the callback in
   * @param {Array.<?>=} args (optional) Arguments to call the callback with
   */
  Resource.prototype.addLoadListener = function(func, context, args) {
    if (args && !(args instanceof Array)) {
      args = [args];
    }
    var callback = {func: func, context: context || null, args: args || null};
    this.loadEvents.push(callback);
  };

  /**
   * Creates a Callback promise.
   * Multiple Resource objects can bind to a Callback, it will only be called when all are loaded.
   *
   * @private
   * @constructor
   * @param {!Function} func function to be called when all the needs have been met
   * @param {(Resource|Array.<Callback>)=} needs (optional) Resource or array of Resources objects that need to be loaded before the callback is fired.
   */
  var Callback = function(func, needs) {
    /** @type {Function} */
    this.func = func;
    /** @type {number} */
    this.needs = 0;
    /** @type {Object.<string, boolean>} */
    this.wants = {};
    /** @type {Object.<string, boolean>} */
    this.has = {};
    if (needs instanceof Array) {
      var i = needs.length;
      while(i--) {
        this.need(needs[i]);
      }
    } else if (needs instanceof Resource) {
      this.need(needs);
    }
  };
  /** @type {?(Error|Array.<Error>)} */
  Callback.prototype.err = null;
  /**
   * Require a resource to be loaded before the callback is fired
   *
   * @private
   * @param {!Resource} resource Resource object to wait until loaded
   */
  Callback.prototype.need = function(resource) {
    if (resource.loaded === false) {
      if (this.has[resource.url] !== true) {
        this.wants[resource.url] = true;
        this.needs++;
        resource.addLoadListener(this.fire, this, [resource]);
      }
    } else {
      this.wants[resource.url] = true;
      this.has[resource.url] = true;
      this.fire(resource);
    }
  };
  /**
   * Stop requiring a resource to be loaded before the callback is fired
   *
   * @private
   * @param {Error} err Error that triggered the cancellation
   * @param {!Resource} resource Resource object to wait until loaded
   */
  Callback.prototype.void = function(err, resource) {
    if (this.wants[resource.url] === true) {
      this.wants[resource.url] = false;
      if (!this.has[resource.url]) {
        this.needs--;
      }
      this.fire(err);
    }
  }
  /**
   * Fire the callback
   *
   * @private
   * @param {Resource} resource The Resource object that is triggering the callback
   */
  Callback.prototype.fire = function(resource) {
      if (resource && this.has[resource.url] !== true && this.wants[resource.url]) {
        this.has[resource.url] = true;
        this.needs--;
      }
      if (this.needs === 0) {
        this.func(this.err);
      }
  };

  /**
   * Test whether canvas is supported by browser
   *
   * @type {boolean}
   */
  SpfRM.canvasSupport = (function() {
    var elem = document.createElement('canvas');
    return !!(elem.getContext && elem.getContext('2d'));
  })();

  SpfRM.Profile = Profile;
  SpfRM.profiles = profiles;

  window.SpfRM = SpfRM;

})(this);